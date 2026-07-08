# Sticker Trade IL 🔁⚽

**אזור החלפת מדבקות לאספני כדורגל בישראל** - a fast, mobile-first, RTL Hebrew web app that helps
football sticker collectors in Israel track duplicates/missing stickers and find nearby people to
trade or sell with.

> **Not affiliated with Panini, FIFA, or any official sticker brand.** This is an independent,
> community-built collector trade zone. See the footer disclaimer shown on every page.

This README covers the public **Beta** release. The original MVP is preserved in git history / PR
#1, the initial Beta feature set in PR #2, a QA/security/production-hardening pass in PR #3, and this
revision (PR #4) closes the remaining gaps in the **production bootstrap** so a fresh Supabase
project + Vercel deployment works end-to-end with zero manual SQL or database edits after deploying
- see [Zero-touch production bootstrap](#zero-touch-production-bootstrap) below.

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
    auth/callback/route.ts  PKCE code-exchange endpoint (email confirmation, OAuth, magic links)
    auth/confirm/route.ts   token_hash fallback endpoint (older-style email templates)
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
  migrations/0007_hardening.sql      Suspended-user write enforcement, scan_events rate-limit table
  migrations/0008_bootstrap.sql      First-signup-becomes-admin, zero-touch production bootstrap
  seed.sql                           Local-dev-only seed data (catalog + demo users + trades + chat)
```

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
each failure case.

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
7. `supabase/migrations/0007_hardening.sql`
8. `supabase/migrations/0008_bootstrap.sql`

All 8 files were validated end-to-end (schema + RLS + triggers + seed) against a real Postgres
instance from a completely empty database, both individually and as a full clean run - see the PR
description for details. **This is the only SQL you should ever need to run** - no follow-up manual
inserts/updates are required, including for your first admin account (see step 4).

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

### 7. Install dependencies & run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Register the first account - it will
automatically be an admin.

### 8. Set an initial sticker catalog (as an admin)

Log in as an admin and go to **אזור ניהול → קטלוג מדבקות** to set the total number of stickers in
the set (this auto-generates numbered catalog rows `1..N`) and/or paste in a custom list
(`number,name,team` per line - name/team are optional, matching the MVP requirement to support
generic numbered stickers without full player/team data).

## Deploying to Vercel + Supabase

1. **Supabase**: create a project, run all 8 migrations from `supabase/migrations/` in order (SQL
   Editor or `supabase db push`). Do **not** run `seed.sql` against it (it has a built-in guard that
   refuses to run if it detects any non-demo account already exists, but the safest rule is simply:
   don't run it against a hosted project at all).
2. **Supabase Auth URLs**: in **Authentication → URL Configuration**, set the Site URL to your
   Vercel URL and add it to the Redirect URLs allow-list (see "Configure Auth URLs" in
   [Getting started](#getting-started) above). Required for email confirmation to work.
3. **Vercel**: import this repo, framework preset "Next.js" (auto-detected). Add the environment
   variables from `.env.example` in Project Settings → Environment Variables:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (from Supabase → Settings → API)
   - `NEXT_PUBLIC_SITE_URL` set to your production URL (e.g. `https://your-app.vercel.app`) - not
     strictly required (see "Recommended" above) but avoids any ambiguity across preview deployments
   - `OPENAI_API_KEY` (optional, enables real AI Scanner detection)
4. Deploy. No build-time secrets or server infra beyond Supabase + Vercel are required - there's no
   custom server, cron job, or queue in this Beta.
5. Sign up through the live app. **You're automatically an admin** - nothing else to configure. Go to
   **אזור ניהול → קטלוג מדבקות** to set your sticker catalog size.

That's the entire deployment - no SQL editor visits after step 1, no manual profile/role edits, ever.

### Production checklist (verified during the production-bootstrap pass)

- ✅ `npm run build` (TypeScript strict), `npm run lint`, and `npm test` all pass clean.
- ✅ All 8 migrations + `seed.sql` re-applied from a completely empty Postgres database (multiple
  times, including a full clean-room run for this pass) with zero errors.
- ✅ Simulated the exact "profile row missing for an authenticated user" edge case against a real
  Postgres and confirmed the app's self-heal path (the same upsert `getCurrentProfile()` performs)
  succeeds under RLS exactly as it would in the running app - this is what prevents the
  login-succeeds-but-dashboard-never-loads failure mode.
- ✅ Simulated the first-signup-becomes-admin bootstrap end-to-end: first `auth.users` insert on a
  fresh database → `profiles.role = 'admin'`; second insert → `profiles.role = 'user'`.
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
npm test        # Vitest unit tests (matching, sticker input parsing, distance, vision provider)
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
- Admin actions (suspend/reactivate users, catalog changes) are written to `admin_logs` for a basic
  audit trail. An admin cannot suspend their own account (checked in the Server Action).
- Rate limiting on trade requests, chat messages, auth attempts, and AI Scanner uploads - see "Rate
  limiting & abuse prevention" above.
- File uploads to the AI Scanner are validated (type allow-list + 8MB size cap) both client- and
  server-side before ever reaching the Vision provider.
- Profile/contact self-healing (see "Zero-touch production bootstrap" above) only ever creates a row
  for the currently-authenticated user's own `auth.uid()` - it cannot be used to create or overwrite
  another user's data, and never overwrites an existing row (`ON CONFLICT DO NOTHING`).

## Manual QA checklist (pre-launch)

Automated coverage (RLS/trigger tests against a real Postgres, `npm test`, `npm run build`/`lint`)
is described above. Before a public launch, also walk through this list by hand against a real
Supabase project + deployed frontend, since some of it (browser permissions, realtime delivery,
third-party share sheets) can't be fully exercised in CI:

**Core user journey**

- [ ] On a brand new Supabase project (only the 8 migrations run, no seed, no manual SQL), register
      the very first account and confirm it lands in the admin panel (`role = 'admin'`) automatically
- [ ] If "Confirm email" is enabled in your Supabase project: register a second account, click the
      confirmation link in the email, and confirm it redirects straight into the dashboard already
      logged in (not back to the login page)
- [ ] Add duplicates manually via the bulk input (single numbers, a range, and a mix)
- [ ] Add missing stickers manually the same way
- [ ] Run the AI Scanner in both modes (duplicate photo, album page photo) using the mock provider;
      correct a detected number, remove a row, add one manually, then save
- [ ] Enable location from the profile page (grant the browser permission prompt) and confirm the
      matches page switches to distance-based sorting; disable it again and confirm it falls back to
      city-based sorting
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

- [ ] Fresh Supabase project: run all 8 migrations in order, confirm no errors, do **not** run
      `seed.sql`, and confirm you never need to open the SQL editor again for basic usage (including
      getting your first admin)
- [ ] Confirm the Auth URL Configuration (Site URL + Redirect URLs) is set for your deployed domain
- [ ] Confirm `OPENAI_API_KEY` is unset in your deployment and the AI Scanner still works end-to-end
      via the mock provider (look for the "מצב הדגמה" label in the scan result)
- [ ] Confirm share buttons work on both a mobile browser (native share sheet or WhatsApp) and
      desktop (WhatsApp link + copy-to-clipboard)
- [ ] Load the site on a real phone and check the header, forms, chat, and scanner upload flow for
      layout issues in RTL

## Known limitations / TODOs for future releases

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
- Unit tests cover the pure logic modules (`matching.ts`, `stickerInput.ts`, `distance.ts`,
  `cities.ts`, Vision provider selection); there's no integration/E2E test suite yet (e.g.
  Playwright against a real Supabase test project) - the manual QA checklist above fills that gap
  for now.

## MVP scope notes (still true for the Beta)

- No payment integration - the app only connects collectors.
- No over-engineered infrastructure - everything runs on Next.js + Supabase, no extra services.
