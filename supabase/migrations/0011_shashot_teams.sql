-- Shashot (formerly "Sticker Trade IL") - visual, team-based collection model
--
-- This migration replaces the old flat 1..N sticker numbering with a
-- team-scoped identifier scheme (e.g. "GER-2", "FRA-17"), and merges the
-- old user_duplicates/user_missing tables into a single user_stickers table
-- with a 4-state status (no row = not marked, 'have', 'duplicate',
-- 'missing') - the natural data model for the new tap-to-cycle visual grid.
--
-- Design choices, and why:
--   - `stickers.id` (uuid) is left untouched throughout, so existing
--     `trade_request_items.sticker_id` foreign keys never dangle - only the
--     *interpretation* of `stickers.number`/new `team_code`/`code` columns
--     changes, in place.
--   - Existing sticker rows (old flat numbers 1..N) are mapped, best-effort
--     and deterministically, onto (team, per-team number) pairs by treating
--     every block of 20 consecutive old numbers as one team, in the seeded
--     team order below. This preserves existing collectors' data whenever
--     the old catalog was configured as team_count * 20 (the expected
--     shape); numbers beyond that range have no valid mapping and are
--     removed along with their dependent rows (this only affects a catalog
--     that was never fully configured - nothing in the shipped UI could
--     create such gaps).
--   - After the remap, every one of the 32 seeded teams is guaranteed to
--     have exactly 20 stickers (missing ones are created fresh), so the
--     catalog is always complete regardless of the starting state.

-- =========================================================================
-- 1) TEAMS
-- =========================================================================
create table if not exists public.teams (
  code text primary key check (code = upper(code) and code ~ '^[A-Z]{3}$'),
  name_he text not null,
  flag_emoji text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

comment on table public.teams is 'Participating national teams shown as cards in the visual collection UI.';

alter table public.teams enable row level security;

drop policy if exists teams_select_all on public.teams;
create policy teams_select_all
  on public.teams for select
  to authenticated
  using (true);

drop policy if exists teams_write_admin on public.teams;
create policy teams_write_admin
  on public.teams for insert
  to authenticated
  with check (public.is_admin(auth.uid()));

drop policy if exists teams_update_admin on public.teams;
create policy teams_update_admin
  on public.teams for update
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

drop policy if exists teams_delete_admin on public.teams;
create policy teams_delete_admin
  on public.teams for delete
  to authenticated
  using (public.is_admin(auth.uid()));

insert into public.teams (code, name_he, flag_emoji, sort_order) values
  ('ISR', 'ישראל', '🇮🇱', 1),
  ('BRA', 'ברזיל', '🇧🇷', 2),
  ('ARG', 'ארגנטינה', '🇦🇷', 3),
  ('FRA', 'צרפת', '🇫🇷', 4),
  ('GER', 'גרמניה', '🇩🇪', 5),
  ('ESP', 'ספרד', '🇪🇸', 6),
  ('POR', 'פורטוגל', '🇵🇹', 7),
  ('ENG', 'אנגליה', '🏴', 8),
  ('ITA', 'איטליה', '🇮🇹', 9),
  ('NED', 'הולנד', '🇳🇱', 10),
  ('BEL', 'בלגיה', '🇧🇪', 11),
  ('CRO', 'קרואטיה', '🇭🇷', 12),
  ('URU', 'אורוגוואי', '🇺🇾', 13),
  ('COL', 'קולומביה', '🇨🇴', 14),
  ('MEX', 'מקסיקו', '🇲🇽', 15),
  ('USA', 'ארה"ב', '🇺🇸', 16),
  ('JPN', 'יפן', '🇯🇵', 17),
  ('KOR', 'דרום קוריאה', '🇰🇷', 18),
  ('MAR', 'מרוקו', '🇲🇦', 19),
  ('SEN', 'סנגל', '🇸🇳', 20),
  ('GHA', 'גאנה', '🇬🇭', 21),
  ('CMR', 'קמרון', '🇨🇲', 22),
  ('TUN', 'תוניסיה', '🇹🇳', 23),
  ('EGY', 'מצרים', '🇪🇬', 24),
  ('NGA', 'ניגריה', '🇳🇬', 25),
  ('AUS', 'אוסטרליה', '🇦🇺', 26),
  ('CAN', 'קנדה', '🇨🇦', 27),
  ('SUI', 'שוויץ', '🇨🇭', 28),
  ('POL', 'פולין', '🇵🇱', 29),
  ('DEN', 'דנמרק', '🇩🇰', 30),
  ('SRB', 'סרביה', '🇷🇸', 31),
  ('TUR', 'טורקיה', '🇹🇷', 32)
on conflict (code) do nothing;

-- =========================================================================
-- 2) STICKERS - remap the old flat catalog onto (team_code, number, code)
-- =========================================================================
alter table public.stickers add column if not exists team_code text references public.teams (code);
alter table public.stickers add column if not exists code text;

-- Drop the old globally-unique constraint on `number` (auto-named by
-- Postgres for the original `number integer unique` column definition)
-- *before* remapping below - otherwise remapping multiple legacy numbers
-- into the same 1..20 per-team range collides with the old global
-- constraint mid-update. Numbers are unique per-team from now on.
alter table public.stickers drop constraint if exists stickers_number_key;

-- Best-effort deterministic remap of legacy flat numbers -> (team, number).
-- Every 20 consecutive legacy numbers become one seeded team's 20 stickers,
-- in team sort_order. Uses an UPDATE ... FROM, which evaluates every SET
-- expression against the *pre-update* row, so `s.number` on the right-hand
-- side always refers to the old value even while also being overwritten.
with team_order as (
  select code, row_number() over (order by sort_order) - 1 as team_index
  from public.teams
)
update public.stickers s
set
  team_code = t.code,
  number = ((s.number - 1) % 20) + 1
from team_order t
where t.team_index = floor((s.number - 1) / 20)::int
  and s.team_code is null;

-- Legacy numbers beyond the seeded teams' range (team_count * 20) have no
-- valid mapping - remove them and anything referencing them. This is a
-- no-op unless a project's catalog was configured larger than 640.
-- user_duplicates/user_missing are guarded with an existence check so this
-- migration can be re-run safely after they've already been dropped further
-- down (e.g. re-running the whole file after a first successful run).
delete from public.trade_request_items where sticker_id in (select id from public.stickers where team_code is null);

do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'user_duplicates') then
    delete from public.user_duplicates where sticker_id in (select id from public.stickers where team_code is null);
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'user_missing') then
    delete from public.user_missing where sticker_id in (select id from public.stickers where team_code is null);
  end if;
end $$;

delete from public.stickers where team_code is null;

alter table public.stickers alter column team_code set not null;

alter table public.stickers drop column if exists name;
alter table public.stickers drop column if exists team;

update public.stickers set code = team_code || '-' || number where code is null;
alter table public.stickers alter column code set not null;

alter table public.stickers drop constraint if exists stickers_code_key;
alter table public.stickers add constraint stickers_code_key unique (code);
alter table public.stickers drop constraint if exists stickers_team_number_key;
alter table public.stickers add constraint stickers_team_number_key unique (team_code, number);
alter table public.stickers drop constraint if exists stickers_number_range;
alter table public.stickers add constraint stickers_number_range check (number between 1 and 20);

-- Guarantee every seeded team has exactly 20 stickers, regardless of
-- whether any legacy data existed to remap (fresh installs included).
insert into public.stickers (team_code, number, code)
select t.code, gs.n, t.code || '-' || gs.n
from public.teams t
cross join generate_series(1, 20) as gs(n)
on conflict (team_code, number) do nothing;

create index if not exists idx_stickers_team_code on public.stickers (team_code);

-- =========================================================================
-- 3) USER_STICKERS - unifies user_duplicates + user_missing into one
--    4-state row per (user, sticker): no row = unmarked/gray.
-- =========================================================================
create table if not exists public.user_stickers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  sticker_id uuid not null references public.stickers (id) on delete cascade,
  status text not null check (status in ('have', 'duplicate', 'missing')),
  listing_type text not null default 'trade' check (listing_type in ('trade', 'sale', 'both')),
  price numeric(10, 2) check (price is null or price >= 0),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, sticker_id)
);

comment on table public.user_stickers is
  'One row per (user, sticker) the user has marked. status: have (green) / duplicate (blue, tradeable) / missing (red). No row = unmarked (gray).';

create index if not exists idx_user_stickers_user on public.user_stickers (user_id);
create index if not exists idx_user_stickers_sticker on public.user_stickers (sticker_id);
create index if not exists idx_user_stickers_status on public.user_stickers (status);

drop trigger if exists trg_user_stickers_updated_at on public.user_stickers;
create trigger trg_user_stickers_updated_at
  before update on public.user_stickers
  for each row execute function public.set_updated_at();

alter table public.user_stickers enable row level security;

-- Visible to everyone (needed for matching/marketplace, same as the two
-- tables this replaces); writable only by the owner or an admin.
drop policy if exists user_stickers_select_all on public.user_stickers;
create policy user_stickers_select_all
  on public.user_stickers for select
  to authenticated
  using (true);

drop policy if exists user_stickers_insert_owner on public.user_stickers;
create policy user_stickers_insert_owner
  on public.user_stickers for insert
  to authenticated
  with check (user_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists user_stickers_update_owner on public.user_stickers;
create policy user_stickers_update_owner
  on public.user_stickers for update
  to authenticated
  using (user_id = auth.uid() or public.is_admin(auth.uid()))
  with check (user_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists user_stickers_delete_owner on public.user_stickers;
create policy user_stickers_delete_owner
  on public.user_stickers for delete
  to authenticated
  using (user_id = auth.uid() or public.is_admin(auth.uid()));

-- Migrate existing data. Duplicates take priority over missing if (in the
-- old model, which had no constraint preventing it) a user somehow had both
-- rows for the same sticker.
--
-- IMPORTANT: this must not assume user_duplicates already has
-- `listing_type`/`price` (added by 0006_marketplace.sql) - a project whose
-- migration history stalled before 0006 was ever applied still has the
-- *original* 0001_schema.sql shape (a `for_sale boolean` column, no
-- `listing_type`/`price` at all). A static `select ... listing_type, price
-- ... from user_duplicates` against that shape fails with "column
-- listing_type does not exist" - and critically, since `listing_type` *is*
-- a real column on the just-created `user_stickers` target table, Postgres's
-- own error hinting reports it as "There is a column named listing_type in
-- table user_stickers, but it cannot be referenced from this part of the
-- query", which can look confusingly like a bug in this migration rather
-- than a mismatched source table. The three branches below cover every
-- shape user_duplicates can actually be in.
do $$
declare
  v_has_listing_type boolean;
  v_has_for_sale boolean;
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'user_duplicates'
  ) then
    -- Already migrated and dropped by an earlier successful run of this
    -- migration - nothing left to do.
    null;
  else
    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'user_duplicates' and column_name = 'listing_type'
    ) into v_has_listing_type;

    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'user_duplicates' and column_name = 'for_sale'
    ) into v_has_for_sale;

    if v_has_listing_type then
      -- 0006_marketplace.sql already ran: listing_type/price/note exist as-is.
      insert into public.user_stickers (user_id, sticker_id, status, listing_type, price, note, created_at)
      select user_id, sticker_id, 'duplicate', listing_type, price, note, created_at
      from public.user_duplicates
      on conflict (user_id, sticker_id) do update
        set status = 'duplicate', listing_type = excluded.listing_type, price = excluded.price, note = excluded.note;
    elsif v_has_for_sale then
      -- 0006_marketplace.sql never ran: derive listing_type from the legacy
      -- `for_sale` boolean exactly as 0006 itself would have (true -> 'both',
      -- false -> 'trade'); there is no price column yet in this shape.
      insert into public.user_stickers (user_id, sticker_id, status, listing_type, note, created_at)
      select user_id, sticker_id, 'duplicate', case when for_sale then 'both' else 'trade' end, note, created_at
      from public.user_duplicates
      on conflict (user_id, sticker_id) do update
        set status = 'duplicate', listing_type = excluded.listing_type, note = excluded.note;
    else
      -- Neither column present - shouldn't happen given 0001_schema.sql
      -- always creates `for_sale`, but handled defensively rather than
      -- failing the whole migration.
      insert into public.user_stickers (user_id, sticker_id, status, listing_type, note, created_at)
      select user_id, sticker_id, 'duplicate', 'trade', note, created_at
      from public.user_duplicates
      on conflict (user_id, sticker_id) do update
        set status = 'duplicate';
    end if;
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'user_missing'
  ) then
    insert into public.user_stickers (user_id, sticker_id, status, created_at)
    select user_id, sticker_id, 'missing', created_at
    from public.user_missing
    on conflict (user_id, sticker_id) do nothing;
  end if;
end $$;

drop table if exists public.user_duplicates cascade;
drop table if exists public.user_missing cascade;

-- =========================================================================
-- 4) app_settings + catalog admin: the old flat "total_stickers" RPC no
--    longer makes sense (the catalog is now team-based) - replace it with
--    an admin_add_team() helper that adds a team and its 20 stickers in one
--    transaction, and keep total_stickers as a simple derived count.
-- =========================================================================
drop function if exists public.generate_sticker_range(integer);

create or replace function public.admin_add_team(
  p_code text,
  p_name_he text,
  p_flag_emoji text,
  p_sort_order integer default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := upper(trim(p_code));
  v_sort_order integer;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'only admins may add teams';
  end if;

  if v_code !~ '^[A-Z]{3}$' then
    raise exception 'team code must be exactly 3 letters (e.g. GER, FRA)';
  end if;

  if p_name_he is null or trim(p_name_he) = '' then
    raise exception 'team name is required';
  end if;

  v_sort_order := coalesce(p_sort_order, (select coalesce(max(sort_order), 0) + 1 from public.teams));

  insert into public.teams (code, name_he, flag_emoji, sort_order)
  values (v_code, trim(p_name_he), coalesce(nullif(trim(p_flag_emoji), ''), '🏳️'), v_sort_order);

  insert into public.stickers (team_code, number, code)
  select v_code, gs.n, v_code || '-' || gs.n
  from generate_series(1, 20) as gs(n)
  on conflict (team_code, number) do nothing;

  update public.app_settings
  set total_stickers = (select count(*) from public.stickers)
  where id = true;
end;
$$;

grant execute on function public.admin_add_team(text, text, text, integer) to authenticated;

update public.app_settings
set total_stickers = (select count(*) from public.stickers),
    set_name = 'אלבום שאשות'
where id = true;

-- =========================================================================
-- 5) SCANNER: the AI Scanner now has a single mode (photograph sticker
--    backs, showing "TEAMCODE number" in a corner) instead of the old
--    duplicates/album distinction - widen the check constraint to allow it
--    while keeping old rows (if any) valid for audit history.
--
--    `scan_events` is created by 0007_hardening.sql - guarded with
--    `IF EXISTS` in case a project's migration history stalled before that
--    one ever ran (this table is purely a rate-limit/audit log, not
--    required for anything else in this migration).
-- =========================================================================
alter table if exists public.scan_events drop constraint if exists scan_events_mode_check;

do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'scan_events') then
    alter table public.scan_events add constraint scan_events_mode_check
      check (mode in ('duplicates', 'album', 'sticker_backs'));
  end if;
end $$;
