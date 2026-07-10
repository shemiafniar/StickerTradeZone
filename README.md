# Shashot (שאשות) ⚽📖

**אזור החלפת מדבקות לאספני כדורגל בישראל** - a fast, mobile-first, RTL Hebrew web app that helps
football sticker collectors track their collection visually (like a real sticker album) and find
nearby people to trade or sell with.

> **Not affiliated with Panini, FIFA, or any official sticker brand.** This is an independent,
> community-built collector trade zone. See the footer disclaimer shown on every page.

This README covers the current release. The product was originally named "Sticker Trade IL" and
managed collections via typed sticker-number lists; it has since been renamed **Shashot** and its
collection UX rebuilt from the ground up around a visual, tap-to-mark album grid - see
[Visual collection model](#visual-collection-model-teams--sticker-codes) below for the full
redesign, and git history / earlier PRs for the prior MVP, Beta, QA/hardening, and production
bootstrap passes.

## Tech stack

- [Next.js 16](https://nextjs.org/) (App Router, Server Components, Server Actions) + TypeScript
- [Tailwind CSS v4](https://tailwindcss.com/)
- [Supabase](https://supabase.com/) (Postgres, Auth, Row Level Security, Realtime)
- GitHub Actions CI/CD: automatically tests every migration against a throwaway Postgres on PRs, and
  deploys new migrations to production on merge to `main` - see
  [Automated database migrations](#automated-database-migrations-cicd)
- Hebrew RTL UI (`Heebo` font), mobile-first design
- Real national flags via [`flag-icons`](https://github.com/lipis/flag-icons) (SVG, not Unicode emoji
  - see [Visual collection model](#visual-collection-model-teams--sticker-codes))
- Interactive matches map: [Leaflet](https://leafletjs.com/) + [OpenStreetMap](https://www.openstreetmap.org/)
  tiles (free, no API key) via [`react-leaflet`](https://react-leaflet.js.org/) - see
  [Matches map](#matches-map-leaflet--openstreetmap)
- Pluggable Vision/OCR provider for the AI Sticker Scanner (mock by default, OpenAI Vision ready to
  enable)

## Features

### Collection management (visual album)

- **Visual, tap-to-mark album grid** - "My Collection" shows every participating national team as a
  card (flag, Hebrew name, 3-letter code); tapping one opens a 20-sticker grid. Tapping a sticker
  instantly cycles gray (unmarked) → green (have) → blue (duplicate/tradeable) → red (missing) →
  gray, with no modal dialogs, plus "Mark all as owned" / "Clear all" quick actions and an explicit
  "Save" to persist a batch of changes at once.
- Every sticker has a unique, human-readable identifier: `TEAMCODE-number` (e.g. `GER-2`, `FRA-17`,
  `POR-5`) - see [Visual collection model](#visual-collection-model-teams--sticker-codes) below.
- **AI Sticker Scanner** - photograph the **backs** of several stickers at once (each back prints a
  team code + number in a corner, e.g. "GER 2") and the scanner detects and marks them all as owned
  after a quick review/confirmation screen. Ships with a fully working mock provider (no external
  dependency) and an optional OpenAI Vision provider you can enable with one env var. The scanner is
  always an optional shortcut, reached from "My Collection" and the dashboard (not its own top-level
  nav item, to keep the primary nav focused on the grid as the main workflow) - the page/route/
  component are all still fully intact, only the redundant nav link was removed.
- A separate "הכפולים שלי" (my duplicates) page lets you set marketplace details (trade/sale/both,
  price, note) for any sticker marked blue, without interrupting the tap-to-mark grid flow.

### Core

- Email/password auth (Supabase Auth) with an auto-created public profile, plus Google sign-in
- Profile: full name, city, optional neighborhood, phone/WhatsApp (only revealed after a trade is
  accepted - enforced at the database level via RLS, not just in the UI)
- Trade requests: pending → accepted/declined → completed/cancelled; contact details (incl. a
  WhatsApp deep link) are revealed only once a trade is accepted
- **Admin dashboard** (`/admin`, admin-only, protected server-side - not just hidden from the nav) -
  platform stats (users, trades, matches, location adoption), a searchable users table with a full
  profile/edit/suspend/delete view per user, a trades table with cancel/force-complete/delete
  actions, live-computed statistics (most wanted/common stickers, most active traders, trades-per-day
  and user-growth charts), a form to add new participating teams, an `admin_logs` audit trail, and a
  bug-report inbox (see the next bullet) - see [Admin dashboard](#admin-dashboard) below for the full
  breakdown.
- **Support / bug reports (תקלות ומשוב)** - a dedicated tab (`/dashboard/support`) where any
  collector can file a bug report or suggestion (subject, category, description, optional
  screenshot), captured with the reporting user's id/name/email and the current page/user-agent
  automatically. Every admin gets an email notification; admins triage everything from
  `/admin/reports` (search/filter, status, an internal note never shown to the user) - see
  [Support / bug reports](#support--bug-reports-תקלות-ומשוב) below.

### Location, chat, notifications, marketplace, sharing

- **Location-based matching** - opt-in approximate location (browser geolocation, rounded to
  ~100m before it ever leaves the device) powers real distance sorting ("500 מ׳" / "2.3 ק״מ"),
  with city/region matching kept as an automatic fallback for anyone who hasn't enabled it. Exact
  coordinates are never exposed to other users - see [Location privacy](#location-privacy) below.
- **~1,180 Israeli localities**, searchable by typing (not a giant `<select>`) - see
  [Israeli localities dataset](#israeli-localities-dataset) below for where this comes from and how
  it stays compatible with cities already stored on existing profiles.
- **Interactive matches map** - `/dashboard/matches` has a "מפה"/"רשימה" toggle; the map (Leaflet +
  OpenStreetMap, centered on Israel) plots a marker for every nearby matching collector who has
  *any* usable location info, not just precise GPS: collectors who opted into location get a marker
  at their (further-jittered) GPS position; collectors who only filled in city/neighborhood get a
  marker approximated to their city's center (also jittered, so several collectors in one city don't
  stack exactly on top of each other); collectors with neither are simply kept in the list, never
  plotted. The popup always says which kind of location it is (see
  [Location privacy](#location-privacy) below for the exact wording) - never pretending a
  city-derived estimate is precise. Clicking a marker shows the same information as a match card
  (name, city, distance when known, give/receive counts, top sticker codes, and a "שלח בקשת טרייד"
  button). The list view is never removed - it's one tab away, and is what's shown by default for
  anyone without location enabled.
- **Trade chat** - each trade request has a private, realtime 1:1 conversation (`trade_messages`),
  visible only to its two participants, with unread badges and auto-scroll.
- **Notifications** - a bell with a live unread badge, dropdown, and full history page. Notifications
  fire for new trade requests, accepted/declined trades, and new chat messages.
- **Richer marketplace** - each duplicate (blue) sticker can be listed as *trade only*, *sale only*,
  or *trade or sale*, with an optional price and note. Still no payment processing - the app only
  connects collectors.
- **Viral sharing** - native share sheet (where supported), a WhatsApp share link, and a "copy
  link" button, using the product's suggested Hebrew invite text.

## Brand assets

The finalized Shashot identity (a stylized "5"/card/soccer-ball mark in Primary Green + Primary
Blue, paired with a "SHASHOT" wordmark in Dark Navy) lives in `public/branding/`:

```
public/branding/
  logo-icon.png           Icon-only mark, transparent - used above the landing page's headline,
                             and as the source for the footer's small icon
  logo-horizontal.png      Icon + wordmark (no tagline), transparent - the header logo, sized to
                             ~44px tall so it fits the existing navbar height unchanged
  logo-horizontal-full.png  Icon + wordmark + "TRADE · CONNECT · COLLECT" tagline, transparent -
                             for larger contexts than the header allows (currently unused, kept for
                             future marketing pages/docs)
  app-icon-512.png         Icon mark on a rounded Dark Navy square, 512x512 - the source used to
                             build favicon.ico and apple-touch-icon.png
  apple-touch-icon.png     180x180, opaque (per Apple's guidance - no transparency), copied to
                             src/app/apple-icon.png for Next.js's file-based icon convention
  favicon.ico              16/32/48px multi-resolution, copied to src/app/favicon.ico for the same
                             file-based convention (see below)
```

**Why two copies of the favicon/apple icon?** Next.js's App Router auto-detects and serves
`src/app/favicon.ico` and `src/app/apple-icon.png` with zero configuration - no `metadata.icons`
needed, and critically, no risk of emitting a second, conflicting `<link rel="icon">` tag (which is
exactly what happened when this repo's original placeholder `src/app/favicon.ico` and a manually-set
`metadata.icons` entry were both present at once during this change - fixed by making
`public/branding/` the canonical source and copying from it into the two `src/app/` convention
files, so there's exactly one favicon and one apple-touch-icon link in the rendered `<head>`).

**Color palette** (`src/app/globals.css`):

| Variable | Hex | Tailwind utilities | Used for |
| --- | --- | --- | --- |
| `--brand` (Primary Green) | `#10b872` | `bg-brand`, `text-brand`, `border-brand` | Primary buttons, active nav, primary badges/links, progress bars |
| `--brand-dark` | `#0a8f5a` | `bg-brand-dark`, `text-brand-dark` | Hover/active state for the above, and most link text |
| `--brand-blue` (Primary Blue) | `#0d84f2` | `bg-brand-blue`, `text-brand-blue` | Secondary buttons, secondary badges/stat tiles, icons |
| `--brand-blue-dark` | `#0a66c2` | `bg-brand-blue-dark` | Hover/active state for secondary buttons |
| `--brand-navy` (Dark Navy) | `#101c34` | `bg-brand-navy`, `text-brand-navy` | The app-icon background, the admin "role" badge, decorative dark accents |
| `--foreground` | `#14213d` | `text-foreground`, `bg-foreground` | Body text (already a dark navy tone - kept separate from `--brand-navy` so a future brand-navy tweak can't accidentally shift every line of body copy on the site) |

These are additive to the existing palette (`--accent` for marketplace "sale" indicators and
`--background` are unchanged) - see the inline comment in `globals.css` for the full rationale.
`sticker` status colors (gray/green/blue/red in the collection grid - see
[Visual collection model](#visual-collection-model-teams--sticker-codes)) are a **separate,
functional** color-coding system and were deliberately left untouched by this pass; only the
*decorative*/branding use of blue (secondary buttons, stat tiles, admin badges) was aligned to the
new `--brand-blue`.

**Where the logo appears**: the header (`SiteHeader.tsx`, `logo-horizontal.png` at a fixed 44px
height - the navbar itself is still `h-16` (64px), unchanged), the landing page hero
(`src/app/page.tsx`, `logo-icon.png` above the headline with a soft decorative blurred glow behind
it), and the footer (`SiteFooter.tsx`, a small `logo-icon.png`).

**If real vector (SVG) exports become available later**: drop `logo-icon.svg` and
`logo-horizontal.svg` into `public/branding/`, then update the three `<Image src="/branding/...">`
references above (in `SiteHeader.tsx`, `page.tsx`, and `SiteFooter.tsx`) to point at the `.svg`
files instead of `.png` - everything else (sizing, layout, the favicon/apple-icon pipeline) stays
the same.

## Project structure

```
src/
  app/                     Next.js App Router pages (landing, auth, dashboard, admin)
    auth/callback/route.ts  PKCE code-exchange endpoint (email confirmation, OAuth, magic links)
    auth/confirm/route.ts   token_hash fallback endpoint (older-style email templates)
    dashboard/stickers/page.tsx             Team cards list ("My Collection")
    dashboard/stickers/[teamCode]/page.tsx  20-sticker tap-to-mark grid for one team
    dashboard/stickers/marketplace/page.tsx Marketplace details editor for duplicate (blue) stickers
    admin/users/[id]/page.tsx               Per-user view/edit/suspend/delete
    admin/trades/page.tsx                   All trades in the system + cancel/force-complete/delete
    admin/statistics/page.tsx               Live-computed platform statistics
    admin/reports/page.tsx                  All bug reports, search/filter by status/category
    admin/reports/[id]/page.tsx             Full report detail, status + internal note
    dashboard/support/page.tsx              Bug report / support ticket form ("תקלות ומשוב")
  components/
    ui/                    Shared primitives (Button, Card, Field, Skeleton, CityAutocomplete, ...)
    collection/            TeamCard, StickerGrid (tap-to-cycle grid), ColorLegend, DuplicateListingChip
    auth/ trades/ profile/  Feature UI
    admin/                  AdminTabs, EditUserForm, DeleteUserButton, AdminTradeActions, StatCharts,
                            UpdateReportStatusForm
    matches/                MatchCard, MatchesView (map/list toggle), MatchesMap (Leaflet, client-only)
    location/              Location opt-in/opt-out toggle
    notifications/         NotificationsContext (shared bell + history state), NotificationBell,
                            NotificationHistoryList, NotificationsRootProvider (root-layout data fetch)
    scanner/                AI Scanner upload/review UI (sticker-back detection)
    support/                SupportReportForm (bug report / support ticket form)
    share/                  Share button + share card
  lib/
    actions/               Server Actions (auth, profile, stickers, trades, chat,
                            notifications, location, scanner, admin, support)
    data/                  Server-side data fetchers (Supabase queries) - teams.ts, collection.ts
                            (team progress + grid + marketplace listings), matches.ts, stickers.ts,
                            admin.ts (users/trades/stats, all admin-only pages), support.ts (bug reports)
    email/                 resend.ts (dependency-free Resend client), notifyAdminsOfReport.ts
    image/                 resizeForUpload.ts - client-side photo resize/HEIC-to-JPEG conversion
                            for the AI Scanner (see "Sticker Scanner reliability" below)
    supabase/              Supabase client/server/proxy (session) helpers, serviceRole.ts
                            (Auth Admin API client, only for admin user-deletion)
    vision/                Vision/OCR provider abstraction (mock + OpenAI) for the AI Scanner;
                            errors.ts defines specific error types for Hebrew error-message mapping
    matching.ts            Pure, side-effect-free match-ranking algorithm (operates on sticker codes)
    cities.ts              Public API over israelLocalities.ts - city list, region/coordinate lookup
    data/israelLocalities.ts  ~1,180 Israeli localities (name + lat/lng) - see README section below
    distance.ts            Haversine display formatting, coordinate rounding, deterministic jitter
    stickerCodes.ts        Sticker code parsing/formatting/validation ("GER-2", "GER 1-3 · FRA 17")
    supportCategories.ts   Shared category labels (used by the form, admin UI, and the admin email)
    supportAttachmentUpload.ts  Client-side direct-to-Supabase-Storage upload for report screenshots
  types/database.ts        Hand-written Supabase Database types
  proxy.ts                 Next.js 16 "proxy" (formerly middleware) - session refresh + route guards
.github/workflows/database.yml  Tests every migration on PRs; deploys new migrations to production
                                   automatically on merge to main (see "Automated database migrations")
supabase/
  config.toml                        Supabase CLI project config (`supabase link`/`db push`/`start`)
  testing/auth_schema_stub.sql        Minimal auth.users/auth.uid() stand-in, CI-only (not a real project)
  testing/storage_schema_stub.sql     Minimal storage.buckets/storage.objects stand-in, CI-only
  migrations/0001_schema.sql         Core tables, indexes, triggers, helper functions
  migrations/0002_rls_policies.sql   Core Row Level Security policies
  migrations/0003_location.sql       profile_locations table + haversine/nearby_distances RPCs
  migrations/0004_trade_chat.sql     trade_messages table, RLS, Realtime
  migrations/0005_notifications.sql  notifications table, RLS, trigger-based notification creation
  migrations/0006_marketplace.sql    listing_type/price/note on user_duplicates
  migrations/0007_hardening.sql      Suspended-user write enforcement, scan_events rate-limit table
  migrations/0008_bootstrap.sql      First-signup-becomes-admin, zero-touch production bootstrap
  migrations/0009_auth_trigger_resilience.sql  Non-blocking profile provisioning + full SQL diagnostics
  migrations/0010_reconcile_profile_contacts.sql  Reconciles drifted profile_contacts schemas (fixes
                                        "column whatsapp_phone does not exist" on affected projects)
  migrations/0011_shashot_teams.sql  Shashot redesign: teams table, team-scoped sticker codes,
                                        unified user_stickers (4-state) table - see below
  migrations/0012_worldcup2026_teams.sql  Official 48-team FIFA World Cup 2026 roster + real
                                        flag_icon column, replacing 0011's placeholder 32-team list
  migrations/0013_matches_map.sql    nearby_locations() RPC - jittered approximate coordinates
                                        for the matches map, alongside the same real distance
  migrations/0014_admin_dashboard.sql  Admin-only trade_requests DELETE policy (previously missing
                                        entirely) + admin_get_user_emails() RPC for the users table
  migrations/0015_scanner_reliability.sql  Defensive re-assertion of scan_events.mode's check
                                        constraint (see "Sticker Scanner reliability" below)
  migrations/0016_support_reports.sql  support_reports table + RLS, private support-attachments
                                        storage bucket + RLS, get_admin_notification_emails() RPC
  diagnostics/check_auth_trigger.sql Read-only script to debug "Database error saving new user"
  seed.sql                           Local-dev-only seed data (demo users + collections + trades + chat)
```

### Visual collection model (teams & sticker codes)

The collection is no longer managed by typing sticker numbers into a text field - it's a visual
album: **teams** (national teams, shown as cards with a flag/Hebrew name/3-letter code) each contain
exactly 20 **stickers**, uniquely identified by `TEAMCODE-number` (e.g. `GER-2`, `FRA-17`, `POR-5`).

- `teams` (`code` primary key, `name_he`, `flag_emoji`, `flag_icon`, `sort_order`) - seeded with the
  official 48-team FIFA World Cup 2026 roster (`0012_worldcup2026_teams.sql`; an earlier placeholder
  32-team roster from `0011_shashot_teams.sql` is superseded by it). Admins can add more via the
  `admin_add_team()` RPC (see the admin catalog page), which also auto-generates that team's 20
  `stickers` rows in the same transaction.
- **Real flags, not emoji**: `flag_icon` stores a [`flag-icons`](https://github.com/lipis/flag-icons)
  library code (an ISO 3166-1 alpha-2 code, or `gb-eng`/`gb-sct` for England/Scotland) and is what the
  UI actually renders (`TeamFlag.tsx`) as a crisp SVG - Unicode flag emoji (`flag_emoji`, kept only as
  a fallback for custom admin-added teams with no known ISO code) render as plain two-letter text on
  many real systems that lack a font with combined flag glyphs (older Windows, most Linux desktops),
  which is exactly the "shows IL/BR/FR as text" bug this fixed.
- `stickers` keeps its original `id` (uuid) primary key (so existing `trade_request_items` foreign
  keys never dangle across the migration) but gained `team_code` (FK to `teams`), a per-team
  `number` (1-20, no longer globally unique), and a `code` column that's always
  `${team_code}-${number}` and unique across the whole catalog - the identifier used everywhere in
  the UI, matching logic, and trade items.
- `user_stickers` **replaces both** the old `user_duplicates` and `user_missing` tables with a
  single 4-state row per `(user, sticker)`: **no row** = unmarked (gray), `status = 'have'` (green),
  `'duplicate'` (blue, tradeable - carries `listing_type`/`price`/`note`), or `'missing'` (red).
  Tapping a sticker in the grid simply cycles through these four states client-side; "Save" persists
  the whole team's diff in one batched Server Action call (`saveTeamGridAction`).
- **Matching is unaffected in principle, only in representation**: `computeMatches()` in
  `src/lib/matching.ts` still does the same set-intersection of "what I need" vs. "what they have
  spare" - it just operates on `code: string` (e.g. `"GER-2"`) instead of a bare `number`, which is
  actually *more* correct, since two different teams' sticker #2 are now unambiguously distinct.

**Migrating existing data**: `0011_shashot_teams.sql` is written to preserve existing collections
wherever mathematically possible, and to fully self-heal otherwise - no manual SQL, on fresh or
existing projects:

1. It best-effort remaps the old flat 1..N sticker numbering onto `(team, per-team number)` pairs,
   treating every consecutive block of 20 old numbers as one seeded team (in team `sort_order`) -
   this exactly preserves existing `user_duplicates`/`user_missing`/`trade_request_items` data
   whenever a project's catalog was configured as `team_count * 20` (the expected shape for a
   project that only ever used this app's admin catalog tools).
2. Any legacy sticker numbers beyond that range (no valid team mapping exists) are removed along
   with rows that reference them - this only affects a catalog that was never fully configured;
   nothing in the shipped admin UI could create such a gap.
3. Regardless of what existed before, the migration guarantees every one of the 32 seeded teams ends
   up with exactly 20 stickers (missing ones are freshly created), so the catalog is always complete
   on both a brand-new database and a previously-used one.
4. This was verified end-to-end locally: seeded a database with the *old* schema/shape (60 flat
   stickers, two collectors with overlapping duplicates/missing/trade-request data, matching
   marketplace price/note fields), ran the migration, and confirmed every row landed on the
   expected new `code`, with `trade_request_items` foreign keys intact and marketplace fields
   preserved - byte-for-byte matching a hand-computed expected mapping.
5. **It does not assume every prior migration in this repo's history actually ran** - a real
   production project hit this exactly: `0006_marketplace.sql` (which adds `listing_type`/`price` to
   `user_duplicates`) had never been applied there, so `user_duplicates` still had the *original*
   `0001_schema.sql` shape (a `for_sale boolean`, no `listing_type`). A first version of `0011` wrote a
   static `select ... listing_type, price ... from user_duplicates`, which failed with `column
   "listing_type" does not exist` - confusingly reported by Postgres as "There is a column named
   listing_type in table user_stickers [the migration's own new target table], but it cannot be
   referenced from this part of the query", since `listing_type` genuinely exists elsewhere in the
   same statement, just not on the table actually being selected from. The migration now checks
   `information_schema.columns` at runtime and branches: migrate `listing_type`/`price` directly if
   present, derive `listing_type` from the legacy `for_sale` boolean if not (exactly like `0006` itself
   would have), or default to `'trade'` if neither exists. The same defensive-existence-check pattern
   guards the `scan_events` table (added by `0007_hardening.sql`, also not guaranteed to exist) and the
   legacy-cleanup `delete from user_duplicates/user_missing` statements (guarded so the *entire*
   migration can be re-run safely even after a previous run already dropped those tables). Verified
   against three distinct schema states locally: a fresh database, one stalled at `0005` (no
   `listing_type`, no `scan_events` - reproducing the exact reported error first, then confirming the
   fix), and one stalled at `0006` (`listing_type` present, `scan_events` absent) - plus re-running the
   full migration a second time against the now-migrated database to confirm idempotency.

**Updating the team roster (`0012_worldcup2026_teams.sql`)**: replaces `0011`'s placeholder 32-team
roster with the official 48-team FIFA World Cup 2026 lineup, and switches flag rendering from Unicode
emoji to real SVG flags (see `flag_icon` above). Same data-preservation philosophy as `0011`:

1. 25 of the 32 old team codes are also in the new 48-team list (e.g. `ARG`, `BRA`, `FRA`, `GER`) -
   their `stickers` and any `user_stickers`/`trade_request_items` rows are **never touched** (same
   `code`, so there's nothing to migrate for them).
2. The 7 codes no longer in the list (`ISR`, `ITA`, `CMR`, `NGA`, `POL`, `DEN`, `SRB`) are removed
   along with their stickers, which cascades (via the existing `ON DELETE CASCADE` foreign keys) to
   any `user_stickers`/`trade_request_items` referencing those *specific* stickers - there's no other
   team for that data to sensibly move to once a team is removed from the catalog outright. Note that
   `stickers.team_code -> teams.code` itself has no cascade (by design, so an unrelated bug could never
   silently wipe a team's catalog) - the migration deletes `stickers` for removed teams *before*
   deleting the `teams` rows themselves, in that order.
3. The 23 newly-added codes get their 20 stickers auto-generated, exactly like `admin_add_team()`
   does for a manually-added team.
4. Team metadata (`name_he`/`flag_emoji`/`flag_icon`/`sort_order`) is fully upserted for all 48 codes,
   so re-running this migration also fixes any of those fields on projects that already have it applied
   (e.g. this is also how England's flag gets corrected from a plain black-flag placeholder to a real
   flag on a project that already ran an earlier version of this migration).
5. Verified locally against three scenarios: a fresh database (all 12 migrations, ends with exactly 48
   teams / 960 stickers), a database with real pre-existing user data spanning both a kept team (a
   duplicate with a price/note, a missing sticker, and an active trade request item - all confirmed
   byte-for-byte intact afterward) and a removed team (confirmed those specific rows are gone), and a
   second full re-run against the now-migrated database to confirm idempotency (zero rows
   inserted/deleted/updated beyond the no-op upserts on the second pass).

### Why a `profiles` / `profile_contacts` split?

Postgres RLS is row-level, not column-level. To guarantee phone numbers are *only* ever readable by
the owner, an admin, or a confirmed trade partner - even if the app code has a bug - contact details
live in their own `profile_contacts` table with a strict RLS policy, completely separate from the
publicly-browsable `profiles` table (name/city/neighborhood) used for matching and the marketplace.

### Zero-touch production bootstrap

A fresh Supabase project + a fresh Vercel deployment should work end-to-end - register, confirm
email, log in, see the dashboard, use the admin panel - without anyone ever opening the SQL editor
to hand-write a fix. Four things make that true:

1. **Profile creation is defense-in-depth, not single-point-of-failure.** The primary path is the
   `handle_new_user()` trigger on `auth.users` (in `0001_schema.sql`, refined in `0008_bootstrap.sql`),
   which fires the instant someone signs up and creates their `profiles` + `profile_contacts` rows in
   the same transaction. As a fallback, `getCurrentProfile()`/`getCurrentContact()`
   (`src/lib/data/profile.ts`) self-heal: if a profile is ever missing for an authenticated user for
   any reason, they're created on the spot (`ON CONFLICT DO NOTHING`, so this is always safe to run
   even if the trigger already did its job). This is what guarantees the dashboard loads immediately
   after first login instead of a "profile not found" redirect loop.
2. **The first person to ever sign up becomes an admin automatically** (`0008_bootstrap.sql`). A
   brand new project has no data, so - by construction - the first signup is whoever is deploying and
   testing the app. Every signup after that gets the normal `user` role. This removes the only step
   in the whole app that previously required a manual SQL `UPDATE` just to get started. (If you need
   to promote someone else later, that's a normal, occasional admin-management action, still a `UPDATE`
   statement - see [Getting started](#getting-started) below - not a deployment blocker.)
3. **Email confirmation actually completes the sign-in.** `app/auth/callback/route.ts` exchanges the
   PKCE `code` Supabase appends to the confirmation link for a real session (this is what
   `signUpAction` requests via `emailRedirectTo`), and `app/auth/confirm/route.ts` is a fallback for
   projects whose email template uses the older `token_hash` style. Neither requires editing the
   Supabase email templates - both work with the default "Confirm signup" template out of the box.
4. **Clear, actionable failures instead of silent breakage.** `getSupabaseEnv()`
   (`src/lib/supabase/env.ts`) throws an explicit "you forgot to set NEXT_PUBLIC_SUPABASE_URL/..."
   error instead of the cryptic `supabaseUrl is required` from the underlying library. `getSiteUrl()`
   (`src/lib/site.ts`) derives the app's public URL from the request's forwarded host when
   `NEXT_PUBLIC_SITE_URL` isn't set, so auth redirects still go to the right domain on a first deploy
   even if that env var is forgotten.

### Diagnosing "Database error saving new user"

If sign-in (email or Google) ever fails with this message, it means an exception was raised while
Supabase's GoTrue service was inserting a row into `auth.users` - almost always because a trigger on
that table (our `handle_new_user()`) hit an error, which aborts the *entire* signup transaction.
GoTrue deliberately hides the underlying Postgres error from the API response for security reasons,
so the client only ever sees this generic message - the real cause only appears in Postgres's own
logs.

**What was investigated and verified** (full detail in the PR description): `handle_new_user()` is
`SECURITY DEFINER`, owned by `postgres`, with every table reference schema-qualified - the exact
pattern Supabase's own troubleshooting guide recommends for this failure class. This was verified by
reproducing Supabase's real privilege model locally (a restricted `supabase_auth_admin` role - what
GoTrue actually connects as, with no direct grants on the `public` schema) and confirming the trigger
correctly provisions a profile under that role, including for a payload shaped exactly like Google's
OAuth metadata.

**Hardening added regardless** (`0009_auth_trigger_resilience.sql`), since the exact failure couldn't
be reproduced from a clean database and could be specific to how a given project's history/migrations
were applied:

1. Switched to Supabase's exact documented pattern (`search_path = ''` with fully-qualified names).
2. Added redundant, explicit grants on `profiles`/`profile_contacts` to `supabase_auth_admin` -
   belt-and-suspenders on top of `SECURITY DEFINER` (no-op on non-Supabase Postgres).
3. **The profile-provisioning logic is now wrapped in an exception handler that logs the exact
   `SQLSTATE`/`SQLERRM` via `RAISE WARNING` and lets `auth.users` creation succeed regardless.** This
   was verified directly: a deliberately broken `profiles` schema still produced
   `auth.users` row creation success end-to-end, while
   `Postgres` logs showed the *exact* underlying constraint violation
   (`WARNING: handle_new_user: profile provisioning failed for user <uuid> (sqlstate=23502): null
   value in column "..." violates not-null constraint`). This is not "masking" the error - it's fully
   logged with complete diagnostic detail, and the existing self-heal fallback
   (`getCurrentProfile()`/`getCurrentContact()`, see above) completes the profile on first dashboard
   load, under the signed-in user's own RLS policies, a completely independent code path from the
   trigger. **Sign-in should never be permanently blocked by a profile-provisioning hiccup again.**

**If this happens on your project**, run `supabase/diagnostics/check_auth_trigger.sql` (100%
read-only) in the Supabase SQL Editor - it lists every trigger on `auth.users`, its function's
ownership/`SECURITY DEFINER` status, the actual columns on `profiles`/`profile_contacts`, and the
grants `supabase_auth_admin` has. Then check **Supabase Dashboard → Logs → Postgres Logs** for a
`handle_new_user` warning around the time of the failed sign-in - after this migration, it will
contain the exact SQL error (constraint name, permission, or column) instead of a generic message.

#### Confirmed root cause on one project, and the fix (`0010_reconcile_profile_contacts.sql`)

The diagnostic process above found the exact SQL error on a live project's Postgres logs:

```
SQLSTATE 42703: column "whatsapp_phone" of relation "profile_contacts" does not exist
```

Whatever version of `handle_new_user()` was actually running on that project inserted into a
column called `whatsapp_phone` - but that project's real `profile_contacts` table only ever had a
`phone` column (no `whatsapp`, no `whatsapp_phone`). Nothing in this repo's code or migration
history has ever referenced `whatsapp_phone` (verified with a full-codebase search) - the table's
live shape had simply diverged from what `0001_schema.sql` defines. The most likely mechanism:
`create table if not exists public.profile_contacts (...)` is a no-op against a table that already
exists, so if `profile_contacts` was created before/outside this migration history on a given
project (a different schema draft, a manual edit, etc.), running these migrations on top of it
would never retroactively fix its columns - `CREATE TABLE IF NOT EXISTS` only helps on a database
that doesn't have the table yet.

`0010_reconcile_profile_contacts.sql` fixes this with no manual SQL required, on any project,
regardless of which drifted or non-drifted state it's currently in:

1. Adds `phone`/`whatsapp` to `profile_contacts` via `ADD COLUMN IF NOT EXISTS` if either is
   missing (fixes the reported project, which only had `phone`).
2. If a stray `whatsapp_phone` column exists on a given project, migrates its data into
   `whatsapp` and drops it, so nothing can ever reference it again.
3. Re-runs the exact `handle_new_user()` definition from `0009_auth_trigger_resilience.sql`
   (`CREATE OR REPLACE FUNCTION`), guaranteeing the live function matches the now-reconciled table
   even if `0009` was never applied on a given project for any reason.
4. Re-creates the trigger and the `supabase_auth_admin` grants defensively, same as `0009`.

This was verified end-to-end locally: the exact reported error was reproduced against a database
seeded with `profile_contacts` missing `whatsapp` and a `handle_new_user()` deliberately rewritten
to insert into `whatsapp_phone` (matching the log output byte-for-byte), then `0010` was applied
and the identical signup payload succeeded, correctly populating both `phone` and `whatsapp`. A
second run against a completely fresh database (migrations `0001`-`0010` in order, no drift) was
also verified - every step in `0010` is a no-op there, confirming it's safe for both fresh and
existing projects. `supabase/diagnostics/check_auth_trigger.sql` was also extended (query "4b") to
flag exactly this class of drift going forward: any column `handle_new_user()`/this repo expects
that's missing, and any column present on the live table that this repo's migrations don't
recognize.

### Auth error handling (never show raw errors)

A production bug meant the registration form sometimes displayed the literal text `"{}"` instead
of a readable error. **Root cause**: supabase-js's internal error-message builder
(`_getErrorMessage()` in `@supabase/auth-js`) falls back to `JSON.stringify(responseBody)` whenever
a GoTrue error response doesn't contain one of its expected `msg`/`message`/`error_description`/
`error` fields - which happens for some rate-limit responses, transient gateway errors, and other
edge-case response shapes. When that happens, `error.message` becomes the ordinary *string* `"{}"`
(or another JSON fragment), which the old code displayed verbatim because it only translated a
handful of known messages and returned anything else unchanged.

The fix, in `src/lib/authErrors.ts`, is a **whitelist, not a blacklist**: `normalizeAuthError()`
only ever returns a message it explicitly recognizes (mapped to Hebrew); everything else - "{}",
other JSON fragments, network failures, or genuinely unexpected exceptions - falls back to a
generic, friendly Hebrew message (e.g. `"אירעה שגיאה בהרשמה. נסה שוב בעוד רגע."`). The **original**
error is always logged server-side first via `console.error()` (captured by Vercel's function
logs), so the real cause is never actually hidden from whoever needs to debug it - only from the
end user. Every auth Server Action (`signUpAction`, `signInAction`, `signInWithGoogleAction`) is
wrapped in a try/catch that routes through this same function, so an unexpected thrown exception
(e.g. a network failure - reproduced and verified during this fix, see the PR description) is
handled identically to a normal `{ error }` response from Supabase.

As a second line of defense, `ErrorMessage`/`SuccessMessage` (`src/components/ui/FormMessage.tsx`)
never render anything other than a string/number/boolean - if a non-primitive value ever reaches
them (e.g. via a future bug or an `as any` cast), they show a safe generic message instead of the
raw value, rather than crashing or leaking it.

### Google sign-in

"המשך עם Google" (Continue with Google) is available on both the login and register pages, above
the email/password form. It's implemented as a normal Supabase OAuth flow, reusing the same
`/auth/callback` route already built for email confirmation - no new callback infrastructure was
needed:

1. `GoogleSignInButton` (client component) submits a form to `signInWithGoogleAction`.
2. That Server Action calls `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } })`
   and redirects the browser to the Google consent screen Supabase returns.
3. After the user approves, Google redirects back to `/auth/callback?code=...`, which exchanges the
   code for a session exactly like an email confirmation does, then redirects to `/dashboard`.
4. The **same** `handle_new_user()` trigger used for email signups fires for OAuth signups too
   (Supabase creates an `auth.users` row for both) - so profile/`profile_contacts` creation and the
   "first signup becomes admin" bootstrap logic apply identically regardless of provider. Verified
   directly against a real Postgres: an `auth.users` row shaped like Google's OAuth payload
   (`raw_user_meta_data` with `full_name`/`avatar_url`, no `city`/`phone`) produces a correct
   profile, and is promoted to admin when it's the first signup on the database.

Google doesn't provide a city or phone number (our app needs both for matching/trade contact
reveal), so the dashboard shows a one-time "complete your profile" banner for any account - Google
or email - missing either field, linking to the profile page. Nothing else about the app's behavior
changes based on provider; RLS, the security model, and every other flow are provider-agnostic.

#### Enabling Google sign-in (Supabase + Google Cloud dashboard setup)

This requires one-time configuration in two dashboards - no code changes, no SQL:

1. **Google Cloud Console**: create an OAuth 2.0 Client ID (APIs & Services → Credentials →
   Create Credentials → OAuth client ID → Web application). Add your Supabase project's callback
   URL as an authorized redirect URI - it's shown on the Supabase side in the next step
   (`https://<your-project-ref>.supabase.co/auth/v1/callback`).
2. **Supabase dashboard** → Authentication → Providers → Google: toggle it on, paste the Google
   Client ID and Client Secret from step 1, save.
3. Make sure your app's own URL is in Supabase's Auth **Redirect URLs** allow-list (see
   [Getting started](#getting-started) → "Configure Auth URLs" above) - this is the same
   requirement email confirmation already has, nothing extra.
4. That's it - no changes to this repo's code or database are needed to turn Google sign-in on or
   off; it activates as soon as the provider is enabled in Supabase.

If Google isn't enabled yet, clicking the button shows a clear Hebrew error
("התחברות עם Google אינה מוגדרת כרגע במערכת") instead of a cryptic failure, thanks to the same
`normalizeAuthError()` whitelist described above.

### Location privacy

The same pattern protects location data, one level stricter: coordinates live in
`profile_locations`, readable **only by their owner (or an admin)** - not even a confirmed trade
partner can select another user's raw latitude/longitude. The only way anyone learns anything about
another collector's location is through two `SECURITY DEFINER` SQL functions, neither of which ever
returns raw coordinates:

- `nearby_distances()` - a rounded distance in km for the *caller* relative to everyone else (used
  for the "500 מ׳" / "2.3 ק״מ" badges and distance-based sort order).
- `nearby_locations()` (`0013_matches_map.sql`) - returns the same real distance, **plus** a further
  jittered approximate coordinate used only to place a marker on the matches map. The jitter (up to
  ~2km, deterministic per target user via a stable hash of their `user_id` - see the migration for
  the exact formula) is applied *in addition to* the ~100m client-side rounding below, specifically
  because a map marker is more visually revealing than a distance number - "2.3 ק״מ" doesn't pinpoint
  a location on a visual map the way an unjittered marker would. The true, unjittered distance is
  still what's shown as text and used for sorting - only the *marker position* is approximate.

**Map markers for collectors without GPS location** (`src/lib/data/matches.ts`): city and
neighborhood are already public `profiles` fields, visible to every signed-in collector for
matching/marketplace purposes - so deriving an approximate map position from a collector's *city*
isn't a new privacy boundary the way GPS coordinates would be. A collector who hasn't opted into
precise location, but has filled in a city, still gets a marker - placed at that city's center
(`getCityCoordinates()` in `cities.ts`) with the same kind of small deterministic per-user jitter as
above (`deterministicJitter()` in `distance.ts`, computed entirely client/server-side in TypeScript -
no extra database round-trip, since it's not derived from any sensitive stored coordinate). The
popup always says exactly which kind of estimate it's showing, so a city-derived pin is never
mistaken for a real GPS fix:

- GPS-based marker: `📍 מיקום מבוסס GPS (מוצג בקירוב מטעמי פרטיות)`
- City-based marker: `📍 מיקום משוער לפי הפרופיל`

A collector with neither a GPS location nor a city stays in the list view and is simply never
plotted on the map.

On top of that:

- The browser rounds coordinates to 3 decimal places (~100m) *before* sending them to the server
  (`roundCoordinate()` in `src/lib/distance.ts`), and the server rounds again defensively.
- Location is strictly opt-in (`LocationToggle` requests browser permission explicitly) and can be
  disabled at any time, which deletes the stored row entirely (`disable_my_location()`), not just
  hides it.
- Users without a stored location automatically fall back to city/region-based ranking - nothing
  breaks or requires location to be useful. On the matches map specifically, a collector without a
  location is kept in the list view but simply never gets a marker.

### Israeli localities dataset

`src/lib/data/israelLocalities.ts` holds ~1,180 Israeli cities, local councils, and towns (Hebrew
name + approximate lat/lng), replacing an original hand-picked ~50-city list. `src/lib/cities.ts` is
the actual public API built on top of it (`ISRAEL_CITIES`, `getCityCoordinates()`,
`getRegionForCity()`, `getLocationRank()`) - always import from `cities.ts`, not the data file
directly, so the underlying dataset can be refreshed later without touching every call site.

**Provenance and data-quality fixes**: sourced from the MIT-licensed
[`israel-geolocation`](https://github.com/akivaschiff/israel-geolocation) npm package (1,264
locations built from Israeli government open data + OpenStreetMap + Google Maps geocoding), merged
with this app's original city list and vendored as a plain static file rather than a runtime
dependency (a few hundred KB of coordinates that never change at runtime don't need to be
re-resolved on every request). Two things were fixed during that merge, not just copied as-is:

1. **A real data-quality bug in the source dataset**: 85 different localities (including two this
   app actually uses, מעלה אדומים and טירה) all shared the exact same placeholder coordinate
   (a failed-geocoding fallback in the upstream data). Those 85 were dropped; מעלה אדומים and טירה
   were re-added with correct, manually-verified coordinates so nothing this app already relies on
   regressed.
2. **Backward compatibility with existing stored data**: the source dataset spells some names
   differently from this app's original list (e.g. `תל אביב - יפו` with hyphens/spaces vs. this
   app's `תל אביב יפו`). Every one of the original ~50 city strings is preserved
   *character-for-character* in the final dataset (verified by a normalized-name matching pass, then
   a unit test asserting every original name is still present) - so `profiles.city` values already
   stored in any database from before this change remain valid and selectable, exactly per the "do
   not remove or rename values already stored in the database" requirement this was built against.

**Region fallback**: `CITY_REGIONS` (a curated grouping for a few dozen well-known cities) is kept
exactly as before for backward compatibility with `getRegionForCity()`'s existing contract and
tests - maintaining a hand-picked region for **all** ~1,180 localities would be impractical and
wouldn't scale. Instead, `getLocationRank()` now falls back to real coordinate-based proximity
(≤15km counts as "nearby") for any pair of localities outside that curated set, which is what makes
the full dataset actually useful for ranking without requiring it to be hand-categorized.

**UI**: since ~1,180 options is far too many for a usable `<select>`, the city field on
registration/profile/admin-edit forms was replaced with `CityAutocomplete.tsx` - a reusable
Hebrew-searchable combobox (type to filter, arrow keys + Enter to pick) that still submits a plain
`city` form field, so no Server Action needed to change.

### Suspended users are blocked at the database level

Suspending a user (`profiles.status = 'suspended'`) does more than hide UI buttons: an
`is_active_user()` check is baked into the RLS policy for creating trade requests, into the
`validate_trade_status_transition()` trigger (accept/decline/complete/cancel), and into the RLS
policy for sending chat messages (`0007_hardening.sql`). A suspended account can still log in, view
its own data, and manage its own duplicates/missing list (that's not an abuse vector), but cannot
contact or trade with other collectors - even via a hand-crafted API request that bypasses the UI
entirely. The relevant Server Actions also check this up front to show a clear Hebrew error instead
of a raw Postgres exception.

### Rate limiting & abuse prevention

Two complementary layers, chosen per action based on what's accurate and cheap:

- **DB-backed limits** (accurate across serverless instances) for actions that already have a
  natural table to count against: trade request creation (20/hour/user), chat messages
  (40/10min/user), and AI Scanner uploads (20/hour/user, backed by the new `scan_events` table,
  which doubles as a lightweight audit log).
- **In-process limits** (`src/lib/rateLimit.ts`) for auth actions (sign up: 6/hour/IP, sign in:
  10/5min/IP+email), where creating a database row per attempt (including failed/malicious ones)
  isn't desirable. This is intentionally a "basic" first line of defense - see the code comment in
  `rateLimit.ts` for why it isn't a substitute for a distributed limiter (e.g. Redis) at real scale,
  and note that Supabase Auth enforces its own server-side limits on top of this regardless.

The AI Scanner also validates uploads both client-side (`ImageDropzone`) and server-side
(`src/lib/actions/scanner.ts`): file type is restricted to an explicit allow-list (JPEG/PNG/WEBP/HEIC
- no SVG or other exotic formats) and size is capped at 8MB, with a clear Hebrew error message for
each failure case. Support report creation (`src/lib/actions/support.ts`) has the same kind of
DB-backed limit (10/hour/user).

### In-app notifications vs. email

`notifications` rows carry a `dispatched_channels text[]` column (defaults to `{inapp}`). A future
background worker can add push/email delivery for these *in-app* notifications (new trade request,
accepted/declined, new chat message) by polling for rows missing `'push'`/`'email'` in that array,
sending them, and appending the channel name - no schema changes needed. All notification-creation
logic already lives in one place (`create_notification()` in `0005_notifications.sql`), called from
triggers on `trade_requests` and `trade_messages`.

Separately, this app *does* now send one kind of real email: every admin gets notified by email when
a user submits a bug report (see [Support / bug reports](#support--bug-reports-תקלות-ומשוב) below) -
via a small, dependency-free Resend client (`src/lib/email/resend.ts`). That's genuinely reusable
infrastructure for the `dispatched_channels` worker described above whenever it's built - the same
`sendEmail()` function, just called from a different trigger.

### Marking notifications as read: a shared client store, not just a server round-trip

The header's notification bell (`NotificationBell.tsx`) and the full history page
(`NotificationHistoryList.tsx`) are two independent client components mounted as siblings under the
root layout (the header wraps every page; the history page is just one page's content) - each used
to hold its **own** local copy of the notification list/unread count, seeded once from a server
fetch. That's the root cause behind "מסמן הכל כנקרא" on the notifications page not visibly updating
the header's badge: marking everything read from the page updated *that page's* local state (and the
database), but the header's *separate* local state had no way to find out, short of a full
navigation happening to re-trigger both components' server-side data fetch at the same moment.

The fix is `src/components/notifications/NotificationsContext.tsx` - a single React Context,
provided once at the root layout (`NotificationsRootProvider.tsx`, wrapping the header, page content,
*and* footer), holding one shared `notifications`/`unreadCount` state that both `NotificationBell`
and `NotificationHistoryList` read from and mutate through the same `markAsRead()`/`markAllAsRead()`
functions - so an action taken in either one is instantly visible in the other, no navigation or
revalidation needed. Both mutations are optimistic (the UI updates immediately) and roll back with a
clear Hebrew error message if the underlying Server Action fails - see
`src/lib/actions/notifications.ts`, which now actually checks the `mark_all_notifications_read()`/
`mark_notification_read()` RPC calls' `error` field (previously ignored entirely, so a failure was
silently swallowed with no visible symptom other than "the button doesn't seem to do anything").
Both RPCs remain `SECURITY DEFINER` functions scoped to `user_id = auth.uid()` internally (see
`0005_notifications.sql`) - server-side authorization was never the gap here, error handling and
shared client state were.

### Adding real GPS/location distance later (already done, but for reference)

City-based "nearby" matching originally lived entirely behind `getLocationRank()` in
`src/lib/cities.ts`. That seam is exactly where real distance was plugged in: `computeMatches()` in
`src/lib/matching.ts` now prefers a precomputed `distanceKm` (from `nearby_locations()`) per
candidate and only falls back to `getLocationRank()` when no shared location exists - so a future
change to how distance is computed (e.g. a fancier geo index) only touches `nearby_locations()` and
`src/lib/data/matches.ts`, never the UI.

### Matches map (Leaflet + OpenStreetMap)

- **No paid provider**: [Leaflet](https://leafletjs.com/) + [OpenStreetMap](https://www.openstreetmap.org/)
  tiles - free, no API key, no billing account to set up. `MatchesMap.tsx` renders a `TileLayer`
  pointed at the standard `tile.openstreetmap.org` server with the required attribution link.
- **Client-only, by necessity**: Leaflet reads `window`/`document` at import time, which breaks
  Next.js's default server-side render. `MatchesView.tsx` loads `MatchesMap` via
  `next/dynamic(..., { ssr: false })` - the `"use client"` directive on the map component alone is
  *not* sufficient, since Next still server-renders client components on the first pass; `ssr: false`
  is what actually skips that. Leaflet's own CSS (`leaflet/dist/leaflet.css`, required for the map to
  render at all - without it, tiles/markers are correctly positioned in the DOM but visually broken)
  is imported once in `globals.css`, the same pattern already used for `flag-icons`.
- **Custom marker icons, not Leaflet's default images**: Leaflet's default marker relies on relative
  image paths that are a well-known source of "broken marker icon" bugs in bundled (webpack/Turbopack)
  apps. `MatchesMap.tsx` sidesteps this entirely with a `L.divIcon()` - plain HTML/CSS (a colored pin
  with a small badge showing the match count), styled in `globals.css` (`.matches-map-marker`), no
  image assets involved.
- **Modular by design, for clustering later**: markers are rendered as a plain `.map()` over
  `MapMatch[]` directly inside `<MapContainer>` - adding marker clustering later (e.g.
  [`react-leaflet-cluster`](https://www.npmjs.com/package/react-leaflet-cluster)) is a matter of
  wrapping that `.map()` output in a `<MarkerClusterGroup>`, no other change needed.
- **Tab default**: `MatchesView.tsx` initializes its `view` state to `"map"` when the current user has
  location enabled, `"list"` otherwise (per the product requirement) - this is a one-time default,
  not re-evaluated on every render, so switching tabs manually always sticks for the rest of the visit.

### Admin dashboard

`/admin` (and everything under it) is gated **server-side**, not just hidden from the nav:
`src/app/admin/layout.tsx` is a Server Component that redirects to `/login` (no session) or
`/dashboard` (signed in but `role !== 'admin'`) *before* rendering or fetching anything - this is
the same guard the original admin pages already used, now covering every new page underneath it too
since they all nest inside this one layout. Every admin Server Action independently re-checks
`role === 'admin'` via `requireAdmin()` in `src/lib/actions/admin.ts` (so calling an action directly,
bypassing the UI entirely, is equally blocked), and the two most sensitive underlying operations have
their own database-level admin check as a third layer: the `admin_get_user_emails()` RPC
(`0014_admin_dashboard.sql`) raises an exception for a non-admin caller regardless of who calls it,
and deleting a trade request is only possible at all under RLS for an admin (see below).

**Dashboard** (`/admin`) - registered/active/suspended users, users with location enabled, trade
counts by status, and total active matches (computed by running the same set-intersection rule as
`computeMatches()` over every pair of active users - see `getMatchCountsByUser()` in
`src/lib/data/admin.ts` - fine at beta scale; would move to a scheduled/cached computation if the
user base grew large enough for the O(n²) pass to matter).

**Users management** (`/admin/users`, `/admin/users/[id]`) - a searchable table (name/email/city,
matched client-side after one fetch - beta-scale) showing collection size, trade count, active
match count, and location status per user, linking to a full per-user detail page with:

- **View**: every stat above plus revealed contact info (phone) - already permitted for admins by
  the existing `profile_contacts` RLS policy, this page just surfaces it.
- **Edit** (`updateUserAction`): full name, city (via the same `CityAutocomplete`), neighborhood, and
  role - promoting/demoting between `user`/`admin` is already allowed by the existing
  `profiles_update_self_or_admin` RLS policy and the `prevent_role_status_escalation` trigger (which
  only blocks *non-admin* self-escalation, not an admin editing someone else).
- **Suspend/reactivate**: unchanged, reuses the existing `SuspendUserButton`/`setUserSuspendedAction`.
- **Delete** (`deleteUserAction`): permanently removes the user via the **Auth Admin API**
  (`supabase.auth.admin.deleteUser()`), not a plain `DELETE` on `profiles`. Deleting only the
  `profiles` row would leave an orphaned, still-loginable `auth.users` entry that would simply get a
  fresh profile re-created by the existing self-heal path (`ensureProfileExists()` in
  `data/profile.ts`) on next login - not a real deletion. The Admin API call cascades through
  `profiles` and every table referencing it (contacts, collection, trades, chat, notifications,
  locations) via their existing `ON DELETE CASCADE` foreign keys. This requires a **service-role**
  Supabase client (`src/lib/supabase/serviceRole.ts`, gated behind `SUPABASE_SERVICE_ROLE_KEY` - see
  [Configure environment variables](#6-configure-environment-variables) below) - the only place in
  this codebase that uses the service role, and only ever reached after `requireAdmin()` has already
  verified the caller. An admin cannot delete their own account, and cannot delete another admin
  account without demoting them first (both are explicit checks in the action, independent of RLS).
- Impersonation ("login as user") isn't implemented, but the architecture doesn't preclude it: it
  would be one more action in the same file, behind the same `requireAdmin()` guard.

**Trades management** (`/admin/trades`) - every trade request in the system (participants, status,
creation date, sticker codes offered/requested), with cancel / force-complete / delete actions.
Cancel and force-complete are just a normal status `UPDATE` - already unconditionally allowed for an
admin caller by the existing `validate_trade_status_transition()` trigger (see
`0001_schema.sql`/`0007_hardening.sql`), no new logic needed. **Delete did need new SQL**:
`trade_requests` never had a `DELETE` RLS policy at all (only select/insert/update), so even an
admin couldn't delete one before `0014_admin_dashboard.sql` added the missing admin-only policy.
Deleting a trade cascades to its `trade_request_items` and `trade_messages` via their existing
foreign keys - cascade deletes bypass RLS on the *cascaded-to* table, so no additional policy was
needed there, only on `trade_requests` itself (verified locally: a non-admin's delete attempt
affects 0 rows, an admin's cascades correctly to items and chat messages).

**Statistics** (`/admin/statistics`) - most-wanted stickers (highest `missing` count), most-common
stickers (highest `have`+`duplicate` count), most active traders, and 14-day trades-per-day /
user-growth charts - all computed live from the database on every page load (`getAdminStatistics()`
in `data/admin.ts`), nothing hardcoded. Rendered with plain CSS bars/columns
(`src/components/admin/StatCharts.tsx`) rather than a charting library, to avoid an extra dependency
for a handful of simple ranked lists and daily counts.

### Support / bug reports (תקלות ומשוב)

Any signed-in collector can file a report from **תקלות ומשוב** in the main nav (`/dashboard/support`,
`SupportReportForm.tsx`) - subject, category (technical/trade/matches/scanner/notifications/
suggestion/other), a detailed description, an optional screenshot, and an optional page URL
(pre-filled with the current page, editable). User id, name, and email are resolved **server-side**
from the authenticated session (`auth.getUser()`), not trusted from client input; current
date/time is the row's `created_at` default; the browser's user-agent and the page URL are the only
two fields that genuinely can only come from the client, so those are captured into hidden form
fields on mount. The submit button is disabled for the whole submission (attachment upload, then
the Server Action itself) to prevent duplicate submissions, and there's also a DB-backed rate limit
(10 reports/hour/user) as a second line of defense.

**Screenshot attachments** upload directly from the browser to a private `support-attachments`
Supabase Storage bucket (`uploadSupportAttachment()` in `src/lib/supportAttachmentUpload.ts`), using
the signed-in user's own session - never through the Server Action, which only ever receives the
resulting *storage path* (a short string), not the file's bytes. Storage RLS
(`0016_support_reports.sql`) restricts every user to their own folder
(`<user_id>/<filename>`) for both uploads and reads, with an admin-only override for reading anyone's
attachment. The action re-validates that path prefix server-side too, as defense in depth beyond RLS.
Viewing an attachment always requires generating a short-lived signed URL
(`getReportAttachmentSignedUrl()` in `src/lib/data/support.ts`) - there is never a plain public URL,
since the bucket is private.

**Admins** manage every report from `/admin/reports` (search by subject/name/email, filter by status
and category) and `/admin/reports/[id]` (full metadata, the attachment if any, and a form to update
status - `open`/`in_progress`/`resolved`/`closed` - and an internal admin note). The admin note is
never selected by, or exposed to, the reporting user - RLS (`support_reports_select`) lets a
non-admin see their own report row (including the `admin_note` *column* existing in the schema), but
the UI simply never surfaces it anywhere on the user-facing side, and there's no user-facing page
that even fetches a single report by id to render it. Reports are otherwise immutable from the
reporting user's side once filed (a normal support-ticket UX) - only an admin can update status/note
(`support_reports_update_admin` RLS policy).

**Email notifications**: whenever a report is saved, every admin gets an email (subject, category,
description, reporter, date/time, page URL, and a direct link into `/admin/reports/[id]`) via Resend
(`src/lib/email/resend.ts`, `notifyAdminsOfReport.ts`) - see
[Required environment variables](#6-configure-environment-variables) for `RESEND_API_KEY`. Admin
emails are resolved via a new, narrowly-scoped RPC, `get_admin_notification_emails()`
(`0016_support_reports.sql`): unlike the existing `admin_get_user_emails()` (which requires the
*caller* to already be an admin - the reporting user filing this specific report usually isn't), this
one is callable by any authenticated user, but its query is self-scoped to only ever return emails
belonging to `role = 'admin'` accounts - never the full user list, and never something the caller
can widen. **The report is always saved first**; the email step runs afterward inside its own
try/catch (on top of `notifyAdminsOfNewReport()`'s own internal one), so a Resend outage, a missing
`RESEND_API_KEY`, or any other email-delivery failure is logged (`[email]`-tagged, no API key ever
logged) and swallowed - never turns an already-successful submission into an error response, and
never loses the report itself.

### Swapping the AI Scanner's Vision provider

`src/lib/vision/types.ts` defines a single `VisionProvider` interface with one method,
`scanStickerBacks(imageBase64, mimeType)`, returning the team code + in-team number + confidence for
every sticker back detected in the photo. `getVisionProvider()` in `src/lib/vision/index.ts` returns
`OpenAiVisionProvider` when `OPENAI_API_KEY` is set, otherwise `MockVisionProvider`. To add another
backend (Google Cloud Vision, a custom model, etc.), implement the interface and add a branch in
`getVisionProvider()` - nothing in `src/lib/actions/scanner.ts` or the UI needs to change. Detected
stickers are marked `status = 'have'` (green) in `user_stickers`, unless already marked `'duplicate'`
(blue) - a scan never silently removes a sticker from someone's marketplace listings.

### Sticker Scanner reliability: root cause + fixes

**The actual root cause** of "the scanner fails after every uploaded image": Next.js's Server
Action request body limit defaults to **1MB**, and `next.config.ts` never configured
`experimental.serverActions.bodySizeLimit` - so virtually every real phone photo (the scanner
accepts up to 8MB) was rejected by Next.js itself, before `scanStickerBacksAction`'s own code ever
ran. This is now set to `"10mb"` (with `experimental.proxyClientMaxBodySize` set alongside it for
Next.js 16's internal proxy layer) - see the comment in `next.config.ts`.

**A related, deliberate mitigation, not just a body-size bump**: every photo is now resized/
re-encoded to a modest JPEG *client-side*, before it's ever attached to the upload form
(`src/lib/image/resizeForUpload.ts`, wired into `ScannerApp.tsx`). This solves three things at once:

- **Body size**: a photo downscaled to ≤1600px on its longest side and re-encoded as JPEG is almost
  always well under 1MB regardless of the original - a much bigger safety margin than raising one
  config value alone, especially since Vercel's own serverless function payload limit is a separate,
  platform-level ceiling this repo can't configure (see "Manual production verification" below).
- **HEIC support ("if the application is intended to support mobile uploads")**: iOS's default
  camera format (HEIC) isn't accepted by OpenAI's Vision API, and there's no reliable pure-JS HEIC
  decoder for a Vercel serverless runtime. Instead, `createImageBitmap()` - which iOS/Safari can
  decode HEIC through *natively* (the OS-level image codec, not a JS/WASM one) - decodes the photo
  client-side, which is then re-encoded to JPEG via `<canvas>`. Browsers that can't decode HEIC (most
  non-Apple browsers) get one specific, clear Hebrew error instead of a confusing failure three steps
  later in the pipeline.
- **Consistency**: every image the backend ever receives from this flow is already a valid,
  reasonably-sized JPEG - the broad JPEG/PNG/WEBP/HEIC allow-list in `scanner.ts` only remains as a
  defensive backstop, not something the happy path depends on.

**A secondary, defensive finding**: this project has a documented history of individual migrations
not reliably reaching production before CI/CD automation existed (see below) - `scan_events.mode`'s
check constraint was widened by `0011_shashot_teams.sql` to allow the scanner's current
`'sticker_backs'` value (it originally only allowed old `'duplicates'`/`'album'` modes). If a given
production database somehow still had the pre-`0011` constraint, every scan attempt would fail on
the rate-limit log insert with a Postgres check-constraint violation - exactly the kind of failure
that used to become this app's generic error boundary before the error-handling pass below.
`0015_scanner_reliability.sql` just re-asserts the correct constraint, idempotently - a no-op if
`0011` already applied cleanly, a real fix if it somehow didn't.

**Error handling, not a generic fallback**: `scanStickerBacksAction` previously had several calls
(`getVisionProvider()`, `requireAuth()`, `readImage()`, `checkAndLogScan()`) outside its one
try/catch, and the try/catch it did have returned the *raw* caught error message verbatim
(`err.message`) - an English stack trace or a raw OpenAI HTTP error body, not a Hebrew message, and
never logged server-side first. Now:

- The whole action body is wrapped in a top-level try/catch, so nothing can become an uncaught
  exception that surfaces the app's generic `error.tsx` boundary (`"משהו השתבש"`) instead of a real,
  actionable message.
- `src/lib/vision/errors.ts` defines specific error types (`VisionApiError` with an HTTP status,
  `VisionTimeoutError`, `VisionParseError`) that `openaiProvider.ts` throws instead of a generic
  `Error` - `toUserFacingScanError()` in `scanner.ts` maps each to a distinct Hebrew message (auth
  misconfigured, provider busy/down, request timed out, couldn't parse the AI's response, or
  couldn't identify stickers in a clear photo) instead of one catch-all string.
- The raw technical detail (HTTP status, truncated response body, stack trace) is always logged via
  `console.error` first, tagged `[scanner]` - server-side only, never sent to the client, and never
  including the image bytes or the `OPENAI_API_KEY` itself.
- An explicit 25-second timeout (`AbortController`) wraps the OpenAI request, so a hung upstream call
  can't run until Vercel's own function timeout kills it with an opaque platform-level error instead.
- GPT models occasionally wrap their JSON response in a ` ```json ... ``` ` markdown fence even when
  told not to - `openaiProvider.ts` strips that before parsing instead of treating it as a hard
  failure.
- Zero detected stickers is **not** an error (a photo that genuinely has no readable sticker backs is
  a normal outcome) - the action still returns success, and `ScannerApp.tsx` shows a specific "no
  stickers detected, try a clearer photo" message instead of silently showing nothing.

## Automated database migrations (CI/CD)

**Root cause of a real incident**: migration `0011_shashot_teams.sql` was merged to `main` but never
actually applied to the production database - `select count(*) from public.teams` failed with
`relation "public.teams" does not exist` in production, even though the file was clearly present in
the repo. This happened because **this repo had no automation of any kind that applies
`supabase/migrations/*.sql` anywhere** - the "Getting started" instructions below always said to run
migrations "in the Supabase SQL Editor (or via `supabase db push` / `psql` locally)", i.e. as a
**manual step a human has to remember to do after every single merge**. It's easy to forget, and
nothing in CI or the deploy pipeline ever verified it happened - Vercel deploys the Next.js app
regardless of whether the database schema it depends on actually matches.

**The fix**: `.github/workflows/database.yml`, which removes the human from this loop entirely:

1. **`test-migrations`** runs on every pull request (and push to `main`) that touches
   `supabase/migrations/**`: it spins up a throwaway Postgres container, simulates just enough of
   Supabase's `auth` schema for our migrations to reference (`supabase/testing/auth_schema_stub.sql`),
   and applies every migration file in order, then `seed.sql` as a sanity check. A broken migration
   now **fails the PR**, before it can ever reach `main` - this is exactly the kind of mistake that
   would previously only be discovered in production.
2. **`deploy-migrations`** runs on every push to `main` that passes (1): it uses the official
   `supabase/setup-cli` action to run `supabase link` + `supabase db push` against the real project -
   `db push` only applies migrations Supabase's own tracking table (`supabase_migrations.schema_migrations`)
   doesn't already have a record of, so merging a PR with a new migration file is now the *entire*
   deployment step. No SQL Editor, no `psql`, no human in the loop.

### Required one-time setup (do this before merging any more migrations)

This workflow needs three **GitHub Actions repository secrets** (Settings → Secrets and variables →
Actions in this GitHub repo - **not** Cursor's Cloud Agent secrets, which only apply to this
sandbox, and **not** Vercel's environment variables, which are a separate system entirely):

| Secret | Where to find it |
| --- | --- |
| `SUPABASE_ACCESS_TOKEN` | [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens) → Generate new token |
| `SUPABASE_PROJECT_ID` | Your project's dashboard URL: `https://supabase.com/dashboard/project/<this-is-it>` |
| `SUPABASE_DB_PASSWORD` | Supabase dashboard → Project Settings → Database → Database password (the one you set when creating the project; reset it there if you don't have it) |

After adding these, the **first** `deploy-migrations` run will hit a real problem worth knowing
about: migrations `0001`-`0010` (and, until you've run it by hand once, `0011`/`0012` too) were
applied to production manually (via the SQL Editor), so Supabase's
`supabase_migrations.schema_migrations` tracking table has **no record** of them ever running. A
naive `supabase db push` would try to re-run every migration from scratch and fail on the ones that
try to create already-existing tables. Fix this **once**, from a machine with the Supabase CLI and
network access to your project:

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>

# 1. Get production's public schema in sync RIGHT NOW (unblocks the app immediately):
#    copy the full contents of supabase/migrations/0011_shashot_teams.sql, then
#    0012_worldcup2026_teams.sql, then 0013_matches_map.sql, then
#    0014_admin_dashboard.sql, into the Supabase Dashboard -> SQL Editor and run
#    each, in that order, if you haven't already.

# 2. Tell Supabase's tracking table that 0001-0014 are already applied, so future
#    `db push` runs only ever apply what's genuinely new from here on:
npx supabase migration repair --status applied 0001 0002 0003 0004 0005 0006 0007 0008 0009 0010 0011 0012 0013 0014

# 3. Confirm local and remote agree before trusting CI with it:
npx supabase migration list
```

`migration list` should show every version present in both the `Local` and `Remote` columns after
this. From this point on, **never** apply a migration by hand again - merge the PR, and
`deploy-migrations` does it for you. (If you ever do need to run one manually in an emergency, run
`supabase migration repair --status applied <version>` for it afterward so the tracking table stays
truthful - an untracked manual change is exactly how this incident happened in the first place.)

The `deploy-migrations` job runs under a GitHub **Environment** named `production`. This works with
zero extra configuration, but if you'd like a manual approval gate before any migration reaches your
real database (e.g. requiring a specific person to click "Approve" in the Actions tab), configure
that in this GitHub repo's **Settings → Environments → production → Required reviewers** - this repo
intentionally ships without that gate by default, per the requirement that merging should be the only
step needed, but it's a one-click opt-in if you want extra ceremony around production schema changes.

### Why not just re-run every migration idempotently and skip the tracking table?

Every migration in this repo is deliberately written to be idempotent (`create table if not exists`,
`drop policy if exists` + `create policy`, `create or replace function`, etc.) specifically so that a
mistake like this is *recoverable* rather than catastrophic - and it's a big part of why the
production incident above was a missing-migration problem and not a data-loss problem. But relying on
blind idempotent re-runs as the *primary* deployment mechanism is fragile: `0011` includes real data
migrations (remapping existing rows, then dropping the old tables) that are only safe to run once, and
Supabase's own tooling (`db push`, `migration list`, `migration repair`) is built around trusting the
tracking table - fighting that model instead of using it is how projects end up with permanently
confusing "is this actually applied?" drift. Doing the one-time repair above costs a few minutes and
gets this repo fully aligned with how `supabase db push` is meant to be used going forward.

## Getting started

### 1. Create a Supabase project

Create a free project at [supabase.com](https://supabase.com), or run Supabase locally with the
[Supabase CLI](https://supabase.com/docs/guides/local-development) (`supabase start`).

### 2. Run the database migrations, in order

**If this project is already wired up to [`.github/workflows/database.yml`](#automated-database-migrations-cicd)
(GitHub Actions secrets configured, tracking table repaired)**, merging to `main` applies every
migration automatically - you can skip straight to step 3. The steps below are for the very first
setup of a brand new project (before CI is wired up), or for local development via the Supabase CLI.

In the Supabase SQL Editor (or via `supabase db push` / `psql` locally):

1. `supabase/migrations/0001_schema.sql`
2. `supabase/migrations/0002_rls_policies.sql`
3. `supabase/migrations/0003_location.sql`
4. `supabase/migrations/0004_trade_chat.sql`
5. `supabase/migrations/0005_notifications.sql`
6. `supabase/migrations/0006_marketplace.sql`
7. `supabase/migrations/0007_hardening.sql`
8. `supabase/migrations/0008_bootstrap.sql`
9. `supabase/migrations/0009_auth_trigger_resilience.sql`
10. `supabase/migrations/0010_reconcile_profile_contacts.sql`
11. `supabase/migrations/0011_shashot_teams.sql`
12. `supabase/migrations/0012_worldcup2026_teams.sql`
13. `supabase/migrations/0013_matches_map.sql`
14. `supabase/migrations/0014_admin_dashboard.sql`
15. `supabase/migrations/0015_scanner_reliability.sql`
16. `supabase/migrations/0016_support_reports.sql`

All 16 files were validated end-to-end (schema + RLS + triggers + seed) against a real Postgres
instance from a completely empty database, both individually and as a full clean run - see the PR
description for details. **This is the only SQL you should ever need to run** - no follow-up manual
inserts/updates are required, including for your first admin account (see step 4) or the sticker
catalog (48 national teams × 20 stickers each are seeded automatically by `0011`/`0012`). If sign-in ever
fails with "Database error saving new user", see
[Diagnosing "Database error saving new user"](#diagnosing-database-error-saving-new-user) above -
`supabase/diagnostics/check_auth_trigger.sql` is a read-only script for exactly that. If your
project was created before `0010`/`0011` existed, just running whichever ones you're missing (safe
to run any time, on any project, and designed to preserve existing collections - see
[Visual collection model](#visual-collection-model-teams--sticker-codes) above) resolves it - no
manual SQL, no data loss.

> If you already ran an earlier subset of these migrations for a previous release, you only need to
> additionally run whichever ones you're missing - each is a pure addition/alteration and safe to
> apply on top of the previous ones.

### 3. Enable Realtime (hosted Supabase projects)

Migrations 0004 and 0005 already add `trade_messages` and `notifications` to the
`supabase_realtime` publication automatically when it exists (i.e. on a real Supabase project) - no
manual step needed. If you're running a bare/self-hosted Postgres without that publication, chat
and the notification bell still work via normal queries + Server Actions; they just won't update
live without a page refresh.

### 4. Configure Auth URLs (required, one-time, dashboard only - not SQL)

In your Supabase project dashboard → **Authentication → URL Configuration**:

- Set **Site URL** to your app's URL (`http://localhost:3000` for local dev, your Vercel URL in
  production).
- Add the same URL (and `http://localhost:3000` for local testing against a hosted project) to
  **Redirect URLs**.

This is standard, unavoidable Supabase Auth configuration (the same as any app using hosted auth) -
it's a dashboard setting, not a SQL/database edit, and only needs to be done once per project. Without
it, email confirmation links and OAuth/magic-link redirects will be rejected by Supabase regardless of
anything in this app's code.

### 5. (Optional) Seed demo data for local testing

`supabase/seed.sql` is **for local development only** - it inserts directly into `auth.users` /
`auth.identities`, which only works against a local Supabase stack (`supabase start` /
`supabase db reset`, which runs `supabase/seed.sql` automatically). **Never run it against a
hosted/production Supabase project.**

The team/sticker catalog itself (48 teams × 20 stickers = 960) is already fully seeded by the migrations
above - this script only adds 10 demo accounts (password `Password123!` for all of them), sample
collections spread across several real teams (including a couple of priced marketplace listings) so
matches show up immediately, approximate demo locations for 5 of the accounts, a couple of sample
trade requests (one pending, one already accepted with sample chat history), and the notifications
those events generate:

| Email | Role | City | Location set? |
| --- | --- | --- | --- |
| admin@shashot.local | admin | תל אביב יפו | – |
| dana@shashot.local | user | תל אביב יפו | ✅ |
| yossi@shashot.local | user | תל אביב יפו | ✅ |
| noa@shashot.local | user | רמת גן | ✅ |
| amit@shashot.local | user | חיפה | ✅ |
| tamar@shashot.local | user | חיפה | ✅ |
| eli@shashot.local | user | ירושלים | – |
| maya@shashot.local | user | באר שבע | – |
| roi@shashot.local | user | אשדוד | – |
| gali@shashot.local | user | פתח תקווה | – |

On a **hosted** Supabase project, don't run this file. Instead, just sign up normally through the app
UI - **the very first account created on a fresh project is automatically made an admin** (see
[Zero-touch production bootstrap](#zero-touch-production-bootstrap) above), so there's nothing extra
to do. If you later want to promote an *additional* admin, that's a normal admin-management action:

```sql
update public.profiles set role = 'admin' where id = '<the user''s auth.users id>';
```

### 6. Configure environment variables

```bash
cp .env.example .env.local
```

Required:

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` - from your Supabase project's
  **Settings → API** page. Missing either of these throws a clear startup error naming exactly which
  one to set, instead of a cryptic library error.

Recommended:

- `NEXT_PUBLIC_SITE_URL` - your deployed domain, used for share links and as the base for the auth
  email confirmation redirect. If you skip this, the app derives it from the incoming request's host
  header instead (so it still works on a fresh Vercel deploy), but setting it explicitly is safer if
  you have multiple domains/preview URLs pointing at the same Supabase project.

Optional:

- `OPENAI_API_KEY` / `OPENAI_VISION_MODEL` - enables real AI detection in the Sticker Scanner. Leave
  unset to use the built-in mock provider (fully functional, no external calls).
- `SUPABASE_SERVICE_ROLE_KEY` - only needed for one specific admin action, permanently deleting a
  user (`/admin/users/[id]` → "מחיקת משתמש לצמיתות"), which needs the Auth Admin API to remove the
  underlying `auth.users` row. Every other admin feature works without it. From your Supabase
  project's **Settings → API → service_role key** (marked "secret"). **Never** expose this to the
  client, prefix it with `NEXT_PUBLIC_`, or commit it - it bypasses Row Level Security entirely. See
  [Admin dashboard](#admin-dashboard) above for exactly how/where it's used.
- `RESEND_API_KEY` / `SUPPORT_NOTIFICATIONS_FROM_EMAIL` - enables the "email every admin when a bug
  report is submitted" notification (see
  [Support / bug reports](#support--bug-reports-תקלות-ומשוב) above). Get a key from
  [resend.com/api-keys](https://resend.com/api-keys); `SUPPORT_NOTIFICATIONS_FROM_EMAIL` should be a
  verified sender on your Resend account/domain (e.g. `"Shashot <support@yourdomain.com>"`). Leaving
  either unset doesn't break anything else - the report itself is always saved and the user always
  sees a success confirmation either way; only the admin email is skipped (logged, not thrown).

### 7. Install dependencies & run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Register the first account - it will
automatically be an admin.

### 8. (Optional) Add more teams to the catalog (as an admin)

The catalog already ships with the official 48-team FIFA World Cup 2026 roster (20 stickers each) seeded by the migrations -
there's nothing required here. If you want to add more teams, log in as an admin and go to
**אזור ניהול → קטלוג מדבקות**: enter a 3-letter code, Hebrew name, and optional flag emoji, and the
system automatically generates that team's 20 stickers (`CODE-1` through `CODE-20`).

## Deploying to Vercel + Supabase

1. **Supabase**: create a project, run all 16 migrations from `supabase/migrations/` in order (SQL
   Editor or `supabase db push`) to get the initial schema in place. Do **not** run `seed.sql`
   against it (it has a built-in guard that refuses to run if it detects any non-demo account already
   exists, but the safest rule is simply: don't run it against a hosted project at all).
2. **Wire up automated migrations** (do this once, right after step 1): add the three GitHub Actions
   secrets described in [Automated database migrations](#automated-database-migrations-cicd) above
   (`SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_ID`, `SUPABASE_DB_PASSWORD`), then run the one-time
   `supabase migration repair --status applied ...` command from that section so Supabase's tracking
   table matches what you just applied by hand in step 1. From then on, `.github/workflows/database.yml`
   applies every future migration automatically on merge to `main` - **no more manual SQL Editor
   visits, ever**, which is exactly the gap that let a real migration ship to `main` without ever
   reaching production (see that section for the full incident writeup).
3. **Supabase Auth URLs**: in **Authentication → URL Configuration**, set the Site URL to your
   Vercel URL and add it to the Redirect URLs allow-list (see "Configure Auth URLs" in
   [Getting started](#getting-started) above). Required for email confirmation to work.
4. **Vercel**: import this repo, framework preset "Next.js" (auto-detected). Add the environment
   variables from `.env.example` in Project Settings → Environment Variables:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (from Supabase → Settings → API)
   - `NEXT_PUBLIC_SITE_URL` set to your production URL (e.g. `https://your-app.vercel.app`) - not
     strictly required (see "Recommended" above) but avoids any ambiguity across preview deployments
   - `OPENAI_API_KEY` (optional, enables real AI Scanner detection)
   - `SUPABASE_SERVICE_ROLE_KEY` (optional, only needed for the admin "delete user" action - see
     [Configure environment variables](#6-configure-environment-variables) above)
   - `RESEND_API_KEY` / `SUPPORT_NOTIFICATIONS_FROM_EMAIL` (optional, only needed for the "email
     admins when a bug report is submitted" notification - see
     [Configure environment variables](#6-configure-environment-variables) above)
5. Deploy. No build-time secrets or server infra beyond Supabase + Vercel (+ GitHub Actions for step
   2) are required - there's no custom server, cron job, or queue in this Beta.
6. Sign up through the live app. **You're automatically an admin** - nothing else to configure. The
   sticker catalog (48 teams × 20 stickers) is already seeded; add more teams any time from
   **אזור ניהול → קטלוג מדבקות** if you like.

That's the entire deployment - after the one-time setup in steps 1-2, there are no more SQL editor
visits or manual profile/role edits, for this release or any future one.

### Production checklist (verified during the production-bootstrap pass)

- ✅ `npm run build` (TypeScript strict), `npm run lint`, and `npm test` all pass clean.
- ✅ All 16 migrations + `seed.sql` re-applied from a completely empty Postgres database (multiple
  times, including a full clean-room run for this pass) with zero errors.
- ✅ Simulated the exact "profile row missing for an authenticated user" edge case against a real
  Postgres and confirmed the app's self-heal path (the same upsert `getCurrentProfile()` performs)
  succeeds under RLS exactly as it would in the running app - this is what prevents the
  login-succeeds-but-dashboard-never-loads failure mode.
- ✅ Simulated the first-signup-becomes-admin bootstrap end-to-end: first `auth.users` insert on a
  fresh database → `profiles.role = 'admin'`; second insert → `profiles.role = 'user'`.
- ✅ Reproduced Supabase's actual restricted `supabase_auth_admin` role locally (not just `postgres`,
  which bypasses all privilege checks) and confirmed `handle_new_user()` correctly provisions a
  profile under that role for both email- and Google-shaped `raw_user_meta_data` payloads.
- ✅ Deliberately broke the `profiles` schema to force a real trigger exception, and confirmed
  `auth.users` row creation still succeeds (sign-in is no longer blocked) while the exact
  `SQLSTATE`/`SQLERRM` is logged via `RAISE WARNING` - see "Diagnosing 'Database error saving new
  user'" above.
- ✅ `/auth/callback` and `/auth/confirm` verified via the dev server: with no `code`/`token_hash`
  present they redirect to `/login?error=confirmation_failed`, which renders a clear Hebrew message
  (the success path requires a real Supabase project's email link and can't be exercised in this
  sandbox - see the manual QA checklist).
- ✅ Auth flow (register/login/logout) exercised via the dev server; protected `/dashboard` and
  `/admin` routes correctly 307-redirect unauthenticated requests via `src/proxy.ts`; custom
  `not-found.tsx`/`error.tsx`/`global-error.tsx` pages verified.
- ✅ RLS re-validated end-to-end on a real local Postgres for every table, including a full security
  regression pass (see the [manual QA checklist](#manual-qa-checklist-pre-launch) below for the
  exact scenarios): location privacy, chat isolation, notification spoofing, suspended-user
  enforcement, and contact-reveal rules.
- ✅ `getVisionProvider()` confirmed (by unit test and code review) to select the mock provider
  whenever `OPENAI_API_KEY` is unset/empty, and the real provider only when it's set.
- ✅ `getSupabaseEnv()` confirmed (by unit test) to throw a clear, actionable error naming the exact
  missing env var instead of the underlying library's cryptic default message.

## Available scripts

```bash
npm run dev     # start the dev server
npm run build   # production build (also runs the TypeScript check)
npm run start   # run the production build
npm run lint    # ESLint
npm test        # Vitest unit tests (matching, sticker code parsing, distance, vision provider, cities)
```

## Security notes

- Every table has Row Level Security enabled; there is no table that relies solely on
  application-level checks for authorization.
- `profile_contacts` (phone/WhatsApp) is only readable by the owner, an admin, or a user with an
  `accepted`/`completed` trade with that person - enforced by an RLS policy.
- `profile_locations` (approximate coordinates) is only readable by its owner or an admin - full
  stop. Other users only ever see a computed distance via `nearby_distances()`.
- `trade_messages` is only readable/writable by the trade's two participants (or an admin); only
  the recipient may mark a message read.
- `notifications` rows are only ever created server-side by `SECURITY DEFINER` trigger functions,
  never inserted directly by a client, and are only readable/markable-read by their own recipient.
- A Postgres trigger blocks non-admin users from changing their own `role` or `status` columns,
  even if they craft a raw API request.
- A second trigger validates trade-request status transitions server-side (e.g. only the recipient
  may accept/decline; only a participant may complete or cancel) and also rejects any transition
  attempted by a suspended account, so the UI's button visibility is a UX nicety, not the source of
  truth.
- Suspended users are blocked at the RLS/trigger level from creating trade requests, responding to
  them, and sending chat messages - not just hidden from the UI. See "Suspended users are blocked at
  the database level" above.
- Admin actions (suspend/reactivate/edit/delete users, catalog changes, trade cancel/complete/delete)
  are written to `admin_logs` for a basic audit trail. An admin cannot suspend, delete, or demote
  their own account, and cannot delete another admin account without demoting them first (all
  checked in the Server Action, not just RLS).
- Every `/admin/*` page is gated by a **Server Component** layout that redirects before rendering or
  fetching anything for a non-admin - not a client-side check that could be bypassed by disabling
  JavaScript or hitting the URL directly. Every admin Server Action independently re-verifies
  `role === 'admin'` too, so calling an action directly (bypassing the UI) is equally blocked. See
  [Admin dashboard](#admin-dashboard) above.
- Deleting a user goes through the Supabase **Auth Admin API** (service-role key), gated behind
  `requireAdmin()` - the service-role client (`serviceRole.ts`) is never imported by client code and
  is the only place in this codebase that bypasses RLS.
- `trade_requests` previously had no `DELETE` RLS policy at all (an oversight, not a deliberate
  restriction) - `0014_admin_dashboard.sql` adds an admin-only one; verified locally that a
  non-admin's delete attempt still affects 0 rows.
- Rate limiting on trade requests, chat messages, auth attempts, and AI Scanner uploads - see "Rate
  limiting & abuse prevention" above.
- File uploads to the AI Scanner are validated (type allow-list + 8MB size cap) both client- and
  server-side before ever reaching the Vision provider.
- Profile/contact self-healing (see "Zero-touch production bootstrap" above) only ever creates a row
  for the currently-authenticated user's own `auth.uid()` - it cannot be used to create or overwrite
  another user's data, and never overwrites an existing row (`ON CONFLICT DO NOTHING`).
- Auth errors are never shown to the user verbatim - `normalizeAuthError()` only returns
  explicitly-whitelisted messages, and the original error is always logged server-side first. See
  "Auth error handling" above.
- Google sign-in reuses the exact same profile-creation trigger, RLS policies, and admin-bootstrap
  logic as email/password signup - there is no separate, weaker code path for OAuth users.

## Manual QA checklist (pre-launch)

Automated coverage (RLS/trigger tests against a real Postgres, `npm test`, `npm run build`/`lint`)
is described above. Before a public launch, also walk through this list by hand against a real
Supabase project + deployed frontend, since some of it (browser permissions, realtime delivery,
third-party share sheets) can't be fully exercised in CI:

**Core user journey**

- [ ] On a brand new Supabase project (only the 16 migrations run, no seed, no manual SQL), register
      the very first account and confirm it lands in the admin panel (`role = 'admin'`) automatically
- [ ] If "Confirm email" is enabled in your Supabase project: register a second account, click the
      confirmation link in the email, and confirm it redirects straight into the dashboard already
      logged in (not back to the login page)
- [ ] With Google sign-in enabled in Supabase (see "Enabling Google sign-in" above), click
      "המשך עם Google" on the register page, approve the Google consent screen, and confirm you land
      in the dashboard with a profile already created (check the "complete your profile" banner
      prompts for city/phone, since Google doesn't provide them)
- [ ] Sign in with the same Google account a second time and confirm it logs in (not a duplicate
      account) and preserves any profile edits made after the first sign-in
- [ ] If Google sign-in is the very first signup on a fresh project, confirm that account is also
      automatically an admin, exactly like the first email signup would be
- [ ] If you ever see "Database error saving new user" again, run
      `supabase/diagnostics/check_auth_trigger.sql` in the SQL Editor and check Supabase Dashboard →
      Logs → Postgres Logs for a `handle_new_user` warning with the exact SQL error - it should no
      longer be possible for this to permanently block sign-in (see "Diagnosing..." above)
- [ ] Force a registration error (e.g. temporarily point `NEXT_PUBLIC_SUPABASE_URL` at an invalid
      host, or just watch for it under real network flakiness) and confirm the form shows a readable
      Hebrew message - never `"{}"`, raw JSON, or `[object Object]` - and that the real error appears
      in your server/Vercel logs
- [ ] Open "האוסף שלי", tap a team card, and tap through several stickers to confirm the
      gray → green → blue → red → gray cycle is instant with no modal dialogs; try
      "Mark all as owned" and "Clear all", then confirm "Save" persists after a page refresh
      (and that navigating away with unsaved changes prompts a browser confirmation)
- [ ] Mark a sticker blue (duplicate) in the grid, then find and edit its listing type/price/note on
      the "הכפולים שלי" marketplace page
- [ ] Run the AI Scanner using the mock provider: confirm it returns a handful of detected
      `TEAMCODE-number` stickers, correct a detected code, remove a row, add one manually, then save
      and confirm those stickers turn green in the collection grid
- [ ] Enable location from the profile page (grant the browser permission prompt) and confirm the
      matches page switches to distance-based sorting; disable it again and confirm it falls back to
      city-based sorting
- [ ] On `/dashboard/matches` with location enabled, confirm the "מפה" tab is selected by default and
      shows a map centered on Israel with a marker per nearby matching collector who has location
      enabled; click a marker and confirm the popup shows name, city, distance, give/receive counts,
      top sticker codes, and a working "שלח בקשת טרייד" button; switch to "רשימה" and confirm the
      existing card list still works unchanged
- [ ] With location disabled, confirm `/dashboard/matches` defaults to the "רשימה" tab, and that
      clicking "מפה" shows the "כדי לראות התאמות על המפה, הפעל מיקום בפרופיל" prompt instead of an
      empty/broken map
- [ ] With location disabled but a city filled in on the profile, confirm you still get a marker on
      the map (once you switch to the "מפה" tab) - approximated to that city, with the popup
      showing "מיקום משוער לפי הפרופיל" (not the GPS wording, and no distance shown)
- [ ] On the registration form and profile page, confirm the city field is a searchable text box
      (not a giant dropdown) and that typing "עתל" finds עתלית
- [ ] Find a match and send a trade request with suggested give/receive stickers
- [ ] As the recipient, accept one trade request and decline another; confirm contact info appears
      only after acceptance
- [ ] Send a few chat messages back and forth on an accepted trade; confirm they appear in order,
      auto-scroll, and the unread badge on the trades list clears after opening the chat
- [ ] Confirm a notification arrives (bell badge + dropdown) for the trade request, the acceptance,
      and the chat message; mark one as read and confirm "mark all as read" works
- [ ] Mark a duplicate as "for sale" with a price and note; confirm it shows up correctly to a
      collector who needs that sticker
- [ ] As an admin, suspend a test user, then (as that user) confirm you can no longer send a trade
      request or a chat message, but can still log in and see the suspension banner; reactivate and
      confirm actions work again
- [ ] Confirm "סורק AI" is no longer in the main nav, but is still reachable from "האוסף שלי" and the
      dashboard, and still fully works end-to-end (scan → review → save)
- [ ] As an admin, open `/admin` and confirm the 8 dashboard stat cards and the 3 quick-link cards
      all show real numbers (not placeholders); confirm none of `/admin/*` is reachable as a
      non-admin (direct URL, not just the hidden nav link)
- [ ] On `/admin/users`, search by a partial name, email, and city and confirm each narrows the
      table; open a user's detail page and confirm the edit form saves changes (try changing their
      city and, on a throwaway test account, promoting/demoting the role); confirm
      suspend/reactivate still works from this page too
- [ ] With `SUPABASE_SERVICE_ROLE_KEY` configured, delete a throwaway test user from their detail
      page and confirm the confirmation dialog, then that they're gone from `/admin/users` and can
      no longer log in (a fresh signup with the same email should work, proving the `auth.users` row
      was actually removed, not just the profile)
- [ ] On `/admin/trades`, confirm every trade in the system is listed (not just the admin's own);
      cancel one, force-complete another, and delete a third - confirm each action's button set
      updates correctly afterward and that a deleted trade's chat messages are gone too
- [ ] On `/admin/statistics`, confirm the sticker/trader rankings and the two 14-day charts show
      real numbers that change after you create new test data (not the same numbers every time)
- [ ] Confirm the header logo renders at ~44px tall without changing the navbar's height, on both
      desktop and mobile, and that the current page's nav link is visibly highlighted (desktop and
      mobile menu both)
- [ ] On the landing page, confirm the icon-only logo appears above the headline with its soft
      background glow, and that the closing CTA section's green-to-blue gradient and white button
      are both legible
- [ ] Check the browser tab: confirm the favicon is the new branded icon (not a generic default),
      and that the tab title matches the current page (e.g. "ניהול משתמשים | Shashot", not a
      double `"... | Shashot | Shashot"` suffix)
- [ ] On iOS Safari, "Add to Home Screen" and confirm the new dark-navy app icon is used (not a
      screenshot thumbnail)
- [ ] Receive a new trade/chat notification, then click "סמן הכל כנקרא" from the bell dropdown -
      confirm the badge clears immediately; separately, open `/dashboard/notifications` and click
      "סמן הכל כנקרא" there instead - confirm **the header's badge also clears immediately**,
      without navigating anywhere or refreshing; reload the page afterward and confirm everything is
      still marked read (i.e. it actually persisted, not just a client-side illusion)
- [ ] Temporarily break the mark-all RPC (e.g. revoke its grant in the SQL Editor) and confirm
      clicking "סמן הכל כנקרא" shows a Hebrew error message and the unread items revert (rather than
      silently doing nothing or showing an English error) - then restore the grant
- [ ] From a real iPhone (Safari), open the AI Scanner, take a photo directly with the in-page camera
      capture, and confirm it scans successfully (this is the exact HEIC-by-default path that used to
      fail) - also try picking an existing large photo from the camera roll
- [ ] From a desktop browser, upload a large (5-8MB) JPG/PNG - confirm the "מעבד תמונה..." step
      completes quickly and the scan proceeds (this used to fail outright before the
      `bodySizeLimit`/client-resize fix)
- [ ] Upload a non-image file (e.g. a PDF renamed to `.jpg`, or an actual PDF) and confirm a specific
      Hebrew "unsupported format" message, not a generic crash
- [ ] Photograph something with no visible sticker backs (e.g. a blank wall) and confirm the scanner
      completes successfully and shows "לא זוהו מדבקות בתמונה" rather than an error or a silent no-op
- [ ] If `OPENAI_API_KEY` is configured, temporarily set it to an invalid value and confirm scanning
      shows a specific "שירות הזיהוי החכם אינו מוגדר כרגע כראוי" message (not a raw API error)
- [ ] From `/dashboard/support`, submit a report with every field filled in, including a screenshot -
      confirm the success message, and (if `RESEND_API_KEY` is configured) that every admin account
      receives an email with the report's details and a working link into `/admin/reports/[id]`
- [ ] Submit a report *without* a screenshot and confirm it still succeeds
- [ ] Submit a report as a non-admin, then confirm that account **cannot** browse to another user's
      report by guessing/changing the `/admin/reports/[id]` URL (should redirect, matching the
      existing `/admin/*` guard) - then, as an admin, confirm the same report **is** visible from
      `/admin/reports`, along with its category/description/attachment/page URL/user-agent
- [ ] As an admin, change a report's status and add an internal note, save, then reload the page and
      confirm both persisted; log in as the reporting user and confirm the internal note is nowhere
      visible to them
- [ ] Confirm "תקלות ומשוב" appears in both the desktop and mobile nav while signed in, with its icon,
      and does **not** appear anywhere in the logged-out landing-page nav

**Security spot-checks** (safe to do with two browser profiles / incognito windows)

- [ ] Confirm you cannot see another user's exact location anywhere in the UI or network tab -
      only a distance
- [ ] Confirm opening a trade chat URL for a trade you're not part of does not show any messages
- [ ] Confirm contact info is hidden for pending/declined/cancelled trades and only shown once
      accepted/completed

**Abuse prevention**

- [ ] Trigger the sign-in rate limit by failing a login several times quickly and confirm a clear
      Hebrew error appears
- [ ] Try uploading a non-image file (or an oversized image) to the AI Scanner and confirm a clear
      error appears immediately, without a server round-trip where possible

**Production readiness**

- [ ] Fresh Supabase project: run all 16 migrations in order, confirm no errors, do **not** run
      `seed.sql`, and confirm you never need to open the SQL editor again for basic usage (including
      getting your first admin)
- [ ] `select count(*) from public.teams;` returns exactly 48, and "האוסף שלי" shows 48 team cards,
      each with a real flag image (not a two-letter text fallback like "IL"/"BR") next to the Hebrew
      name and 3-letter code - check on both a Chromium-based browser and, if possible, a Windows
      machine without recently-updated fonts, since that's exactly the combination that showed plain
      text instead of flags before this was fixed
- [ ] Confirm the 3 GitHub Actions secrets for `.github/workflows/database.yml` are set
      (`SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_ID`, `SUPABASE_DB_PASSWORD`) and that
      `supabase migration list` shows every version in both the Local and Remote columns (see
      [Automated database migrations](#automated-database-migrations-cicd)) - then push a trivial
      no-op migration file and confirm the `deploy-migrations` job actually runs and succeeds in the
      GitHub Actions tab, so you know it's really wired up before relying on it for anything real
- [ ] Confirm the Auth URL Configuration (Site URL + Redirect URLs) is set for your deployed domain
- [ ] If offering Google sign-in, confirm the Google Cloud OAuth client's authorized redirect URI
      matches your Supabase project's callback URL exactly, and that the provider is enabled in
      Supabase → Authentication → Providers
- [ ] Confirm `OPENAI_API_KEY` is unset in your deployment and the AI Scanner still works end-to-end
      via the mock provider (look for the "מצב הדגמה" label in the scan result)
- [ ] Confirm share buttons work on both a mobile browser (native share sheet or WhatsApp) and
      desktop (WhatsApp link + copy-to-clipboard)
- [ ] Load the site on a real phone and check the header, forms, chat, and scanner upload flow for
      layout issues in RTL

## Known limitations / TODOs for future releases

- **Vercel's own serverless function payload limit is a separate ceiling this repo can't configure.**
  `next.config.ts`'s `serverActions.bodySizeLimit`/`proxyClientMaxBodySize` (fixed as part of the
  Scanner reliability work above) control Next.js's own request-body guard, but Vercel's platform
  itself has historically capped serverless function request bodies around ~4.5MB depending on plan/
  region - a setting controlled in your Vercel project, not in this codebase. The client-side photo
  resize (`resizeImageForUpload.ts`, ≤1600px JPEG, almost always well under 1MB) makes this a
  non-issue in practice for the AI Scanner's happy path, but if you ever raise
  `MAX_IMAGE_BYTES`/`bodySizeLimit` further, verify your Vercel plan's actual limit too.
- **HEIC support for the AI Scanner relies on the *browser's* HEIC decoder** (via
  `createImageBitmap()`), which works on iOS/Safari (including other iOS browsers, all WebKit-based)
  but not on most non-Apple browsers - those get a clear, specific Hebrew error instead of a silent
  failure, but can't scan a HEIC photo without first converting it themselves. A server-side WASM
  HEIC decoder (e.g. `heic-convert`/`libheif-js`, no native compilation needed - safe for Vercel) is
  a reasonable follow-up if this becomes a real support burden.
- **Admin bug-report email notifications require `RESEND_API_KEY`** to actually send (see
  [Support / bug reports](#support--bug-reports-תקלות-ומשוב) above) - every report is still saved and
  every user still sees a normal success confirmation without it; only the email step is skipped
  (logged, not thrown). No other part of this app has ever sent email beyond what Supabase Auth
  itself sends (confirmation/magic link), so this is the first real integration of that kind - a
  natural foundation if trade/chat notification *emails* (as opposed to in-app-only, see
  ["In-app notifications vs. email"](#in-app-notifications-vs-email) above) are ever built.
- **The current `public/branding/` PNGs are a close recreation of the finalized logo, not an export
  of the original source file.** The design tool available in this environment couldn't ingest the
  brand assets provided as chat attachments directly (no way to save an inline chat image to disk
  as a usable file); the icon mark and horizontal lockup were regenerated to match the provided
  logo and style-guide mockup as closely as possible (same "5"/card/soccer-ball icon, same
  green→blue gradient, same "SHASHOT" wordmark treatment), then background-removed and processed
  into the final asset set. If pixel-perfect original files (ideally real `.svg` vectors) become
  available, drop them into `public/branding/` under the same filenames (or `.svg` - see
  [Brand assets](#brand-assets) above for exactly which files to replace) and re-derive
  `favicon.ico`/`apple-icon.png`/the two `src/app/` convention copies from the new source.
- **The matches map has no marker clustering yet.** At country-wide zoom, two collectors only a few
  km apart can render with visually overlapping markers. The implementation is deliberately modular
  for this (see [Matches map](#matches-map-leaflet--openstreetmap)) - adding
  `react-leaflet-cluster` (or similar) is a follow-up, not a redesign.
- **Map marker jitter is a fixed ~2km, not distance-adaptive.** This is a reasonable default for a
  country-scale view; a future refinement could scale the jitter radius with local marker density
  (more jitter in dense cities, less in sparse areas) for a better privacy/usefulness trade-off.
- **Admin "total matches" and per-user match counts are computed with an O(n²) pass over every pair
  of active users** (`getMatchCountsByUser()` in `data/admin.ts`) on every dashboard/users-page load.
  Fine at beta scale (this is exactly the same complexity the map/list matching itself doesn't have,
  since that's scoped to one user at a time) - if the user base grows large enough for this to matter,
  cache it (e.g. a scheduled job writing to a small summary table) rather than computing on read.
- **Admin statistics have no caching either** - same reasoning, same fix if it's ever needed.
- **User impersonation ("login as user") isn't implemented**, per the brief - only the architecture
  for it (a same-guarded action in `actions/admin.ts`) is in place.
- **Region-based fallback ranking (`getLocationRank()`) still only has a hand-curated list for a few
  dozen well-known cities** (`CITY_REGIONS` in `cities.ts`); everything else falls back to real
  coordinate proximity (≤15km) instead, which is a reasonable default but not identical to genuine
  administrative-region matching (e.g. two towns 14km apart but in different natural "regions" would
  still count as rank 1). Not a regression - this fallback only matters for the small minority of
  matches without a real GPS-based distance at all.
- **`.github/workflows/database.yml` requires a one-time manual setup** (3 GitHub Actions secrets +
  one `supabase migration repair` command - see
  [Automated database migrations](#automated-database-migrations-cicd)) before it can deploy anything.
  Until that's done for a given Supabase project, new migrations still need to be applied by hand for
  that project - the workflow itself can't bootstrap its own credentials. This is inherent to any
  CI/CD-to-a-secret-holding-service setup, not something more code in this repo can remove.
- **No automatic rollback.** `supabase db push` only ever applies forward migrations; if a migration
  merged to `main` turns out to be broken in a way `test-migrations` didn't catch, fixing it means
  writing and merging a new forward migration (e.g. a `0012_fix_...sql`), not reverting `0011`'s file
  in git - Supabase's tracking table doesn't know about a migration that's already partially applied
  being deleted from the repo. Standard practice for any migration-based schema tool, documented here
  since it's a real behavior change from "nothing was automated, so nothing broke automatically."
- **Account linking across providers is whatever Supabase's project-level default is.** If someone
  registers with email/password using `foo@gmail.com` and later tries "Continue with Google" with
  that same address, Supabase's own account-linking behavior applies (this app doesn't add any
  custom logic on top) - check your project's Authentication settings if you want to control this
  explicitly. Not a security issue (RLS/ownership are unaffected either way), just a UX detail worth
  testing for your specific Supabase project configuration.
- **Google sign-in provides no city/phone.** The dashboard prompts these users to complete their
  profile, but there's no hard gate preventing them from browsing with an incomplete one - matching
  quality and trade contact reveal are degraded (not broken) until they do.
- **The "first signup is empty" check is not concurrency-safe.** Two signups within the same instant
  (vanishingly unlikely in practice, since it requires the very first two-ever requests to race) could
  theoretically both read "profiles is empty" and both become admin. Not worth a `SELECT ... FOR
  UPDATE`-style fix for a one-time bootstrap check; documented here for completeness.
- **`handle_new_user()` never blocks `auth.users` creation, even on its own internal failure** (see
  "Diagnosing 'Database error saving new user'" above) - by design, so a profile-provisioning hiccup
  can never turn into a permanent sign-in outage again. The trade-off: if that failure happens to
  affect the very first signup specifically, the app-level self-heal fallback (which mirrors the
  same admin-bootstrap check) picks up the slack, but it's a second code path to keep in sync if the
  bootstrap logic ever changes - see `ensureProfileExists()` in `src/lib/data/profile.ts`.
- **First-signup-becomes-admin is a bootstrap convenience, not a long-term access control model.**
  It only matters for the very first signup on a brand new project - sign up immediately after
  deploying so it's you, not a stranger who finds the URL first. For anything beyond initial setup,
  promote additional admins via the documented SQL snippet (or build a proper admin-invite flow as a
  future enhancement).
- **Notifications for new nearby matches** were intentionally left out of this Beta (the spec
  marked this optional "if efficient"); computing it reactively for every profile/sticker change
  would need a batched/debounced job rather than a per-row trigger. A natural next step is a
  scheduled Edge Function that periodically diffs each user's top matches and notifies on new
  high-score ones.
- **Push/email notification delivery** is not implemented, only the extensible schema seam
  (`dispatched_channels`) described above.
- The AI Scanner's OpenAI provider is implemented, gated correctly behind `OPENAI_API_KEY`, and
  covered by a unit test for provider *selection* - but the actual OpenAI request/response handling
  is unverified against a live key or real photos in this environment (none was available during
  development). Test it against real photos and tighten the prompt/parsing before relying on it in
  production; consider adding image pre-processing (crop/rotate) for better accuracy.
- Distance-based match sorting currently fetches all candidates in application code (fine at
  current/expected Beta scale); if the user base grows significantly, move the ranking into a
  single SQL function/materialized view.
- The in-process auth rate limiter (`src/lib/rateLimit.ts`) resets on cold start and isn't shared
  across serverless instances - a reasonable "basic" first line of defense per the hardening brief,
  but a distributed store (e.g. Upstash Redis) would be needed for a stricter guarantee at scale.
- Unit tests cover the pure logic modules (`matching.ts`, `stickerCodes.ts`, `distance.ts`,
  `cities.ts`, Vision provider selection); there's no integration/E2E test suite yet (e.g.
  Playwright against a real Supabase test project) - the manual QA checklist above fills that gap
  for now.
- **The old-catalog-to-teams remap in `0011_shashot_teams.sql` is best-effort**, not guaranteed
  lossless: it assumes the pre-existing flat catalog was configured as `team_count * 20` consecutive
  numbers (the only shape the old admin tools could produce). A project with a differently-sized
  legacy catalog will still end up with a complete, consistent 32-team/640-sticker catalog after the
  migration, but some pre-existing collectors' duplicate/missing markings may land on a different
  team than they might expect - see [Visual collection model](#visual-collection-model-teams--sticker-codes)
  above for exactly how the mapping works.
- The new team-grid "Save" batches all 20 cells' changes into one Server Action call per team; there
  is currently no cross-team "save everything" action, nor conflict handling if the same account
  edits the same team from two open tabs simultaneously (last save wins).

## MVP scope notes (still true for the Beta)

- No payment integration - the app only connects collectors.
- No over-engineered infrastructure - everything runs on Next.js + Supabase, no extra services.
