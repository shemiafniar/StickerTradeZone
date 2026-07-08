-- Sticker Trade IL - lightweight, extensible notification system
--
-- Architecture note: `dispatched_channels` tracks which delivery channels a
-- notification has already gone out on (e.g. '{"inapp"}'). A future
-- background worker can add push/email delivery by polling for rows where
-- 'push' or 'email' is missing from this array and appending to it once
-- sent - no schema changes needed to plug those channels in later.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (
    type in ('trade_request_received', 'trade_accepted', 'trade_declined', 'new_message', 'new_match')
  ),
  title text not null,
  body text,
  link text,
  data jsonb not null default '{}'::jsonb,
  dispatched_channels text[] not null default array['inapp'],
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user on public.notifications (user_id, created_at desc);
create index if not exists idx_notifications_user_unread on public.notifications (user_id) where read_at is null;

alter table public.notifications enable row level security;

drop policy if exists notifications_select_self on public.notifications;
create policy notifications_select_self
  on public.notifications for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin(auth.uid()));

-- Notifications are only ever created server-side (via the trigger functions
-- below, all SECURITY DEFINER), never inserted directly by a client.
drop policy if exists notifications_update_self on public.notifications;
create policy notifications_update_self
  on public.notifications for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create or replace function public.create_notification(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_body text default null,
  p_link text default null,
  p_data jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, type, title, body, link, data)
  values (p_user_id, p_type, p_title, p_body, p_link, p_data);
end;
$$;

create or replace function public.mark_notification_read(p_notification_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.notifications
  set read_at = now()
  where id = p_notification_id and user_id = auth.uid() and read_at is null;
$$;

create or replace function public.mark_all_notifications_read()
returns void
language sql
security definer
set search_path = public
as $$
  update public.notifications
  set read_at = now()
  where user_id = auth.uid() and read_at is null;
$$;

grant execute on function public.mark_notification_read(uuid) to authenticated;
grant execute on function public.mark_all_notifications_read() to authenticated;

-- Trade request lifecycle -> notifications
create or replace function public.notify_trade_request_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sender_name text;
  recipient_name text;
begin
  if tg_op = 'INSERT' then
    select full_name into sender_name from public.profiles where id = new.from_user_id;
    perform public.create_notification(
      new.to_user_id,
      'trade_request_received',
      'בקשת טרייד חדשה',
      coalesce(sender_name, 'אספן') || ' שלח/ה לך בקשת טרייד',
      '/dashboard/trades/' || new.id,
      jsonb_build_object('trade_request_id', new.id)
    );
    return new;
  end if;

  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    select full_name into recipient_name from public.profiles where id = new.to_user_id;
    if new.status = 'accepted' then
      perform public.create_notification(
        new.from_user_id,
        'trade_accepted',
        'הבקשה שלך אושרה!',
        coalesce(recipient_name, 'האספן/ת') || ' אישר/ה את בקשת הטרייד - אפשר לתאם החלפה',
        '/dashboard/trades/' || new.id,
        jsonb_build_object('trade_request_id', new.id)
      );
    elsif new.status = 'declined' then
      perform public.create_notification(
        new.from_user_id,
        'trade_declined',
        'הבקשה שלך נדחתה',
        coalesce(recipient_name, 'האספן/ת') || ' לא אישר/ה הפעם את בקשת הטרייד',
        '/dashboard/trades/' || new.id,
        jsonb_build_object('trade_request_id', new.id)
      );
    end if;
    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_trade_requests_notify on public.trade_requests;
create trigger trg_trade_requests_notify
  after insert or update on public.trade_requests
  for each row execute function public.notify_trade_request_events();

-- New chat message -> notify the other participant
create or replace function public.notify_new_trade_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recipient_id uuid;
  sender_name text;
begin
  select case when tr.from_user_id = new.sender_id then tr.to_user_id else tr.from_user_id end
  into recipient_id
  from public.trade_requests tr
  where tr.id = new.trade_request_id;

  if recipient_id is not null then
    select full_name into sender_name from public.profiles where id = new.sender_id;
    perform public.create_notification(
      recipient_id,
      'new_message',
      'הודעה חדשה מ' || coalesce(sender_name, 'אספן'),
      left(new.body, 140),
      '/dashboard/trades/' || new.trade_request_id,
      jsonb_build_object('trade_request_id', new.trade_request_id)
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_trade_messages_notify on public.trade_messages;
create trigger trg_trade_messages_notify
  after insert on public.trade_messages
  for each row execute function public.notify_new_trade_message();

-- Enable Realtime so the notification bell can update live (guarded the same
-- way as trade_messages - the publication only exists on real Supabase projects).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
    ) then
      alter publication supabase_realtime add table public.notifications;
    end if;
  end if;
end $$;
