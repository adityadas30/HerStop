-- ============================================================
-- HerStop — auth-dependent tables: profiles, saved_stops, reviews
-- PROPOSED — NOT YET APPLIED. Requires founder review + manual run
-- in the Supabase SQL Editor. No agent should execute this against
-- the live project (see .claude/rules/supabase-rules.md).
--
-- Depends on Supabase Auth (auth.users) being enabled — it is, by
-- default, on every Supabase project. OTP login itself is a
-- separate, not-yet-built feature; these tables and their RLS
-- policies work the moment a user exists in auth.users, regardless
-- of which sign-in method created it.
--
-- stops.id type verified (2026-09-08, read-only, against the live
-- project — see docs/features/auth-tables/verification.md): it is
-- `text`, matching `saved_stops.stop_id text references stops(id)`
-- below. No correction needed.
--
-- Idempotency: every `create table`/`create index` already uses
-- `if not exists`. Postgres has no `create policy if not exists`,
-- so each policy below is preceded by a matching
-- `drop policy if exists` — safe to run this whole file more than
-- once (e.g. if the founder's first run is interrupted partway).
-- ============================================================

-- ------------------------------------------------------------
-- profiles
-- One row per authenticated user. Minimal by design — see
-- .claude/rules/security-privacy-rules.md ("do not store precise
-- user travel history unless explicitly designed and justified").
-- No row is created here automatically: the app upserts a profile
-- row the first time a user signs in (simple app-level code,
-- avoids adding a trigger on the auth.users table, which would be
-- an auth-schema change needing its own approval).
-- ------------------------------------------------------------
create table if not exists profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table profiles enable row level security;

-- Profiles are private: no public read. A user only ever sees their own.
drop policy if exists "Users can read own profile" on profiles;
create policy "Users can read own profile"
  on profiles for select
  using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on profiles;
create policy "Users can insert own profile"
  on profiles for insert
  with check (auth.uid() = id);

drop policy if exists "Users can update own profile" on profiles;
create policy "Users can update own profile"
  on profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- No delete policy: `on delete cascade` from auth.users removes the
-- profile automatically if the account is deleted.

-- ------------------------------------------------------------
-- saved_stops
-- Join table for the bookmark feature. One row per (user, stop).
-- ------------------------------------------------------------
create table if not exists saved_stops (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  stop_id    text not null references stops(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, stop_id)
);

create index if not exists saved_stops_user_id_idx on saved_stops(user_id);

alter table saved_stops enable row level security;

-- No public read: a user's saved list is their own.
drop policy if exists "Users can read own saved stops" on saved_stops;
create policy "Users can read own saved stops"
  on saved_stops for select
  using (auth.uid() = user_id);

drop policy if exists "Users can save stops for themselves" on saved_stops;
create policy "Users can save stops for themselves"
  on saved_stops for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can unsave their own stops" on saved_stops;
create policy "Users can unsave their own stops"
  on saved_stops for delete
  using (auth.uid() = user_id);

-- No update policy: save/unsave is insert/delete (a toggle), not an edit.

-- ------------------------------------------------------------
-- reviews
-- Structured community reviews (see CLAUDE.md "Review model v1" /
-- docs/product-brief.md "Review Structure"). Ratings are 1-5 smallint
-- for consistency; loitering_concern and time_of_visit match the
-- product brief's named options.
--
-- Public SELECT (of non-hidden rows) is intentional: "browse without
-- account" is MVP scope, and community reviews are core to how any
-- user — signed in or not — judges a stop. This differs from the
-- "profiles/saved_stops/reviews are auth-only" shorthand in
-- docs/architecture/data-model.md, which refers to *writes*; see
-- that file's review-table note for the full rationale.
-- ------------------------------------------------------------
create table if not exists reviews (
  id                uuid primary key default gen_random_uuid(),
  stop_id           text not null references stops(id) on delete cascade,
  user_id           uuid not null references auth.users(id) on delete cascade,

  overall_feeling   smallint not null check (overall_feeling between 1 and 5),
  lighting          smallint not null check (lighting between 1 and 5),
  restroom_quality  smallint not null check (restroom_quality between 1 and 5),
  cleanliness       smallint not null check (cleanliness between 1 and 5),
  staff_kindness    smallint not null check (staff_kindness between 1 and 5),
  loitering_concern text not null check (loitering_concern in ('low', 'medium', 'high')),
  would_stop_again  boolean not null,
  time_of_visit     text not null check (time_of_visit in ('day', 'night', 'unknown')),
  note              text check (char_length(note) <= 280),

  -- Moderation takedown flag (a moderator/admin sets this via the
  -- Supabase dashboard for now — no admin UI exists yet). Hiding
  -- instead of deleting preserves an audit trail.
  is_hidden         boolean not null default false,

  created_at        timestamptz not null default now()
);

create index if not exists reviews_stop_id_idx on reviews(stop_id);
create index if not exists reviews_user_id_idx on reviews(user_id);

alter table reviews enable row level security;

-- Two SELECT policies OR together: everyone (incl. anonymous
-- browsers) sees non-hidden reviews; an author additionally sees
-- their own even while hidden, so they know it was moderated.
drop policy if exists "Anyone can read visible reviews" on reviews;
create policy "Anyone can read visible reviews"
  on reviews for select
  using (is_hidden = false);

drop policy if exists "Authors can read their own review even if hidden" on reviews;
create policy "Authors can read their own review even if hidden"
  on reviews for select
  using (auth.uid() = user_id);

drop policy if exists "Authenticated users can write their own review" on reviews;
create policy "Authenticated users can write their own review"
  on reviews for insert
  with check (auth.uid() = user_id);

drop policy if exists "Authors can edit their own review" on reviews;
create policy "Authors can edit their own review"
  on reviews for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Authors can delete their own review" on reviews;
create policy "Authors can delete their own review"
  on reviews for delete
  using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- KNOWN LIMITATION (documented, not fixed here — avoid overengineering
-- a v1 schema): the "Authors can edit their own review" policy lets an
-- author flip is_hidden back to false after a moderator hides it, since
-- Postgres RLS doesn't do column-level checks without an extra trigger.
-- Acceptable for v1 (no admin UI or reporting flow exists yet either).
-- Revisit when building real moderation/reporting — likely a trigger
-- that blocks non-moderators from changing is_hidden, or a separate
-- reports table instead of a single flag.
-- ------------------------------------------------------------
