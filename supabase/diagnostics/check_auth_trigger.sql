-- =========================================================================
-- Sticker Trade IL - auth.users trigger diagnostics
--
-- Copy-paste this whole file into the Supabase SQL Editor (or run it via
-- psql) on the affected project and read through each result set. It is
-- 100% read-only (no INSERT/UPDATE/DELETE/DDL) - completely safe to run
-- against production.
--
-- Use this when signup/OAuth fails with "Database error saving new user"
-- to find out exactly what's installed and why it might be failing, since
-- GoTrue deliberately hides the underlying Postgres error from the API
-- response (see https://supabase.com/docs/guides/troubleshooting/dashboard-errors-when-managing-users-N1ls4A).
-- =========================================================================

-- 1) Every trigger currently attached to auth.users, and the function each
--    one calls. If you ever installed a trigger from a different tutorial/
--    template (e.g. one expecting a `username` or `avatar_url` NOT NULL
--    column that doesn't exist in this project's `profiles` table), it
--    will show up here alongside (or instead of) ours.
select
  t.tgname as trigger_name,
  t.tgenabled as enabled, -- 'O' = enabled, 'D' = disabled
  p.proname as function_name,
  n.nspname as function_schema,
  pg_get_functiondef(p.oid) as function_source
from pg_trigger t
join pg_proc p on p.oid = t.tgfoid
join pg_namespace n on n.oid = p.pronamespace
where t.tgrelid = 'auth.users'::regclass
  and not t.tgisinternal
order by t.tgname;

-- 2) Ownership + SECURITY DEFINER status for every function that backs an
--    auth.users trigger. `is_security_definer` MUST be true, and `owner`
--    should be a role with full privileges on public.profiles /
--    public.profile_contacts (normally `postgres`) - otherwise the
--    function runs as the restricted `supabase_auth_admin` role (the role
--    GoTrue itself connects as) and any access to the public schema will
--    fail with a permission error.
select
  p.proname as function_name,
  r.rolname as owner,
  p.prosecdef as is_security_definer,
  p.proconfig as function_settings -- look for search_path here
from pg_trigger t
join pg_proc p on p.oid = t.tgfoid
join pg_roles r on r.oid = p.proowner
where t.tgrelid = 'auth.users'::regclass
  and not t.tgisinternal;

-- 3) Does public.profiles / public.profile_contacts have the columns this
--    project's handle_new_user() actually writes to? A "column does not
--    exist" error is one of the most common causes of this failure class
--    if an old/different migration history is present.
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name in ('profiles', 'profile_contacts')
order by table_name, ordinal_position;

-- 4) Any NOT NULL columns on profiles/profile_contacts *without* a default
--    that handle_new_user() does NOT populate would cause every signup to
--    fail, not just Google - if this project's failure is Google-specific,
--    this list should be empty (or only contain columns explicitly set:
--    id, full_name, city, neighborhood, role for profiles; user_id, phone,
--    whatsapp for profile_contacts).
select table_name, column_name
from information_schema.columns
where table_schema = 'public'
  and table_name in ('profiles', 'profile_contacts')
  and is_nullable = 'no'
  and column_default is null;

-- 5) Grants supabase_auth_admin actually has on the two tables (belt-and-
--    suspenders grants were added in migration 0009_auth_trigger_resilience.sql -
--    if this project predates that migration, re-run it).
select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('profiles', 'profile_contacts')
  and grantee = 'supabase_auth_admin';

-- 6) Recent auth admin log entries in this app's own audit trail (only
--    useful if signups got far enough to reach app-level logging, which a
--    failed trigger during the auth.users insert itself would not).
select * from public.admin_logs order by created_at desc limit 20;

-- =========================================================================
-- Next step: Supabase Dashboard -> Logs -> Postgres Logs, filter/search for
-- "handle_new_user" (or just "ERROR"/"WARNING") around the timestamp of a
-- failed sign-in attempt. After migration 0009, any profile-provisioning
-- failure logs a WARNING with the exact SQLSTATE and SQLERRM, e.g.:
--
--   handle_new_user: profile provisioning failed for user <uuid>
--   (sqlstate=23502): null value in column "..." violates not-null constraint
--
-- That message tells you exactly which constraint/permission/column is the
-- real root cause - paste it into a new migration fixing that specific
-- issue, or open an issue with that exact text.
-- =========================================================================
