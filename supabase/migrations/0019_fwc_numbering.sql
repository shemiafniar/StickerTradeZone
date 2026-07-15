-- Shashot - FWC special numbering (0-19 instead of every ordinary team's 1-20)
--
-- FWC ("FIFA World Cup" bonus sticker set) already exists in production -
-- it was added by the site administrator through Admin area -> Sticker
-- Catalog (the admin_add_team() RPC below), exactly like any other team,
-- which means it was created with the *same* 1-20 numbering every ordinary
-- team gets. The only actual requirement here is numbering: FWC's 20
-- stickers should be numbered 0-19, not 1-20.
--
-- Confirmed stored format before writing this migration (matches every
-- other team - see 0011_shashot_teams.sql): `stickers.code` is always
-- exactly `team_code || '-' || number` with the number *unpadded* (e.g.
-- "GER-1", "GER-20", never "GER-01") - so FWC's existing rows are
-- "FWC-1".."FWC-20", and this migration renumbers them to "FWC-0".."FWC-19"
-- using that same unpadded convention, never introducing zero-padding.
--
-- This is a pure renumbering, not a recreate:
--   - every existing FWC sticker's `id` (primary key) is preserved -
--     only `number` and `code` change on the existing rows;
--   - every user_stickers row referencing an FWC sticker keeps pointing at
--     the exact same sticker_id, now just reporting a renumbered code
--     when joined/displayed - no user's collection data is touched;
--   - every trade_request_items row referencing an FWC sticker is
--     likewise unaffected (same reasoning);
--   - FWC still has exactly 20 stickers before and after (0-19 is 20
--     values, same as 1-20) - no progress/completion total changes.
--
-- Idempotent: the shift only runs once - see the `exists (... number = 20)`
-- guard below, which is only ever true for an *unshifted* FWC (or a
-- pre-existing team named FWC seeded some other way with the old 1-20
-- range). A fresh database with no FWC team, or one where FWC has already
-- been renumbered by a previous run of this file, is a safe no-op.

do $$
begin
  if exists (select 1 from public.stickers where team_code = 'FWC' and number = 20) then
    -- Drop and recreate the constraints this UPDATE touches rather than
    -- relying on Postgres's per-row unique-check timing during a
    -- shift-by-one across every row in one statement - this exact
    -- drop-then-update-then-recreate sequence is the same pattern
    -- 0011_shashot_teams.sql already uses for the same reason.
    alter table public.stickers drop constraint if exists stickers_team_number_key;
    alter table public.stickers drop constraint if exists stickers_code_key;
    alter table public.stickers drop constraint if exists stickers_number_range;

    update public.stickers
    set number = number - 1,
        code = 'FWC-' || (number - 1)
    where team_code = 'FWC';

    alter table public.stickers add constraint stickers_team_number_key unique (team_code, number);
    alter table public.stickers add constraint stickers_code_key unique (code);
  end if;
end $$;

-- Team-specific numbering rule: FWC accepts 0-19, every ordinary team
-- keeps the existing 1-20 range. Re-added unconditionally (not only
-- inside the `do` block above) so a fresh database - which never enters
-- that block at all, since it has no FWC rows yet - still gets the
-- correct, permanent constraint from this migration onward.
alter table public.stickers drop constraint if exists stickers_number_range;
alter table public.stickers add constraint stickers_number_range
  check (
    (team_code = 'FWC' and number between 0 and 19)
    or (team_code <> 'FWC' and number between 1 and 20)
  );

-- Going forward, any *new* FWC stickers created through the same admin
-- flow (e.g. if the catalog is ever rebuilt) must also land in 0-19, not
-- 1-20 - on conflict (team_code, number) do nothing already makes this
-- safe to run against the now-renumbered existing rows above.
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
  v_start integer;
  v_end integer;
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

  if v_code = 'FWC' then
    v_start := 0;
    v_end := 19;
  else
    v_start := 1;
    v_end := 20;
  end if;

  insert into public.teams (code, name_he, flag_emoji, sort_order)
  values (v_code, trim(p_name_he), coalesce(nullif(trim(p_flag_emoji), ''), '🏳️'), v_sort_order);

  insert into public.stickers (team_code, number, code)
  select v_code, gs.n, v_code || '-' || gs.n
  from generate_series(v_start, v_end) as gs(n)
  on conflict (team_code, number) do nothing;

  update public.app_settings
  set total_stickers = (select count(*) from public.stickers)
  where id = true;
end;
$$;
