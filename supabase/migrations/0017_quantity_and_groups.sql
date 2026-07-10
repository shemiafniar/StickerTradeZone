-- Shashot - quantity-based duplicate tracking + World Cup group ordering
--
-- Two independent but co-released schema changes:
--
--   1) TEAMS: adds explicit `group_name`/`group_order`/`team_order` columns
--      so teams display in official World Cup 2026 group order (A..L, then
--      official position within each group) instead of the current flat
--      `sort_order` (which is just a roughly-alphabetical roster order with
--      no group concept at all). `sort_order` itself is left untouched -
--      nothing currently reads it in a way this migration needs to change,
--      and removing it is unnecessary risk for zero benefit.
--
--   2) USER_STICKERS: replaces the 3-state `status` enum ('have' / 'duplicate'
--      / 'missing') with a `quantity integer` column - the actual number of
--      copies a collector owns. This directly represents "how many spares do
--      I have", which the enum never could (a second, third, fourth copy of
--      the same sticker was indistinguishable from a first one under
--      `status = 'duplicate'`). See the "Quantity semantics" comment below
--      for the exact mapping.
--
-- Both changes are idempotent - every statement uses `if not exists`/
-- `if exists`/`on conflict` guards, and the data migration below is written
-- to be safe to re-run (it only touches rows while the old `status` column
-- still exists, and is a no-op once that column is gone).

-- =========================================================================
-- PART 1: Team group/order columns
-- =========================================================================

alter table public.teams add column if not exists group_name text;
alter table public.teams add column if not exists group_order integer not null default 99;
alter table public.teams add column if not exists team_order integer not null default 0;

comment on column public.teams.group_name is 'World Cup group letter (A-L), null for a custom team added beyond the official 48 (sorts last via group_order default 99).';
comment on column public.teams.group_order is 'Numeric group rank for stable ordering: A=1, B=2, ... L=12. Custom/unassigned teams default to 99 (sort last).';
comment on column public.teams.team_order is 'Official position within the team''s group (1-4). Falls back to insertion order (0) for teams without an explicit position.';

-- Official 2026 FIFA World Cup group draw (announced December 2025),
-- mapped onto this project's existing 3-letter team codes - see
-- 0012_worldcup2026_teams.sql for the canonical code list. Upserts by code,
-- so this is safe to re-run and has no effect on teams outside this list
-- (e.g. any custom team an admin added via admin_add_team(), which keeps
-- its default group_order = 99).
update public.teams set group_name = g.group_name, group_order = g.group_order, team_order = g.team_order
from (values
  -- Group A
  ('MEX', 'A', 1, 1), ('RSA', 'A', 1, 2), ('KOR', 'A', 1, 3), ('CZE', 'A', 1, 4),
  -- Group B
  ('CAN', 'B', 2, 1), ('BIH', 'B', 2, 2), ('QAT', 'B', 2, 3), ('SUI', 'B', 2, 4),
  -- Group C
  ('BRA', 'C', 3, 1), ('MAR', 'C', 3, 2), ('HAI', 'C', 3, 3), ('SCO', 'C', 3, 4),
  -- Group D
  ('USA', 'D', 4, 1), ('PAR', 'D', 4, 2), ('AUS', 'D', 4, 3), ('TUR', 'D', 4, 4),
  -- Group E
  ('GER', 'E', 5, 1), ('CIV', 'E', 5, 2), ('ECU', 'E', 5, 3), ('CUW', 'E', 5, 4),
  -- Group F
  ('NED', 'F', 6, 1), ('JPN', 'F', 6, 2), ('TUN', 'F', 6, 3), ('SWE', 'F', 6, 4),
  -- Group G
  ('BEL', 'G', 7, 1), ('EGY', 'G', 7, 2), ('IRN', 'G', 7, 3), ('NZL', 'G', 7, 4),
  -- Group H
  ('ESP', 'H', 8, 1), ('CPV', 'H', 8, 2), ('KSA', 'H', 8, 3), ('URU', 'H', 8, 4),
  -- Group I
  ('FRA', 'I', 9, 1), ('SEN', 'I', 9, 2), ('NOR', 'I', 9, 3), ('IRQ', 'I', 9, 4),
  -- Group J
  ('ARG', 'J', 10, 1), ('ALG', 'J', 10, 2), ('AUT', 'J', 10, 3), ('JOR', 'J', 10, 4),
  -- Group K
  ('POR', 'K', 11, 1), ('COD', 'K', 11, 2), ('UZB', 'K', 11, 3), ('COL', 'K', 11, 4),
  -- Group L
  ('ENG', 'L', 12, 1), ('CRO', 'L', 12, 2), ('GHA', 'L', 12, 3), ('PAN', 'L', 12, 4)
) as g (code, group_name, group_order, team_order)
where public.teams.code = g.code;

-- admin_add_team() needs to keep working for any team outside the official
-- 48 (its defaults - group_name null, group_order 99 - already sort a new
-- custom team after every real group, so no change to the function body is
-- required here; this is just documented for anyone reading this migration
-- looking for why admin_add_team() doesn't set these new columns itself).

-- =========================================================================
-- PART 2: user_stickers quantity model
-- =========================================================================
--
-- Quantity semantics (the actual product rule, enforced by the app - see
-- src/lib/collectionStatus.ts for the single canonical implementation used
-- everywhere: collection pages, matching, trades, and admin stats):
--   - no row at all       = unmarked ("none", gray in the grid UI) - unchanged
--   - row exists, quantity = 0  = missing (red) - an explicit "I need this" mark
--   - row exists, quantity = 1  = owned, no duplicate available (green)
--   - row exists, quantity >= 2 = owned, with (quantity - 1) duplicates available (blue,
--                                  shows the duplicate count)
--
-- Data preservation mapping from the old `status` enum (exact, per the
-- product requirement - "existing duplicate records must remain duplicate,
-- existing owned-only records become quantity 1, existing missing records
-- become quantity 0, no data is lost"):
--   status = 'missing'   -> quantity = 0   (row kept - "missing" was an
--                                            explicit mark, distinct from no
--                                            row at all, exactly as before)
--   status = 'have'      -> quantity = 1
--   status = 'duplicate' -> quantity = 2   (guarantees at least 1 available
--                                            duplicate post-migration, since
--                                            availableDuplicates = quantity - 1)

alter table public.user_stickers add column if not exists quantity integer;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'user_stickers' and column_name = 'status'
  ) then
    update public.user_stickers
    set quantity = case status
      when 'missing' then 0
      when 'have' then 1
      when 'duplicate' then 2
      else coalesce(quantity, 0)
    end
    where quantity is null;
  end if;
end $$;

-- Any row that somehow still has a null quantity at this point (shouldn't
-- happen given the branch above covers every valid old status value, but
-- defensive against a fresh install where `status` never existed at all -
-- e.g. this migration re-run after a previous run already dropped it, or a
-- brand new database created after this migration already dropped it from
-- the schema) defaults to 0 rather than leaving quantity nullable.
update public.user_stickers set quantity = 0 where quantity is null;

alter table public.user_stickers alter column quantity set not null;
alter table public.user_stickers alter column quantity set default 0;
alter table public.user_stickers drop constraint if exists user_stickers_quantity_check;
alter table public.user_stickers add constraint user_stickers_quantity_check check (quantity >= 0);

alter table public.user_stickers drop constraint if exists user_stickers_status_check;
alter table public.user_stickers drop column if exists status;

comment on table public.user_stickers is
  'One row per (user, sticker) the user has marked. quantity: 0 = missing (explicit), 1 = owned/no duplicate, 2+ = owned with (quantity-1) duplicates available. No row = unmarked (gray).';
comment on column public.user_stickers.quantity is 'Total copies owned. 0 = explicitly missing. availableDuplicates = max(0, quantity - 1) - see src/lib/collectionStatus.ts.';

drop index if exists idx_user_stickers_status;
create index if not exists idx_user_stickers_quantity on public.user_stickers (quantity);

-- =========================================================================
-- PART 3: atomic, quantity-safe trade completion
-- =========================================================================
--
-- Replaces a plain `update trade_requests set status = 'completed'` (which
-- never touched user_stickers at all - accepting/completing a trade had no
-- effect on either party's actual collection) with a single
-- SECURITY DEFINER function that, in one transaction:
--   1. Re-validates the caller is a participant and the trade is currently
--      'accepted' (the only valid predecessor state for completion, per
--      validate_trade_status_transition() in 0007_hardening.sql).
--   2. For every trade_request_item, verifies the giving side currently has
--      enough *available duplicates* (quantity - 1 >= item.quantity, i.e.
--      they always keep their own base copy) and, if so, atomically moves
--      that many copies from the giver to the receiver.
--   3. Updates trade_requests.status = 'completed' - the existing
--      validate_trade_status_transition() trigger still fires on this
--      UPDATE and re-checks the exact same authorization/transition rules
--      independently, so this function doesn't weaken that guard, it adds
--      to it.
-- If ANY item fails its availability check, the whole function raises an
-- exception and Postgres rolls back everything (the trade is *not* marked
-- completed, and no quantities are touched) - no partial trades.
--
-- `for update` row locks on both the trade and each user_stickers row
-- prevent two concurrent completions (or a completion racing a grid edit)
-- from double-spending the same duplicate.
create or replace function public.complete_trade_request(p_trade_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trade record;
  v_caller uuid := auth.uid();
  v_item record;
  v_giver uuid;
  v_receiver uuid;
  v_giver_quantity integer;
begin
  select * into v_trade from public.trade_requests where id = p_trade_id for update;
  if v_trade is null then
    raise exception 'trade request not found';
  end if;

  if v_caller is null or (v_caller <> v_trade.from_user_id and v_caller <> v_trade.to_user_id) then
    raise exception 'only a trade participant may complete this trade';
  end if;

  if v_trade.status <> 'accepted' then
    raise exception 'invalid trade status transition from % to completed', v_trade.status;
  end if;

  for v_item in
    select * from public.trade_request_items where trade_request_id = p_trade_id
  loop
    if v_item.direction = 'give' then
      v_giver := v_trade.from_user_id;
      v_receiver := v_trade.to_user_id;
    else
      v_giver := v_trade.to_user_id;
      v_receiver := v_trade.from_user_id;
    end if;

    select quantity into v_giver_quantity
    from public.user_stickers
    where user_id = v_giver and sticker_id = v_item.sticker_id
    for update;

    if v_giver_quantity is null or v_giver_quantity < v_item.quantity + 1 then
      raise exception 'insufficient available duplicates for sticker % (has %, needs to give %, must keep at least 1)',
        v_item.sticker_id, coalesce(v_giver_quantity, 0), v_item.quantity;
    end if;

    update public.user_stickers
    set quantity = quantity - v_item.quantity
    where user_id = v_giver and sticker_id = v_item.sticker_id;

    insert into public.user_stickers (user_id, sticker_id, quantity)
    values (v_receiver, v_item.sticker_id, v_item.quantity)
    on conflict (user_id, sticker_id) do update
      set quantity = public.user_stickers.quantity + excluded.quantity;
  end loop;

  update public.trade_requests set status = 'completed' where id = p_trade_id;
end;
$$;

grant execute on function public.complete_trade_request(uuid) to authenticated;

-- =========================================================================
-- PART 4: onboarding / product-journey tracking columns
-- =========================================================================
-- Nullable timestamps, set once (first time only) - back the dashboard
-- onboarding checklist (see src/components/dashboard/OnboardingChecklist.tsx)
-- and double as the "matches_first_view"/"first_trade_started" analytics
-- signals until/unless a real event-tracking table is introduced (see
-- README's "Product analytics" section for why that's out of scope here).
alter table public.profiles add column if not exists onboarding_completed_at timestamptz;
alter table public.profiles add column if not exists matches_first_viewed_at timestamptz;
alter table public.profiles add column if not exists first_trade_started_at timestamptz;

comment on column public.profiles.onboarding_completed_at is 'Set once the first-time onboarding modal is completed or dismissed - never shown again after this is set.';
comment on column public.profiles.matches_first_viewed_at is 'Set the first time this user loads /dashboard/matches - backs the onboarding checklist + a lightweight analytics signal.';
comment on column public.profiles.first_trade_started_at is 'Set the first time this user successfully creates a trade request - backs the onboarding checklist + a lightweight analytics signal.';
