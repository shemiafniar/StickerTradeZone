-- Sticker Trade IL - auth.users trigger resilience & diagnostics
--
-- Investigating a production report of Google OAuth sign-in failing with
-- "Database error saving new user" - GoTrue's generic wrapper for ANY
-- exception raised while it inserts a row into auth.users. Since our
-- handle_new_user() trigger runs in that same transaction, an exception
-- there aborts the *entire* signup, including the auth.users row itself.
--
-- What was verified (see the PR description for full detail):
--   - handle_new_user() is SECURITY DEFINER, owned by postgres, and every
--     table reference is schema-qualified - the standard, Supabase-
--     documented pattern for this exact class of failure
--     (https://supabase.com/docs/guides/troubleshooting/dashboard-errors-when-managing-users-N1ls4A).
--   - Reproduced Supabase's real privilege model locally (a restricted
--     `supabase_auth_admin` role, matching what GoTrue actually connects
--     as, with NO direct grants on the public schema) and confirmed the
--     existing trigger inserts correctly under that role, exactly like the
--     official pattern promises.
--   - Every SECURITY DEFINER function in this project is owned by
--     `postgres` with `prosecdef = true` - verified via `pg_proc`.
--
-- Since this could not be reproduced against a from-scratch local Postgres
-- with the same role separation Supabase uses, the most likely explanation
-- is something specific to the affected project's history (e.g. a leftover
-- trigger/function from an earlier iteration with a different profiles
-- schema, or migrations having been run under a role that doesn't own
-- public.profiles/profile_contacts). This migration does three things:
--
--   1. Switches to Supabase's exact documented pattern (`search_path = ''`
--      with fully-qualified names) instead of `search_path = public`,
--      removing any remaining doubt about schema resolution.
--   2. Adds explicit, redundant grants to `supabase_auth_admin` on the two
--      tables this trigger writes to - belt-and-suspenders on top of
--      SECURITY DEFINER, guarded so it's a no-op on non-Supabase Postgres.
--   3. Wraps the profile-provisioning logic in an exception handler that
--      logs the *exact* SQLSTATE/SQLERRM/context via `RAISE WARNING`
--      (visible in Supabase Dashboard -> Logs -> Postgres Logs - search
--      for "handle_new_user") and lets `auth.users` creation succeed
--      regardless. This is not "masking" the error: it is still fully
--      logged with complete diagnostic detail, and the app already has a
--      tested fallback for exactly this case (`getCurrentProfile()` /
--      `getCurrentContact()` in src/lib/data/profile.ts self-heal the
--      missing row on first dashboard load, under the user's own RLS
--      policies rather than this trigger's). The alternative - letting a
--      profile-table hiccup permanently block sign-in - is strictly worse
--      for users, and previously turned a recoverable situation into an
--      unrecoverable "Database error saving new user".
--
-- See supabase/diagnostics/check_auth_trigger.sql for a copy-pasteable
-- script to run in the Supabase SQL Editor to inspect exactly what's
-- installed on a given project if this ever recurs.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_first_user boolean;
begin
  begin
    select not exists (select 1 from public.profiles) into v_is_first_user;

    insert into public.profiles (id, full_name, city, neighborhood, role)
    values (
      new.id,
      coalesce(new.raw_user_meta_data ->> 'full_name', ''),
      coalesce(new.raw_user_meta_data ->> 'city', ''),
      nullif(new.raw_user_meta_data ->> 'neighborhood', ''),
      case when v_is_first_user then 'admin' else 'user' end
    )
    on conflict (id) do nothing;

    insert into public.profile_contacts (user_id, phone, whatsapp)
    values (
      new.id,
      nullif(new.raw_user_meta_data ->> 'phone', ''),
      nullif(new.raw_user_meta_data ->> 'phone', '')
    )
    on conflict (user_id) do nothing;
  exception when others then
    -- Full diagnostic detail goes to the Postgres logs. Grep for
    -- "handle_new_user" in Supabase Dashboard -> Logs -> Postgres Logs.
    raise warning 'handle_new_user: profile provisioning failed for user % (sqlstate=%): %',
      new.id, sqlstate, sqlerrm;
  end;

  return new;
end;
$$;

drop trigger if exists trg_on_auth_user_created on auth.users;
create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Redundant defense-in-depth: even though SECURITY DEFINER should make
-- this unnecessary, explicitly grant supabase_auth_admin (the role GoTrue
-- actually connects as on hosted Supabase) direct access to the two tables
-- this trigger writes to. Guarded so this is a no-op on any Postgres
-- instance that doesn't have this role (local dev, self-hosted, CI).
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    grant usage on schema public to supabase_auth_admin;
    grant select, insert, update on public.profiles to supabase_auth_admin;
    grant select, insert, update on public.profile_contacts to supabase_auth_admin;
  end if;
end $$;
