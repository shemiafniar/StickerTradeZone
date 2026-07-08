# Sticker Trade IL 🔁⚽

**אזור החלפת מדבקות לאספני כדורגל בישראל** - a fast, mobile-first, RTL Hebrew web app that helps
football sticker collectors in Israel track duplicates/missing stickers and find nearby people to
trade or sell with.

> **Not affiliated with Panini, FIFA, or any official sticker brand.** This is an independent,
> community-built collector trade zone. See the footer disclaimer shown on every page.

## Tech stack

- [Next.js 16](https://nextjs.org/) (App Router, Server Components, Server Actions) + TypeScript
- [Tailwind CSS v4](https://tailwindcss.com/)
- [Supabase](https://supabase.com/) (Postgres, Auth, Row Level Security)
- Hebrew RTL UI (`Heebo` font), mobile-first design

## Features (MVP)

- Email/password auth (Supabase Auth) with an auto-created public profile
- Profile: full name, city, optional neighborhood, phone/WhatsApp (only revealed after a trade is
  accepted - enforced at the database level via RLS, not just in the UI)
- Sticker collection management: mark stickers as duplicates (with an optional "for sale" flag) or
  missing, with a fast bulk-input mode supporting comma lists and ranges (`1-20, 34, 56-60`)
- Match system: ranks other collectors by location (same city → same region → elsewhere - see
  `src/lib/cities.ts`) and by how many stickers you could give/receive
- Trade requests: pending → accepted/declined → completed/cancelled, with suggested give/receive
  sticker lists; contact details (incl. a WhatsApp deep link) are revealed only once a trade is
  accepted
- Marketplace-lite: duplicates can be flagged "for sale" (still no in-app payments - MVP scope)
- Admin dashboard: platform stats, searchable/filterable user table with suspend/reactivate,
  sticker catalog management (set total sticker count, bulk import a numbered list), and an
  `admin_logs` audit trail

## Project structure

```
src/
  app/                     Next.js App Router pages (landing, auth, dashboard, admin)
  components/              UI components (shared ui/, auth/, stickers/, matches/, trades/, admin/)
  lib/
    actions/               Server Actions (auth, profile, stickers, trades, admin)
    data/                  Server-side data fetchers (Supabase queries)
    supabase/              Supabase client/server/proxy (session) helpers
    matching.ts            Pure, side-effect-free match-ranking algorithm
    cities.ts              Israeli city → region map (the seam for future GPS/distance matching)
    stickerInput.ts         Bulk sticker number parser ("1-20, 34, 56-60")
  types/database.ts        Hand-written Supabase Database types
  proxy.ts                 Next.js 16 "proxy" (formerly middleware) - session refresh + route guards
supabase/
  migrations/0001_schema.sql        Tables, indexes, triggers, helper functions
  migrations/0002_rls_policies.sql  Row Level Security policies
  seed.sql                          Local-dev-only seed data (catalog + demo users + trades)
```

### Why a `profiles` / `profile_contacts` split?

Postgres RLS is row-level, not column-level. To guarantee phone numbers are *only* ever readable by
the owner, an admin, or a confirmed trade partner - even if the app code has a bug - contact details
live in their own `profile_contacts` table with a strict RLS policy, completely separate from the
publicly-browsable `profiles` table (name/city/neighborhood) used for matching and the marketplace.

### Adding real GPS/location distance later

City-based "nearby" matching lives entirely behind `getLocationRank(cityA, cityB)` in
`src/lib/cities.ts` and is consumed only by `computeMatches()` in `src/lib/matching.ts`. To upgrade
to real GPS distance, add `latitude`/`longitude` to `profiles`, replace the body of
`getLocationRank` (or add a new ranking function with the same "lower is closer" numeric contract),
and nothing else in the matching/UI code needs to change.

## Getting started

### 1. Create a Supabase project

Create a free project at [supabase.com](https://supabase.com), or run Supabase locally with the
[Supabase CLI](https://supabase.com/docs/guides/local-development) (`supabase start`).

### 2. Run the database migrations

In the Supabase SQL Editor (or via `supabase db push` / `psql` locally), run, in order:

1. `supabase/migrations/0001_schema.sql`
2. `supabase/migrations/0002_rls_policies.sql`

### 3. (Optional) Seed demo data for local testing

`supabase/seed.sql` is **for local development only** - it inserts directly into `auth.users` /
`auth.identities`, which only works against a local Supabase stack (`supabase start` /
`supabase db reset`, which runs `supabase/seed.sql` automatically). **Never run it against a
hosted/production Supabase project.**

It creates 10 demo accounts (password `Password123!` for all of them), a 60-sticker demo catalog,
sample duplicates/missing so matches show up immediately, and a couple of sample trade requests
(one pending, one already accepted so you can see the contact-reveal flow):

| Email | Role | City |
| --- | --- | --- |
| admin@stickertrade.local | admin | תל אביב יפו |
| dana@stickertrade.local | user | תל אביב יפו |
| yossi@stickertrade.local | user | תל אביב יפו |
| noa@stickertrade.local | user | רמת גן |
| amit@stickertrade.local | user | חיפה |
| tamar@stickertrade.local | user | חיפה |
| eli@stickertrade.local | user | ירושלים |
| maya@stickertrade.local | user | באר שבע |
| roi@stickertrade.local | user | אשדוד |
| gali@stickertrade.local | user | פתח תקווה |

On a **hosted** Supabase project, instead: sign up normally through the app UI, then promote a user
to admin with:

```sql
update public.profiles set role = 'admin' where id = '<the user''s auth.users id>';
```

### 4. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from your Supabase project's
**Settings → API** page.

### 5. Install dependencies & run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 6. Set an initial sticker catalog (as an admin)

Log in as an admin and go to **אזור ניהול → קטלוג מדבקות** to set the total number of stickers in
the set (this auto-generates numbered catalog rows `1..N`) and/or paste in a custom list
(`number,name,team` per line - name/team are optional, matching the MVP requirement to support
generic numbered stickers without full player/team data).

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
- A Postgres trigger blocks non-admin users from changing their own `role` or `status` columns,
  even if they craft a raw API request.
- A second trigger validates trade-request status transitions server-side (e.g. only the recipient
  may accept/decline; only a participant may complete or cancel), so the UI's button visibility is
  a UX nicety, not the source of truth.
- Admin actions (suspend/reactivate users, catalog changes) are written to `admin_logs` for a basic
  audit trail.

## MVP scope notes

Per the product brief, the following are intentionally **out of scope for this MVP** and were
designed to be added later without a rewrite:

- No in-app chat (trade requests reveal a WhatsApp deep link instead)
- No payments (marketplace mode is "mark for sale" + contact only)
- No real GPS/live location (see "Adding real GPS/location distance later" above)
