# Sticker Trade IL 🔁⚽

**אזור החלפת מדבקות לאספני כדורגל בישראל** - a fast, mobile-first, RTL Hebrew web app that helps
football sticker collectors in Israel track duplicates/missing stickers and find nearby people to
trade or sell with.

> **Not affiliated with Panini, FIFA, or any official sticker brand.** This is an independent,
> community-built collector trade zone. See the footer disclaimer shown on every page.

This README covers the public **Beta** release. The original MVP is preserved in git history / PR
#1; everything below is additive on top of it.

## Tech stack

- [Next.js 16](https://nextjs.org/) (App Router, Server Components, Server Actions) + TypeScript
- [Tailwind CSS v4](https://tailwindcss.com/)
- [Supabase](https://supabase.com/) (Postgres, Auth, Row Level Security, Realtime)
- Hebrew RTL UI (`Heebo` font), mobile-first design
- Pluggable Vision/OCR provider for the AI Sticker Scanner (mock by default, OpenAI Vision ready to
  enable)

## Features

### Core (MVP)

- Email/password auth (Supabase Auth) with an auto-created public profile
- Profile: full name, city, optional neighborhood, phone/WhatsApp (only revealed after a trade is
  accepted - enforced at the database level via RLS, not just in the UI)
- Sticker collection management with a fast bulk-input mode supporting comma lists and ranges
  (`1-20, 34, 56-60`)
- Trade requests: pending → accepted/declined → completed/cancelled; contact details (incl. a
  WhatsApp deep link) are revealed only once a trade is accepted
- Admin dashboard: platform stats, searchable/filterable user table with suspend/reactivate,
  sticker catalog management, and an `admin_logs` audit trail

### New in Beta

- **Location-based matching** - opt-in approximate location (browser geolocation, rounded to
  ~100m before it ever leaves the device) powers real distance sorting ("500 מ׳" / "2.3 ק״מ"),
  with city/region matching kept as an automatic fallback for anyone who hasn't enabled it. Exact
  coordinates are never exposed to other users - see [Location privacy](#location-privacy) below.
- **Trade chat** - each trade request has a private, realtime 1:1 conversation (`trade_messages`),
  visible only to its two participants, with unread badges and auto-scroll.
- **Notifications** - a bell with a live unread badge, dropdown, and full history page. Notifications
  fire for new trade requests, accepted/declined trades, and new chat messages.
- **Richer marketplace** - each duplicate can be listed as *trade only*, *sale only*, or *trade or
  sale*, with an optional price and note. Still no payment processing - the app only connects
  collectors.
- **Viral sharing** - native share sheet (where supported), a WhatsApp share link, and a "copy
  link" button, using the product's suggested Hebrew invite text.
- **AI Sticker Scanner** - photograph a pile of loose duplicates or an open album page and let
  Vision/OCR pre-fill your lists. Ships with a fully working mock provider (no external
  dependency) and an optional OpenAI Vision provider you can enable with one env var.

## Project structure

```
src/
  app/                     Next.js App Router pages (landing, auth, dashboard, admin)
  components/
    ui/                    Shared primitives (Button, Card, Field, Skeleton, ...)
    auth/ stickers/ matches/ trades/ admin/ profile/  Feature UI
    location/              Location opt-in/opt-out toggle
    notifications/         Notification bell + history list
    scanner/                AI Scanner upload/review UI
    share/                  Share button + share card
  lib/
    actions/               Server Actions (auth, profile, stickers, trades, chat,
                            notifications, location, scanner, admin)
    data/                  Server-side data fetchers (Supabase queries)
    supabase/              Supabase client/server/proxy (session) helpers
    vision/                Vision/OCR provider abstraction (mock + OpenAI) for the AI Scanner
    matching.ts            Pure, side-effect-free match-ranking algorithm
    cities.ts              Israeli city → region map (fallback for location-less users)
    distance.ts            Haversine display formatting + coordinate rounding
    stickerInput.ts        Bulk sticker number parser ("1-20, 34, 56-60")
  types/database.ts        Hand-written Supabase Database types
  proxy.ts                 Next.js 16 "proxy" (formerly middleware) - session refresh + route guards
supabase/
  migrations/0001_schema.sql         Core tables, indexes, triggers, helper functions
  migrations/0002_rls_policies.sql   Core Row Level Security policies
  migrations/0003_location.sql       profile_locations table + haversine/nearby_distances RPCs
  migrations/0004_trade_chat.sql     trade_messages table, RLS, Realtime
  migrations/0005_notifications.sql  notifications table, RLS, trigger-based notification creation
  migrations/0006_marketplace.sql    listing_type/price/note on user_duplicates
  seed.sql                           Local-dev-only seed data (catalog + demo users + trades + chat)
```

### Why a `profiles` / `profile_contacts` split?

Postgres RLS is row-level, not column-level. To guarantee phone numbers are *only* ever readable by
the owner, an admin, or a confirmed trade partner - even if the app code has a bug - contact details
live in their own `profile_contacts` table with a strict RLS policy, completely separate from the
publicly-browsable `profiles` table (name/city/neighborhood) used for matching and the marketplace.

### Location privacy

The same pattern protects location data, one level stricter: coordinates live in
`profile_locations`, readable **only by their owner (or an admin)** - not even a confirmed trade
partner can select another user's raw latitude/longitude. The only way anyone learns anything about
another collector's location is the `nearby_distances()` SQL function, which is `SECURITY DEFINER`
and returns just a rounded distance in km for the *caller* relative to everyone else - never
coordinates. On top of that:

- The browser rounds coordinates to 3 decimal places (~100m) *before* sending them to the server
  (`roundCoordinate()` in `src/lib/distance.ts`), and the server rounds again defensively.
- Location is strictly opt-in (`LocationToggle` requests browser permission explicitly) and can be
  disabled at any time, which deletes the stored row entirely (`disable_my_location()`), not just
  hides it.
- Users without a stored location automatically fall back to city/region-based ranking - nothing
  breaks or requires location to be useful.

### Adding real push/email notifications later

`notifications` rows carry a `dispatched_channels text[]` column (defaults to `{inapp}`). A future
background worker can add push/email delivery by polling for rows missing `'push'`/`'email'` in
that array, sending them, and appending the channel name - no schema changes needed. All
notification-creation logic already lives in one place (`create_notification()` in
`0005_notifications.sql`), called from triggers on `trade_requests` and `trade_messages`.

### Adding real GPS/location distance later (already done, but for reference)

City-based "nearby" matching originally lived entirely behind `getLocationRank()` in
`src/lib/cities.ts`. That seam is exactly where real distance was plugged in: `computeMatches()` in
`src/lib/matching.ts` now prefers a precomputed `distanceKm` (from `nearby_distances()`) per
candidate and only falls back to `getLocationRank()` when no shared location exists - so a future
change to how distance is computed (e.g. a fancier geo index) only touches `nearby_distances()` and
`src/lib/data/matches.ts`, never the UI.

### Swapping the AI Scanner's Vision provider

`src/lib/vision/types.ts` defines a single `VisionProvider` interface (`scanDuplicates`,
`scanAlbumPage`). `getVisionProvider()` in `src/lib/vision/index.ts` returns `OpenAiVisionProvider`
when `OPENAI_API_KEY` is set, otherwise `MockVisionProvider`. To add another backend (Google Cloud
Vision, a custom model, etc.), implement the interface and add a branch in `getVisionProvider()` -
nothing in `src/lib/actions/scanner.ts` or the UI needs to change.

## Getting started

### 1. Create a Supabase project

Create a free project at [supabase.com](https://supabase.com), or run Supabase locally with the
[Supabase CLI](https://supabase.com/docs/guides/local-development) (`supabase start`).

### 2. Run the database migrations, in order

In the Supabase SQL Editor (or via `supabase db push` / `psql` locally):

1. `supabase/migrations/0001_schema.sql`
2. `supabase/migrations/0002_rls_policies.sql`
3. `supabase/migrations/0003_location.sql`
4. `supabase/migrations/0004_trade_chat.sql`
5. `supabase/migrations/0005_notifications.sql`
6. `supabase/migrations/0006_marketplace.sql`

All 6 files were validated end-to-end against a real Postgres instance (schema + RLS + triggers +
seed) during development - see the PR description for details.

> If you already ran migrations 0001/0002 for the MVP, you only need to additionally run
> 0003-0006 - they're pure additions/alterations and safe to apply on top.

### 3. Enable Realtime (hosted Supabase projects)

Migrations 0004 and 0005 already add `trade_messages` and `notifications` to the
`supabase_realtime` publication automatically when it exists (i.e. on a real Supabase project) - no
manual step needed. If you're running a bare/self-hosted Postgres without that publication, chat
and the notification bell still work via normal queries + Server Actions; they just won't update
live without a page refresh.

### 4. (Optional) Seed demo data for local testing

`supabase/seed.sql` is **for local development only** - it inserts directly into `auth.users` /
`auth.identities`, which only works against a local Supabase stack (`supabase start` /
`supabase db reset`, which runs `supabase/seed.sql` automatically). **Never run it against a
hosted/production Supabase project.**

It creates 10 demo accounts (password `Password123!` for all of them), a 60-sticker demo catalog,
sample duplicates/missing (including a couple of priced marketplace listings) so matches show up
immediately, approximate demo locations for 5 of the accounts, a couple of sample trade requests
(one pending, one already accepted with sample chat history), and the notifications those events
generate:

| Email | Role | City | Location set? |
| --- | --- | --- | --- |
| admin@stickertrade.local | admin | תל אביב יפו | – |
| dana@stickertrade.local | user | תל אביב יפו | ✅ |
| yossi@stickertrade.local | user | תל אביב יפו | ✅ |
| noa@stickertrade.local | user | רמת גן | ✅ |
| amit@stickertrade.local | user | חיפה | ✅ |
| tamar@stickertrade.local | user | חיפה | ✅ |
| eli@stickertrade.local | user | ירושלים | – |
| maya@stickertrade.local | user | באר שבע | – |
| roi@stickertrade.local | user | אשדוד | – |
| gali@stickertrade.local | user | פתח תקווה | – |

On a **hosted** Supabase project, instead: sign up normally through the app UI, then promote a user
to admin with:

```sql
update public.profiles set role = 'admin' where id = '<the user''s auth.users id>';
```

### 5. Configure environment variables

```bash
cp .env.example .env.local
```

Required:

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` - from your Supabase project's
  **Settings → API** page.

Optional:

- `NEXT_PUBLIC_SITE_URL` - your deployed domain, used for share links. Defaults to
  `http://localhost:3000` in dev.
- `OPENAI_API_KEY` / `OPENAI_VISION_MODEL` - enables real AI detection in the Sticker Scanner. Leave
  unset to use the built-in mock provider (fully functional, no external calls).

### 6. Install dependencies & run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 7. Set an initial sticker catalog (as an admin)

Log in as an admin and go to **אזור ניהול → קטלוג מדבקות** to set the total number of stickers in
the set (this auto-generates numbered catalog rows `1..N`) and/or paste in a custom list
(`number,name,team` per line - name/team are optional, matching the MVP requirement to support
generic numbered stickers without full player/team data).

## Deploying to Vercel + Supabase

1. **Supabase**: create a project, run all 6 migrations from `supabase/migrations/` in order (SQL
   Editor or `supabase db push`). Do **not** run `seed.sql` against it.
2. **Vercel**: import this repo, framework preset "Next.js" (auto-detected). Add the environment
   variables from `.env.example` in Project Settings → Environment Variables:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (from Supabase → Settings → API)
   - `NEXT_PUBLIC_SITE_URL` set to your production URL (e.g. `https://your-app.vercel.app`)
   - `OPENAI_API_KEY` (optional, enables real AI Scanner detection)
3. In Supabase → **Authentication → URL Configuration**, set the Site URL and add your Vercel URL
   to the redirect allow-list so email confirmation links work.
4. Deploy. No build-time secrets or server infra beyond Supabase + Vercel are required - there's no
   custom server, cron job, or queue in this Beta.
5. Promote your own account to admin (see the SQL snippet above) once you've signed up.

### Production checklist (verified during this Beta pass)

- ✅ `npm run build` (TypeScript strict) and `npm run lint` both pass clean.
- ✅ Auth flow (register/login/logout) exercised via the dev server; protected `/dashboard` and
  `/admin` routes correctly 307-redirect unauthenticated requests via `src/proxy.ts`.
- ✅ RLS re-validated end-to-end on a real local Postgres for every table added in this Beta
  (`profile_locations`, `trade_messages`, `notifications`, plus the marketplace columns), covering:
  location privacy (no other user can read raw coordinates), chat isolation (only the two trade
  participants can read/send), and notification ownership (only the recipient can read/mark-read
  their own rows).
- ✅ Admin-only RPCs (`generate_sticker_range`) and the role/status anti-escalation trigger were
  re-checked against the updated schema.

## Available scripts

```bash
npm run dev     # start the dev server
npm run build   # production build (also runs the TypeScript check)
npm run start   # run the production build
npm run lint    # ESLint
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
  may accept/decline; only a participant may complete or cancel), so the UI's button visibility is
  a UX nicety, not the source of truth.
- Admin actions (suspend/reactivate users, catalog changes) are written to `admin_logs` for a basic
  audit trail.

## Known limitations / TODOs for future releases

- **Notifications for new nearby matches** were intentionally left out of this Beta (the spec
  marked this optional "if efficient"); computing it reactively for every profile/sticker change
  would need a batched/debounced job rather than a per-row trigger. A natural next step is a
  scheduled Edge Function that periodically diffs each user's top matches and notifies on new
  high-score ones.
- **Push/email notification delivery** is not implemented, only the extensible schema seam
  (`dispatched_channels`) described above.
- The AI Scanner's OpenAI provider is implemented but unverified against a live key in this
  environment (no key was available during development) - the mock provider was exercised instead.
  Double-check prompt/response parsing against real photos before relying on it in production, and
  consider adding image pre-processing (crop/rotate) for better accuracy.
- Distance-based match sorting currently fetches all candidates in application code (fine at
  current/expected Beta scale); if the user base grows significantly, move the ranking into a
  single SQL function/materialized view.
- No automated test suite yet (unit tests for `matching.ts`, `stickerInput.ts`, `distance.ts` would
  be a high-value, low-effort addition).
- No rate limiting on Server Actions (e.g. chat message spam, scan requests) - fine for a small
  Beta cohort, worth adding before a large public launch.

## MVP scope notes (still true for the Beta)

- No payment integration - the app only connects collectors.
- No over-engineered infrastructure - everything runs on Next.js + Supabase, no extra services.
