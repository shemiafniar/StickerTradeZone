-- Sticker Trade IL - Row Level Security policies

alter table public.profiles enable row level security;
alter table public.profile_contacts enable row level security;
alter table public.stickers enable row level security;
alter table public.app_settings enable row level security;
alter table public.user_duplicates enable row level security;
alter table public.user_missing enable row level security;
alter table public.trade_requests enable row level security;
alter table public.trade_request_items enable row level security;
alter table public.admin_logs enable row level security;

-- =========================================================================
-- PROFILES
-- Public-safe fields are visible to every signed-in collector so the
-- match/marketplace lists can render names & cities. Sensitive contact
-- info lives in profile_contacts instead.
-- =========================================================================
drop policy if exists profiles_select_all on public.profiles;
create policy profiles_select_all
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());

drop policy if exists profiles_update_self_or_admin on public.profiles;
create policy profiles_update_self_or_admin
  on public.profiles for update
  to authenticated
  using (id = auth.uid() or public.is_admin(auth.uid()))
  with check (id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists profiles_delete_admin on public.profiles;
create policy profiles_delete_admin
  on public.profiles for delete
  to authenticated
  using (public.is_admin(auth.uid()));

-- =========================================================================
-- PROFILE CONTACTS
-- Only self, admins, or an accepted/completed trade partner may read.
-- =========================================================================
drop policy if exists profile_contacts_select on public.profile_contacts;
create policy profile_contacts_select
  on public.profile_contacts for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_admin(auth.uid())
    or exists (
      select 1 from public.trade_requests tr
      where tr.status in ('accepted', 'completed')
        and (
          (tr.from_user_id = auth.uid() and tr.to_user_id = profile_contacts.user_id)
          or (tr.to_user_id = auth.uid() and tr.from_user_id = profile_contacts.user_id)
        )
    )
  );

drop policy if exists profile_contacts_insert_self on public.profile_contacts;
create policy profile_contacts_insert_self
  on public.profile_contacts for insert
  to authenticated
  with check (user_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists profile_contacts_update_self on public.profile_contacts;
create policy profile_contacts_update_self
  on public.profile_contacts for update
  to authenticated
  using (user_id = auth.uid() or public.is_admin(auth.uid()))
  with check (user_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists profile_contacts_delete_admin on public.profile_contacts;
create policy profile_contacts_delete_admin
  on public.profile_contacts for delete
  to authenticated
  using (public.is_admin(auth.uid()));

-- =========================================================================
-- STICKERS (catalog) - readable by anyone signed in, writable by admins only
-- =========================================================================
drop policy if exists stickers_select_all on public.stickers;
create policy stickers_select_all
  on public.stickers for select
  to authenticated
  using (true);

drop policy if exists stickers_write_admin on public.stickers;
create policy stickers_write_admin
  on public.stickers for insert
  to authenticated
  with check (public.is_admin(auth.uid()));

drop policy if exists stickers_update_admin on public.stickers;
create policy stickers_update_admin
  on public.stickers for update
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

drop policy if exists stickers_delete_admin on public.stickers;
create policy stickers_delete_admin
  on public.stickers for delete
  to authenticated
  using (public.is_admin(auth.uid()));

-- =========================================================================
-- APP SETTINGS
-- =========================================================================
drop policy if exists app_settings_select_all on public.app_settings;
create policy app_settings_select_all
  on public.app_settings for select
  to authenticated
  using (true);

drop policy if exists app_settings_update_admin on public.app_settings;
create policy app_settings_update_admin
  on public.app_settings for update
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- =========================================================================
-- USER DUPLICATES
-- Visible to everyone (that's the point of the marketplace/match system);
-- writable only by the owner or an admin.
-- =========================================================================
drop policy if exists user_duplicates_select_all on public.user_duplicates;
create policy user_duplicates_select_all
  on public.user_duplicates for select
  to authenticated
  using (true);

drop policy if exists user_duplicates_write_owner on public.user_duplicates;
create policy user_duplicates_write_owner
  on public.user_duplicates for insert
  to authenticated
  with check (user_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists user_duplicates_update_owner on public.user_duplicates;
create policy user_duplicates_update_owner
  on public.user_duplicates for update
  to authenticated
  using (user_id = auth.uid() or public.is_admin(auth.uid()))
  with check (user_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists user_duplicates_delete_owner on public.user_duplicates;
create policy user_duplicates_delete_owner
  on public.user_duplicates for delete
  to authenticated
  using (user_id = auth.uid() or public.is_admin(auth.uid()));

-- =========================================================================
-- USER MISSING
-- =========================================================================
drop policy if exists user_missing_select_all on public.user_missing;
create policy user_missing_select_all
  on public.user_missing for select
  to authenticated
  using (true);

drop policy if exists user_missing_write_owner on public.user_missing;
create policy user_missing_write_owner
  on public.user_missing for insert
  to authenticated
  with check (user_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists user_missing_update_owner on public.user_missing;
create policy user_missing_update_owner
  on public.user_missing for update
  to authenticated
  using (user_id = auth.uid() or public.is_admin(auth.uid()))
  with check (user_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists user_missing_delete_owner on public.user_missing;
create policy user_missing_delete_owner
  on public.user_missing for delete
  to authenticated
  using (user_id = auth.uid() or public.is_admin(auth.uid()));

-- =========================================================================
-- TRADE REQUESTS
-- Visible & mutable only by the two participants (status transitions are
-- further constrained by the validate_trade_status_transition trigger).
-- =========================================================================
drop policy if exists trade_requests_select_participant on public.trade_requests;
create policy trade_requests_select_participant
  on public.trade_requests for select
  to authenticated
  using (
    from_user_id = auth.uid()
    or to_user_id = auth.uid()
    or public.is_admin(auth.uid())
  );

drop policy if exists trade_requests_insert_sender on public.trade_requests;
create policy trade_requests_insert_sender
  on public.trade_requests for insert
  to authenticated
  with check (from_user_id = auth.uid());

drop policy if exists trade_requests_update_participant on public.trade_requests;
create policy trade_requests_update_participant
  on public.trade_requests for update
  to authenticated
  using (
    from_user_id = auth.uid()
    or to_user_id = auth.uid()
    or public.is_admin(auth.uid())
  )
  with check (
    from_user_id = auth.uid()
    or to_user_id = auth.uid()
    or public.is_admin(auth.uid())
  );

-- =========================================================================
-- TRADE REQUEST ITEMS
-- =========================================================================
drop policy if exists trade_request_items_select_participant on public.trade_request_items;
create policy trade_request_items_select_participant
  on public.trade_request_items for select
  to authenticated
  using (
    exists (
      select 1 from public.trade_requests tr
      where tr.id = trade_request_items.trade_request_id
        and (tr.from_user_id = auth.uid() or tr.to_user_id = auth.uid() or public.is_admin(auth.uid()))
    )
  );

drop policy if exists trade_request_items_insert_sender on public.trade_request_items;
create policy trade_request_items_insert_sender
  on public.trade_request_items for insert
  to authenticated
  with check (
    exists (
      select 1 from public.trade_requests tr
      where tr.id = trade_request_items.trade_request_id
        and tr.from_user_id = auth.uid()
        and tr.status = 'pending'
    )
  );

drop policy if exists trade_request_items_delete_admin on public.trade_request_items;
create policy trade_request_items_delete_admin
  on public.trade_request_items for delete
  to authenticated
  using (public.is_admin(auth.uid()));

-- =========================================================================
-- ADMIN LOGS
-- =========================================================================
drop policy if exists admin_logs_select_admin on public.admin_logs;
create policy admin_logs_select_admin
  on public.admin_logs for select
  to authenticated
  using (public.is_admin(auth.uid()));

drop policy if exists admin_logs_insert_admin on public.admin_logs;
create policy admin_logs_insert_admin
  on public.admin_logs for insert
  to authenticated
  with check (public.is_admin(auth.uid()) and admin_id = auth.uid());
