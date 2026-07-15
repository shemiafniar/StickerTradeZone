-- Shashot - "What's New" changelog tracking
--
-- Backs a dashboard "What's New" modal shown once per new release and a
-- permanent /dashboard/changelog page. Mirrors the existing
-- onboarding_completed_at pattern (0017_quantity_and_groups.sql) as closely
-- as possible: a single nullable column on profiles, updated by a small
-- server action, with the actual changelog *content* living in a
-- version-controlled source file (src/lib/changelog.ts) rather than a new
-- database-backed CMS table - entries describe code changes and should
-- ship in the same commit as the feature they describe.
--
-- Deliberately NOT a boolean "seen" flag: a version *string* is required
-- so that a future release (a new CURRENT_CHANGELOG_VERSION in code) makes
-- the modal reappear for every user automatically, without ever needing a
-- "never show updates again" concept.

alter table public.profiles add column if not exists last_seen_changelog_version text;

comment on column public.profiles.last_seen_changelog_version is
  'The changelog version (see src/lib/changelog.ts CURRENT_CHANGELOG_VERSION) this user has last dismissed the "What''s New" modal for. Null = never seen any changelog. Compared for inequality (not just null-ness) so every new release re-shows the modal once.';
