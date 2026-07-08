-- Sticker Trade IL - zero-touch production bootstrap
--
-- Goal: a brand new Supabase project + a fresh Vercel deployment should work
-- end-to-end (register -> confirm email -> log in -> see the dashboard ->
-- use the admin panel) with nothing beyond running the SQL migrations and
-- setting the documented env vars / Auth redirect URLs - no one should ever
-- need to open the SQL editor to hand-write an `insert`/`update` after
-- deploying.
--
-- The one gap in the original bootstrap was "how does anyone become an
-- admin?" - previously the only path was a manual SQL UPDATE. This migration
-- closes that gap safely: the very first person to ever sign up on a given
-- project is automatically made an admin. That's a natural fit because a
-- brand new project has no data yet, so the first signup is - by
-- construction - the person deploying and testing the app. Every signup
-- after that gets the normal 'user' role, exactly as before.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_first_user boolean;
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

  return new;
end;
$$;

-- Trigger already exists (created in 0001_schema.sql) and simply points at
-- this function by name, so replacing the function body above is all that's
-- needed - re-creating the trigger here too, defensively, in case this
-- migration is ever applied to a database where it was somehow missing.
drop trigger if exists trg_on_auth_user_created on auth.users;
create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
