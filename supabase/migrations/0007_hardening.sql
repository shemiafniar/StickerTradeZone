-- Sticker Trade IL - QA/security hardening pass before public Beta launch
--
-- This migration only tightens existing behavior; it does not add new
-- product surface area:
--   1) Suspended users are now blocked, at the database level (not just the
--      UI), from the "meaningful" outward-facing actions: creating trade
--      requests, accepting/declining/completing/cancelling them, and
--      sending chat messages. Editing their own private collection
--      (duplicates/missing) is left alone - that's not an abuse vector.
--   2) A `scan_events` table backs a DB-accurate (serverless-safe) rate
--      limit on AI Scanner uploads.

-- ---------------------------------------------------------------------
-- 1) is_active_user() helper
-- ---------------------------------------------------------------------
create or replace function public.is_active_user(uid uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = uid and status = 'active'
  );
$$;

grant execute on function public.is_active_user(uuid) to authenticated, anon;

-- ---------------------------------------------------------------------
-- 2) Suspended users cannot create new trade requests
-- ---------------------------------------------------------------------
drop policy if exists trade_requests_insert_sender on public.trade_requests;
create policy trade_requests_insert_sender
  on public.trade_requests for insert
  to authenticated
  with check (from_user_id = auth.uid() and public.is_active_user(auth.uid()));

-- ---------------------------------------------------------------------
-- 3) Suspended users cannot accept/decline/cancel/complete trade requests
--    (defense in depth on top of the app-level check in the Server Action -
--    this is the actual security boundary).
-- ---------------------------------------------------------------------
create or replace function public.validate_trade_status_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
begin
  if new.status = old.status then
    return new;
  end if;

  if public.is_admin(caller) then
    return new;
  end if;

  -- Below this point the caller must be an active (non-suspended) participant.
  if caller is not null and not public.is_active_user(caller) then
    raise exception 'suspended accounts cannot update trade requests';
  end if;

  if old.status = 'pending' and new.status in ('accepted', 'declined') then
    if caller <> old.to_user_id then
      raise exception 'only the recipient can accept or decline this trade request';
    end if;
    return new;
  end if;

  if old.status = 'pending' and new.status = 'cancelled' then
    if caller <> old.from_user_id then
      raise exception 'only the sender can cancel a pending trade request';
    end if;
    return new;
  end if;

  if old.status = 'accepted' and new.status in ('completed', 'cancelled') then
    if caller <> old.from_user_id and caller <> old.to_user_id then
      raise exception 'only a trade participant can update this trade request';
    end if;
    return new;
  end if;

  raise exception 'invalid trade status transition from % to %', old.status, new.status;
end;
$$;

-- ---------------------------------------------------------------------
-- 4) Suspended users cannot send chat messages
-- ---------------------------------------------------------------------
drop policy if exists trade_messages_insert_participant on public.trade_messages;
create policy trade_messages_insert_participant
  on public.trade_messages for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and public.is_active_user(auth.uid())
    and exists (
      select 1 from public.trade_requests tr
      where tr.id = trade_messages.trade_request_id
        and (tr.from_user_id = auth.uid() or tr.to_user_id = auth.uid())
    )
  );

-- ---------------------------------------------------------------------
-- 5) scan_events: minimal log backing the AI Scanner's rate limit.
--    Not a product feature - purely an abuse-prevention/audit table.
-- ---------------------------------------------------------------------
create table if not exists public.scan_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  mode text not null check (mode in ('duplicates', 'album')),
  created_at timestamptz not null default now()
);

create index if not exists idx_scan_events_user_created on public.scan_events (user_id, created_at desc);

alter table public.scan_events enable row level security;

drop policy if exists scan_events_select_self on public.scan_events;
create policy scan_events_select_self
  on public.scan_events for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists scan_events_insert_self on public.scan_events;
create policy scan_events_insert_self
  on public.scan_events for insert
  to authenticated
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- 6) Explicit note: notifications has intentionally NO insert policy for
--    regular users (see 0005_notifications.sql) - rows are only ever
--    created by the SECURITY DEFINER create_notification() helper, called
--    from triggers. This statement is a no-op that documents/asserts that
--    invariant so a future migration can't silently reintroduce a client
--    insert policy without someone noticing this comment.
-- ---------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'notifications' and cmd = 'INSERT'
  ) then
    raise exception 'notifications must not have a client-facing INSERT policy - see 0007_hardening.sql';
  end if;
end $$;
