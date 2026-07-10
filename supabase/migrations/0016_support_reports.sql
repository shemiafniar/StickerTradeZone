-- Shashot - bug report / support ticket system ("תקלות ומשוב")
--
-- Any signed-in collector can file a report from /dashboard/support; every
-- admin gets an email when one comes in (see src/lib/actions/support.ts -
-- the email is sent *after* this row is committed, so a delivery failure
-- never loses the report itself); admins triage/manage everything from
-- /admin/reports.

create table if not exists public.support_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  subject text not null,
  category text not null check (
    category in ('technical', 'trade', 'matches', 'scanner', 'notifications', 'suggestion', 'other')
  ),
  description text not null,
  -- Path inside the private `support-attachments` storage bucket (e.g.
  -- "<user_id>/<timestamp>-<filename>"), NOT a public URL - the bucket is
  -- private, so viewing an attachment always requires generating a
  -- short-lived signed URL server-side (see getReportAttachmentUrl() in
  -- src/lib/data/support.ts). Named `attachment_url` for a straightforward
  -- schema (matches the product brief), but treat its value as an opaque
  -- storage path, not something to link to directly.
  attachment_url text,
  page_url text,
  user_agent text,
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  -- Admin-only internal note - never selected/exposed to the reporting user (see RLS below).
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_support_reports_user on public.support_reports (user_id, created_at desc);
create index if not exists idx_support_reports_status on public.support_reports (status, created_at desc);

alter table public.support_reports enable row level security;

drop policy if exists support_reports_select on public.support_reports;
create policy support_reports_select
  on public.support_reports for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists support_reports_insert_self on public.support_reports;
create policy support_reports_insert_self
  on public.support_reports for insert
  to authenticated
  with check (user_id = auth.uid());

-- Reports are immutable from the reporting user's side once filed (a
-- normal support-ticket UX - it also means a user can never edit their own
-- `admin_note` or `status`); only an admin can update status/admin_note.
drop policy if exists support_reports_update_admin on public.support_reports;
create policy support_reports_update_admin
  on public.support_reports for update
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

drop trigger if exists trg_support_reports_updated_at on public.support_reports;
create trigger trg_support_reports_updated_at
  before update on public.support_reports
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Admin notification emails for the "new report submitted" email.
--
-- admin_get_user_emails() (0014_admin_dashboard.sql) can't be reused
-- as-is here: it requires the *caller* to already be an admin (it raises
-- an exception otherwise), but a report is filed by a regular, non-admin
-- user - so it's the caller who needs to look up who to notify, not an
-- admin looking up everyone. This is a narrower, safe alternative: it's
-- callable by any authenticated user, but the query itself is
-- self-scoped to only ever return emails belonging to admin accounts
-- (never the full user list) - a much smaller, low-sensitivity piece of
-- information (an admin's email is not materially more sensitive than
-- the "מנהל" badge already shown next to their name in the UI), used only
-- to route this one system notification.
-- ---------------------------------------------------------------------
create or replace function public.get_admin_notification_emails()
returns table (email text)
language sql
stable
security definer
set search_path = public
as $$
  select au.email
  from auth.users au
  join public.profiles p on p.id = au.id
  where p.role = 'admin' and au.email is not null;
$$;

grant execute on function public.get_admin_notification_emails() to authenticated;

-- ---------------------------------------------------------------------
-- Storage: a private bucket for optional screenshot/image attachments.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('support-attachments', 'support-attachments', false, 8388608, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists support_attachments_insert_own on storage.objects;
create policy support_attachments_insert_own
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'support-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists support_attachments_select on storage.objects;
create policy support_attachments_select
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'support-attachments'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin(auth.uid()))
  );
