-- Shashot - admin dashboard: trade deletion RLS gap + user email lookup RPC
--
-- Two additive changes, both admin-only, needed for the new /admin/trades
-- and /admin/users pages:
--
--   1. trade_requests never had a DELETE policy at all (only
--      select/insert/update - see 0002_rls_policies.sql). RLS defaults to
--      deny when no policy matches a command, so admins could not delete a
--      trade request even though every other admin-override path already
--      worked (validate_trade_status_transition() already lets an admin
--      set any status - see 0001_schema.sql). This adds the missing
--      admin-only DELETE policy. Deleting a trade_requests row cascades to
--      trade_request_items and trade_messages via their existing
--      ON DELETE CASCADE foreign keys - no policy needed on those tables
--      for the cascade itself to work (cascade deletes bypass RLS on the
--      cascaded-to table; only the top-level DELETE target is checked).
--
--   2. Email addresses live in auth.users, not public.profiles (which
--      deliberately never duplicates them - see the "Why a profiles /
--      profile_contacts split?" README section for the same reasoning
--      applied to phone numbers). The admin users table needs to show
--      email, so this adds a SECURITY DEFINER function - admin-gated,
--      exactly like admin_add_team() - that's the only way to read across
--      that schema boundary.

drop policy if exists trade_requests_delete_admin on public.trade_requests;
create policy trade_requests_delete_admin
  on public.trade_requests for delete
  to authenticated
  using (public.is_admin(auth.uid()));

create or replace function public.admin_get_user_emails()
returns table (id uuid, email text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'only admins may view user emails';
  end if;

  return query select au.id, au.email from auth.users au;
end;
$$;

grant execute on function public.admin_get_user_emails() to authenticated;
