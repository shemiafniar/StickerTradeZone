-- Minimal stand-in for the `auth` schema that a real Supabase project
-- provides (auth.users, auth.identities, auth.uid()) - used ONLY by CI to
-- validate that supabase/migrations/*.sql apply cleanly against a vanilla
-- Postgres container, since our migrations reference `auth.users`/
-- `auth.uid()` for the profile-creation trigger and RLS policies.
--
-- This is NOT a full Supabase Auth emulation (no real password hashing,
-- JWT issuing, etc.) - it exists purely so `.github/workflows/database.yml`
-- can catch "does this migration even apply?" mistakes before they reach
-- production, the same way this was manually verified throughout local
-- development. Never used against a real project.

create extension if not exists pgcrypto;

create schema if not exists auth;

create table auth.users (
  instance_id uuid,
  id uuid primary key default gen_random_uuid(),
  aud text,
  role text,
  email text unique,
  encrypted_password text,
  email_confirmed_at timestamptz,
  recovery_sent_at timestamptz,
  last_sign_in_at timestamptz,
  raw_app_meta_data jsonb default '{}'::jsonb,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  confirmation_token text default '',
  email_change text default '',
  email_change_token_new text default '',
  recovery_token text default ''
);

create table auth.identities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  provider text,
  provider_id text,
  identity_data jsonb,
  last_sign_in_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (provider, provider_id)
);

create or replace function auth.uid() returns uuid
language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon;
  end if;
end $$;
