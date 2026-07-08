-- Shashot - update participating teams to the official FIFA World Cup 2026
-- 48-team roster, with real flags
--
-- Replaces the placeholder 32-team roster seeded by 0011_shashot_teams.sql
-- with the confirmed 48 teams (official FIFA three-letter codes) and adds
-- `flag_icon` (an ISO 3166-1 alpha-2 code, or `gb-eng`/`gb-sct` for
-- England/Scotland) so the UI can render a real, reliably-rendering SVG
-- flag via the `flag-icons` library instead of a Unicode flag emoji -
-- Unicode flag emoji render as plain two-letter text on many real-world
-- systems (older Windows, most Linux desktops) that lack a font with
-- combined flag glyphs, which is why the UI was showing "IL"/"BR"/"FR"
-- instead of an actual flag image. `flag_emoji` is kept as a fallback for
-- any custom team an admin adds beyond this official roster (via
-- admin_add_team()), since there's no reliable way to infer an ISO code
-- for an arbitrary admin-entered team.
--
-- Data preservation: 25 team codes are unchanged between the old and new
-- rosters (e.g. ARG, BRA, FRA, GER, ...) - their `stickers` and any
-- `user_stickers`/`trade_request_items` rows are never touched, since
-- nothing about those rows needs to change. The 7 codes being removed
-- (ISR, ITA, CMR, NGA, POL, DEN, SRB) are deleted along with their
-- stickers - there is no other team for a user's marks on a *removed*
-- team's stickers to sensibly move to, so those specific rows are removed
-- via the existing ON DELETE CASCADE foreign keys (stickers -> user_stickers,
-- stickers -> trade_request_items). The 23 new codes get their 20 stickers
-- auto-generated, exactly like admin_add_team() does for a manually-added
-- team.
--
-- Idempotent: safe to re-run - team metadata is upserted, stickers are
-- only inserted if missing, and the removal step is a no-op once the
-- old teams are already gone.

-- =========================================================================
-- 0) Add the flag_icon column (nullable - custom admin-added teams may not
--    have a known ISO/flag-icons code).
-- =========================================================================
alter table public.teams add column if not exists flag_icon text;

-- =========================================================================
-- 1) Upsert the 48 official teams. Fixes name/flag/order on teams that
--    already existed under the old roster too (e.g. England's flag_emoji
--    is corrected here from a generic black-flag placeholder to the real
--    Unicode England subdivision flag, and now also gets flag_icon =
--    'gb-eng' for reliable SVG rendering).
-- =========================================================================
insert into public.teams (code, name_he, flag_emoji, flag_icon, sort_order) values
  ('ALG', 'אלג׳יריה', '🇩🇿', 'dz', 1),
  ('ARG', 'ארגנטינה', '🇦🇷', 'ar', 2),
  ('AUS', 'אוסטרליה', '🇦🇺', 'au', 3),
  ('AUT', 'אוסטריה', '🇦🇹', 'at', 4),
  ('BEL', 'בלגיה', '🇧🇪', 'be', 5),
  ('BIH', 'בוסניה והרצגובינה', '🇧🇦', 'ba', 6),
  ('BRA', 'ברזיל', '🇧🇷', 'br', 7),
  ('CPV', 'קייפ ורדה', '🇨🇻', 'cv', 8),
  ('CAN', 'קנדה', '🇨🇦', 'ca', 9),
  ('COL', 'קולומביה', '🇨🇴', 'co', 10),
  ('COD', 'קונגו הדמוקרטית', '🇨🇩', 'cd', 11),
  ('CIV', 'חוף השנהב', '🇨🇮', 'ci', 12),
  ('CRO', 'קרואטיה', '🇭🇷', 'hr', 13),
  ('CZE', 'צ׳כיה', '🇨🇿', 'cz', 14),
  ('CUW', 'קוראסאו', '🇨🇼', 'cw', 15),
  ('ECU', 'אקוודור', '🇪🇨', 'ec', 16),
  ('EGY', 'מצרים', '🇪🇬', 'eg', 17),
  ('ENG', 'אנגליה', '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'gb-eng', 18),
  ('FRA', 'צרפת', '🇫🇷', 'fr', 19),
  ('GER', 'גרמניה', '🇩🇪', 'de', 20),
  ('GHA', 'גאנה', '🇬🇭', 'gh', 21),
  ('HAI', 'האיטי', '🇭🇹', 'ht', 22),
  ('IRN', 'איראן', '🇮🇷', 'ir', 23),
  ('IRQ', 'עיראק', '🇮🇶', 'iq', 24),
  ('JPN', 'יפן', '🇯🇵', 'jp', 25),
  ('JOR', 'ירדן', '🇯🇴', 'jo', 26),
  ('KOR', 'דרום קוריאה', '🇰🇷', 'kr', 27),
  ('MEX', 'מקסיקו', '🇲🇽', 'mx', 28),
  ('MAR', 'מרוקו', '🇲🇦', 'ma', 29),
  ('NED', 'הולנד', '🇳🇱', 'nl', 30),
  ('NZL', 'ניו זילנד', '🇳🇿', 'nz', 31),
  ('NOR', 'נורווגיה', '🇳🇴', 'no', 32),
  ('PAN', 'פנמה', '🇵🇦', 'pa', 33),
  ('PAR', 'פרגוואי', '🇵🇾', 'py', 34),
  ('POR', 'פורטוגל', '🇵🇹', 'pt', 35),
  ('QAT', 'קטאר', '🇶🇦', 'qa', 36),
  ('KSA', 'ערב הסעודית', '🇸🇦', 'sa', 37),
  ('SCO', 'סקוטלנד', '🏴󠁧󠁢󠁳󠁣󠁴󠁿', 'gb-sct', 38),
  ('SEN', 'סנגל', '🇸🇳', 'sn', 39),
  ('RSA', 'דרום אפריקה', '🇿🇦', 'za', 40),
  ('ESP', 'ספרד', '🇪🇸', 'es', 41),
  ('SWE', 'שוודיה', '🇸🇪', 'se', 42),
  ('SUI', 'שוויץ', '🇨🇭', 'ch', 43),
  ('TUN', 'תוניסיה', '🇹🇳', 'tn', 44),
  ('TUR', 'טורקיה', '🇹🇷', 'tr', 45),
  ('USA', 'ארצות הברית', '🇺🇸', 'us', 46),
  ('URU', 'אורוגוואי', '🇺🇾', 'uy', 47),
  ('UZB', 'אוזבקיסטן', '🇺🇿', 'uz', 48)
on conflict (code) do update
  set name_he = excluded.name_he,
      flag_emoji = excluded.flag_emoji,
      flag_icon = excluded.flag_icon,
      sort_order = excluded.sort_order;

-- =========================================================================
-- 2) Remove teams no longer in the official list. Stickers must be deleted
--    before their team row (stickers.team_code -> teams.code has no
--    ON DELETE CASCADE by design, to avoid ever silently losing a team's
--    catalog via an unrelated bug) - deleting the stickers here cascades
--    to any user_stickers/trade_request_items rows referencing them via
--    their own ON DELETE CASCADE foreign keys.
-- =========================================================================
delete from public.stickers
where team_code not in (
  'ALG', 'ARG', 'AUS', 'AUT', 'BEL', 'BIH', 'BRA', 'CPV',
  'CAN', 'COL', 'COD', 'CIV', 'CRO', 'CZE', 'CUW', 'ECU',
  'EGY', 'ENG', 'FRA', 'GER', 'GHA', 'HAI', 'IRN', 'IRQ',
  'JPN', 'JOR', 'KOR', 'MEX', 'MAR', 'NED', 'NZL', 'NOR',
  'PAN', 'PAR', 'POR', 'QAT', 'KSA', 'SCO', 'SEN', 'RSA',
  'ESP', 'SWE', 'SUI', 'TUN', 'TUR', 'USA', 'URU', 'UZB'
);

delete from public.teams
where code not in (
  'ALG', 'ARG', 'AUS', 'AUT', 'BEL', 'BIH', 'BRA', 'CPV',
  'CAN', 'COL', 'COD', 'CIV', 'CRO', 'CZE', 'CUW', 'ECU',
  'EGY', 'ENG', 'FRA', 'GER', 'GHA', 'HAI', 'IRN', 'IRQ',
  'JPN', 'JOR', 'KOR', 'MEX', 'MAR', 'NED', 'NZL', 'NOR',
  'PAN', 'PAR', 'POR', 'QAT', 'KSA', 'SCO', 'SEN', 'RSA',
  'ESP', 'SWE', 'SUI', 'TUN', 'TUR', 'USA', 'URU', 'UZB'
);

-- =========================================================================
-- 3) Guarantee every one of the 48 teams has exactly 20 stickers,
--    regardless of whether it's a kept, newly-added, or freshly-seeded
--    team on this project.
-- =========================================================================
insert into public.stickers (team_code, number, code)
select t.code, gs.n, t.code || '-' || gs.n
from public.teams t
cross join generate_series(1, 20) as gs(n)
on conflict (team_code, number) do nothing;

-- =========================================================================
-- 4) Keep app_settings.total_stickers accurate (48 teams x 20 = 960).
-- =========================================================================
update public.app_settings
set total_stickers = (select count(*) from public.stickers)
where id = true;
