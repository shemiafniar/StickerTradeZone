-- Shashot - corrective migration: actually renumber existing FWC stickers
--
-- ROOT CAUSE: 0019_fwc_numbering.sql was written and verified correct (by
-- hand, against a simulated drifted database with existing FWC rows plus
-- linked user_stickers/trade_request_items - see its own comments and
-- README.md's "FWC's special sticker numbering" section), but it was
-- **never actually applied to the real production database**. Production
-- was queried directly and confirmed to still show:
--
--   select id, team_code, number, code from stickers
--   where upper(team_code) = 'FWC' order by number;
--   -- -> number 1 through 20, unchanged.
--
-- This is not a bug in 0019's SQL logic - `deploy-migrations` (the
-- `push`-triggered job in .github/workflows/database.yml, added specifically
-- so migrations would stop requiring a manual SQL Editor paste - see that
-- workflow file's own header comment for the history of *why*) has failed
-- on *every single* merge to `main` since it was introduced (confirmed via
-- `gh run list --workflow=database.yml`: 7 consecutive `push`-triggered
-- failures, every one failing at the `supabase link` step with "Access
-- token not provided" - i.e. `SUPABASE_ACCESS_TOKEN`/`SUPABASE_PROJECT_ID`
-- were empty in that job every time). So 0018 and 0019 both merged to
-- `main` in this repo, but neither one has actually reached production
-- through that pipeline - the same class of gap the pipeline was built to
-- close, just not yet fully unblocked (see README.md's "Automated database
-- migrations" section for the required one-time GitHub secrets setup).
--
-- Per explicit instruction, 0019 itself is left untouched (it may already
-- be recorded as "applied" in this project's migration-tracking table even
-- though its effect never landed, and editing an already-tracked migration
-- file is exactly the kind of drift that caused the *original* incident
-- this whole CI pipeline exists to prevent - see 0011_shashot_teams.sql's
-- own history). This migration is a new, independent, idempotent
-- correction that produces the right end state regardless of whether 0019
-- ever partially ran:
--
--   - if 0019 never ran at all (the confirmed production state): this
--     migration does everything 0019 would have - renumbers FWC, adds the
--     FWC-aware CHECK constraint, redefines admin_add_team().
--   - if 0019 somehow did already renumber FWC (not the case in
--     production today, but handled defensively): the `exists (...)` guard
--     below is false, so the renumbering step is skipped, while the
--     constraint/function statements are safely idempotent no-ops either
--     way (drop-if-exists + create-or-replace).
--
-- Every requirement from the corrective request is satisfied:
--   1. FWC rows identified by team_code = 'FWC' (case-insensitively, via
--      upper(team_code), matching the exact diagnostic query used to
--      confirm this bug).
--   2. Every sticker.id is preserved - only number/code are updated on the
--      existing rows, never deleted/recreated.
--   3-4. Renumbered in place, 1->0 .. 20->19 (number = number - 1); every
--      user_stickers/trade_request_items row keeps referencing the same
--      sticker_id, so it stays attached with zero data loss.
--   5. code is rebuilt as 'FWC-' || new_number - the same unpadded
--      'TEAMCODE-number' convention every sticker in this project uses
--      (confirmed against 0011_shashot_teams.sql; never zero-padded).
--   6. Unique-constraint collisions are avoided by dropping
--      stickers_team_number_key/stickers_code_key *before* the shift and
--      recreating them *after* - so Postgres never evaluates uniqueness
--      mid-shift while old and new numbers briefly overlap in-flight.
--   7. Ordinary teams are never touched - every statement below is scoped
--      to team_code = 'FWC' (or, for the CHECK constraint, explicitly
--      preserves 1-20 for `team_code <> 'FWC'`).
--   8. admin_add_team() is redefined so any *future* FWC creation lands in
--      0-19 directly; every other team keeps 1-20.
--   9. Idempotent: guarded by `exists (select 1 ... number = 20)`, which is
--      only ever true for an unshifted FWC - a no-op on re-run.

do $$
begin
  if exists (
    select 1 from public.stickers where upper(team_code) = 'FWC' and number = 20
  ) then
    -- Drop and recreate the constraints this UPDATE touches, so Postgres
    -- never has to reconcile a mid-statement uniqueness check while a
    -- shift-by-one is in flight - avoids any unique-constraint collision
    -- concern entirely, rather than relying on statement-level MVCC
    -- semantics for a "rotate values down by one" update.
    alter table public.stickers drop constraint if exists stickers_team_number_key;
    alter table public.stickers drop constraint if exists stickers_code_key;
    alter table public.stickers drop constraint if exists stickers_number_range;

    update public.stickers
    set number = number - 1,
        code = 'FWC-' || (number - 1)
    where upper(team_code) = 'FWC';

    alter table public.stickers add constraint stickers_team_number_key unique (team_code, number);
    alter table public.stickers add constraint stickers_code_key unique (code);
  end if;
end $$;

-- Re-added unconditionally (not only inside the `do` block above), so this
-- migration alone brings a database that never ran 0019 at all fully up to
-- the correct, permanent constraint - FWC 0-19, every ordinary team 1-20.
alter table public.stickers drop constraint if exists stickers_number_range;
alter table public.stickers add constraint stickers_number_range
  check (
    (team_code = 'FWC' and number between 0 and 19)
    or (team_code <> 'FWC' and number between 1 and 20)
  );

-- Idempotent re-statement of 0019's admin_add_team() redefinition - safe
-- even if 0019's own copy of this already applied (create or replace is a
-- pure no-op when the function body is unchanged).
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
