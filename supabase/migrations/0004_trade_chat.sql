-- Sticker Trade IL - private per-trade chat

create table if not exists public.trade_messages (
  id uuid primary key default gen_random_uuid(),
  trade_request_id uuid not null references public.trade_requests (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(btrim(body)) > 0 and char_length(body) <= 2000),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_trade_messages_trade on public.trade_messages (trade_request_id, created_at);
create index if not exists idx_trade_messages_sender on public.trade_messages (sender_id);

alter table public.trade_messages enable row level security;

drop policy if exists trade_messages_select_participant on public.trade_messages;
create policy trade_messages_select_participant
  on public.trade_messages for select
  to authenticated
  using (
    exists (
      select 1 from public.trade_requests tr
      where tr.id = trade_messages.trade_request_id
        and (tr.from_user_id = auth.uid() or tr.to_user_id = auth.uid() or public.is_admin(auth.uid()))
    )
  );

drop policy if exists trade_messages_insert_participant on public.trade_messages;
create policy trade_messages_insert_participant
  on public.trade_messages for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.trade_requests tr
      where tr.id = trade_messages.trade_request_id
        and (tr.from_user_id = auth.uid() or tr.to_user_id = auth.uid())
    )
  );

-- Only the recipient marks a message read (sender cannot fake read receipts on their own messages).
drop policy if exists trade_messages_update_recipient on public.trade_messages;
create policy trade_messages_update_recipient
  on public.trade_messages for update
  to authenticated
  using (
    sender_id <> auth.uid()
    and exists (
      select 1 from public.trade_requests tr
      where tr.id = trade_messages.trade_request_id
        and (tr.from_user_id = auth.uid() or tr.to_user_id = auth.uid())
    )
  )
  with check (sender_id <> auth.uid());

-- Marks every unread message from the other participant as read in one call
-- (simpler + safer for the client than issuing a bulk UPDATE it has to scope itself).
create or replace function public.mark_trade_messages_read(p_trade_request_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.trade_messages
  set read_at = now()
  where trade_request_id = p_trade_request_id
    and sender_id <> auth.uid()
    and read_at is null
    and exists (
      select 1 from public.trade_requests tr
      where tr.id = p_trade_request_id
        and (tr.from_user_id = auth.uid() or tr.to_user_id = auth.uid())
    );
$$;

grant execute on function public.mark_trade_messages_read(uuid) to authenticated;

-- Enable Realtime so the chat UI can subscribe to new messages live.
-- Guarded because the `supabase_realtime` publication only exists on actual
-- Supabase projects (created by the platform), not on a bare Postgres.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'trade_messages'
    ) then
      alter publication supabase_realtime add table public.trade_messages;
    end if;
  end if;
end $$;
