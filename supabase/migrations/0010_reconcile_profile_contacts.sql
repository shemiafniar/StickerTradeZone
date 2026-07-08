-- Sticker Trade IL - reconcile public.profile_contacts with the live schema
--
-- ROOT CAUSE (confirmed from a live project's Postgres logs):
--
--   SQLSTATE 42703: column "whatsapp_phone" of relation "profile_contacts" does not exist
--
-- The `handle_new_user()` trigger that was actually running against that
-- project inserted into a column called `whatsapp_phone`, but that
-- project's real `public.profile_contacts` table only ever had a `phone`
-- column - no `whatsapp` and no `whatsapp_phone`. Nothing in this repo's
-- application code or current migrations references `whatsapp_phone`
-- anywhere (verified by grepping the entire codebase) - the affected
-- project's live schema had diverged from what `0001_schema.sql` defines,
-- most likely because `public.profile_contacts` already existed (created
-- outside of / before this migration history) by the time
-- `create table if not exists public.profile_contacts (...)` ran, which is
-- a no-op against an already-existing table - it never adds or renames
-- columns on an existing table.
--
-- This migration reconciles the table to this repo's canonical shape
-- (`phone`, `whatsapp`) regardless of which of these states a given
-- project is actually in, then re-asserts the trigger function so it's
-- guaranteed to match. Every step is idempotent and safe to run on:
--   - a fresh database (table already has the right columns - every branch
--     below is a no-op except the final CREATE OR REPLACE/trigger, which
--     are themselves idempotent)
--   - an existing project missing `whatsapp` entirely (adds it)
--   - an existing project with a stray legacy `whatsapp_phone` column
--     (migrates its data into `whatsapp`, then drops it)
-- No manual SQL is required before or after running this migration.

do $$
begin
  -- 1) Ensure the canonical columns this app's code actually uses exist.
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profile_contacts' and column_name = 'phone'
  ) then
    alter table public.profile_contacts add column phone text;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profile_contacts' and column_name = 'whatsapp'
  ) then
    alter table public.profile_contacts add column whatsapp text;
  end if;

  -- 2) If a legacy `whatsapp_phone` column exists on this project (the
  --    exact column the broken trigger tried to write to), migrate any
  --    data it holds into `whatsapp` and then remove it, so no current or
  --    future function/policy/query can ever reference it again.
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profile_contacts' and column_name = 'whatsapp_phone'
  ) then
    update public.profile_contacts
    set whatsapp = coalesce(whatsapp, whatsapp_phone)
    where whatsapp_phone is not null and whatsapp is null;

    alter table public.profile_contacts drop column whatsapp_phone;
  end if;

  -- 3) Defense in depth: reconcile public.profiles the same way, in case
  --    the same kind of drift ever affects it (no-op today - this table
  --    has never had a differently-named column in this repo's history).
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'full_name'
  ) then
    alter table public.profiles add column full_name text not null default '';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'city'
  ) then
    alter table public.profiles add column city text not null default '';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'neighborhood'
  ) then
    alter table public.profiles add column neighborhood text;
  end if;
end $$;

-- Re-assert handle_new_user() unchanged from 0009_auth_trigger_resilience.sql,
-- so that a project which reconciles its schema via this migration is
-- guaranteed to also be running a function that matches it, even if
-- 0009 was somehow never applied there.
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

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    grant usage on schema public to supabase_auth_admin;
    grant select, insert, update on public.profiles to supabase_auth_admin;
    grant select, insert, update on public.profile_contacts to supabase_auth_admin;
  end if;
end $$;
