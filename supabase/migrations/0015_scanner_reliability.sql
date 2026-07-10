-- Shashot - AI Scanner reliability hardening
--
-- Investigating "the scanner fails after every uploaded image" turned up
-- two issues:
--
--   1. THE ACTUAL ROOT CAUSE (fixed in application code, not here):
--      next.config.ts never configured `serverActions.bodySizeLimit`, so
--      Next.js's default 1MB Server Action request body cap rejected
--      virtually every real phone photo before scanStickerBacksAction's own
--      code ever ran. See next.config.ts and the README's "Sticker Scanner
--      reliability" section.
--
--   2. A SECONDARY, DEFENSIVE CONCERN specific to this database: this
--      project has a documented history (0011_shashot_teams.sql,
--      0012_worldcup2026_teams.sql) of individual migrations not reliably
--      reaching production before the CI/CD pipeline in
--      .github/workflows/database.yml was introduced. `scan_events.mode`'s
--      check constraint was widened by 0011 to allow the scanner's current
--      'sticker_backs' value (originally it only allowed the old
--      'duplicates'/'album' modes) - if a given production database
--      somehow still has the pre-0011 constraint, every scan attempt would
--      fail with a Postgres check-constraint violation on the
--      `insert into scan_events (mode, ...)` call in
--      checkAndLogScan() (src/lib/actions/scanner.ts), which is exactly
--      the kind of failure that used to escape as this app's generic error
--      boundary before this PR's error-handling pass.
--
-- This migration just re-asserts the correct, current constraint
-- idempotently - a no-op if 0011 already applied cleanly, a real fix if it
-- somehow didn't.

alter table if exists public.scan_events drop constraint if exists scan_events_mode_check;

do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'scan_events') then
    alter table public.scan_events add constraint scan_events_mode_check
      check (mode in ('duplicates', 'album', 'sticker_backs'));
  end if;
end $$;
