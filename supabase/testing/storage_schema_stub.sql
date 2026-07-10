-- Minimal stand-in for the `storage` schema that a real Supabase project
-- provides (storage.buckets, storage.objects, storage.foldername()) - used
-- ONLY by CI to validate that supabase/migrations/*.sql apply cleanly
-- against a vanilla Postgres container, since 0016_support_reports.sql
-- creates a storage bucket + RLS policies on storage.objects for report
-- attachments.
--
-- This is NOT a full Supabase Storage emulation (no actual file storage,
-- no real bucket API) - it exists purely so CI can catch "does this
-- migration even apply?" mistakes before they reach production, the same
-- way supabase/testing/auth_schema_stub.sql does for the `auth` schema.
-- Never used against a real project.

create schema if not exists storage;

create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  owner uuid,
  public boolean default false,
  file_size_limit bigint,
  allowed_mime_types text[],
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text,
  owner uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  metadata jsonb
);

alter table storage.objects enable row level security;

-- Real Supabase's storage.foldername(name) splits a "bucket path" like
-- "<user_id>/<filename>" on "/" and returns every segment except the last
-- (the filename itself) - e.g. foldername('abc/def/file.jpg') = {abc, def}.
create or replace function storage.foldername(name text)
returns text[]
language sql
immutable
as $$
  select case
    when array_length(string_to_array(name, '/'), 1) <= 1 then array[]::text[]
    else (string_to_array(name, '/'))[1 : array_length(string_to_array(name, '/'), 1) - 1]
  end;
$$;
