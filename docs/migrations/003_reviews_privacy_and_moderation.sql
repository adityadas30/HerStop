-- ============================================================
-- HerStop — reviews privacy hardening + UGC moderation
-- PROPOSED — NOT YET APPLIED. Requires founder review + manual run
-- in the Supabase SQL Editor. No agent should execute this against
-- the live project (see .claude/rules/supabase-rules.md).
--
-- Depends on 002_auth_tables.sql (already applied — creates `reviews`
-- with RLS). Do not edit 002; this file only adds to what it built.
--
-- Revision history: this file went through one internal security
-- review (2026-09-10, verdict BLOCK) before ever being applied, and
-- was rewritten in place per that review's findings — see the
-- "author-wide blocking" comment below for the headline issue and
-- docs/features/community-reviews/db-verification.md §5 for the full
-- list of changes. Since nothing here has touched the live database
-- yet, this file is edited directly rather than superseded by 004.
--
-- Idempotency, same rule as 002: every `create table` uses
-- `if not exists`, every `create policy` is preceded by a matching
-- `drop policy if exists`, functions use `create or replace`, the
-- trigger uses `drop trigger if exists`, and the one new constraint
-- is wrapped in a `do $$ … $$` block that checks `pg_constraint`
-- first (Postgres has no `alter table add constraint if not exists`).
-- Safe to run this whole file more than once.
--
-- The whole file also runs as one transaction (`begin … commit`
-- below) with a short `lock_timeout`, so a run that would otherwise
-- block for a long time behind another session's lock fails fast and
-- cleanly (nothing partially applied) instead of hanging the SQL
-- Editor.
--
-- Pre-flight the founder should run BEFORE this file (see
-- docs/features/community-reviews/db-verification.md §1) — the short
-- version: `select count(*) from reviews;` should be 0. A pre-existing
-- duplicate `(user_id, stop_id)` pair, hidden or not, would make the
-- `unique` constraint below fail.
-- ============================================================

begin;
set local lock_timeout = '5s';

-- ------------------------------------------------------------
-- reviews: one review per traveler per stop
-- ------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'reviews_user_id_stop_id_key'
      and conrelid = 'public.reviews'::regclass
  ) then
    alter table reviews add constraint reviews_user_id_stop_id_key unique (user_id, stop_id);
  end if;
end $$;

-- ------------------------------------------------------------
-- reviews: base table is no longer publicly readable
--
-- 002 let anyone (incl. anonymous browsers) select non-hidden reviews
-- directly. That's what made "browse without account" easy, but it
-- also means any client could ask for `select user_id, stop_id from
-- reviews` and build a shadow profile of who reviews what — the
-- table's own `user_id` column has no business reaching the client
-- at all. From here on, all review reads (anon and signed-in alike)
-- go through get_stop_reviews()/get_stop_review_stats() below, which
-- never select user_id. The base table becomes readable only by its
-- own author (existing 002 policy "Authors can read their own review
-- even if hidden" — untouched, still needed so an author's own app
-- code, e.g. the review form's edit/prefill path, can read back their
-- own row including user_id, which they already know is theirs).
-- ------------------------------------------------------------
drop policy if exists "Anyone can read visible reviews" on reviews;

-- ------------------------------------------------------------
-- review_publish_delay()
-- The ONE place the "how long before other travelers see a new
-- review" interval lives. Both read functions below call this
-- instead of hard-coding `interval '24 hours'` twice — to change the
-- delay, edit the literal in this one function and re-run this file.
-- `immutable` is correct (not `stable`/`volatile`): the function
-- always returns the same value for the same (no) input, regardless
-- of database state or time of day — only the *comparison* against
-- `now()` in the callers changes over time, not this function itself.
-- Publish delay rationale: gives a moment for an obviously abusive
-- review to get reported/hidden before it reaches every other
-- traveler, without hiding it from its own author. The author always
-- sees their own review immediately — see the `r.user_id = auth.uid()`
-- escape hatch in get_stop_reviews below.
-- ------------------------------------------------------------
create or replace function review_publish_delay()
returns interval
language sql
immutable
as $$
  select interval '24 hours';
$$;

-- ------------------------------------------------------------
-- banned_users
-- Founder-only moderation tool for App Store Guideline 1.2 (apps with
-- user-generated content need a way to block abusive users from the
-- service). One row per banned account. RLS is on with NO policies —
-- deny-by-default for every client role, same pattern as
-- review_reports below. The founder inserts/deletes rows directly
-- from the Supabase dashboard (running as the postgres role, which
-- bypasses RLS); no app code ever writes here. Deliberately NOT
-- exposed through any function either — unlike hide_review, a ban is
-- a moderation action taken *about* a user, not *by* one, so there is
-- no "caller-scoped" version of this that would be safe to expose.
-- ------------------------------------------------------------
create table if not exists banned_users (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  reason     text,
  created_at timestamptz not null default now()
);

alter table banned_users enable row level security;
-- No policies — see comment above.

-- ------------------------------------------------------------
-- hidden_reviews
-- "Hide this one review from me" — a per-viewer, per-review
-- preference, not a global moderation action (that's review_reports +
-- is_hidden) and NOT a per-author block list.
--
-- This replaces the `blocked_users` table from the first draft of
-- this migration. That draft let a viewer block an author outright,
-- which reads as more convenient (block once, hide everything) but
-- is an authorship oracle: an attacker who suspects two reviews on
-- different stops share an author can block one author, re-fetch
-- get_stop_reviews for every stop, and see exactly which other
-- reviews vanish — reconstructing which stops a specific traveler
-- reviewed, i.e. rebuilding some of their travel history from
-- something that was supposed to be per-viewer state invisible to
-- everyone else. Per-review hiding can't do that: hiding one review
-- only ever removes that one row from the caller's own view, so
-- there's nothing to diff. RLS is on with NO policies, same
-- deny-by-default pattern as review_reports; the only way in is
-- hide_review() below.
-- ------------------------------------------------------------
create table if not exists hidden_reviews (
  user_id    uuid not null references auth.users(id) on delete cascade,
  review_id  uuid not null references reviews(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, review_id)
);

alter table hidden_reviews enable row level security;
-- No policies — see comment above.

-- ------------------------------------------------------------
-- review_reports
-- One row per (review, reporter) — a traveler flagging a specific
-- review. RLS is on and deliberately has NO policies at all, so no
-- client role (anon or authenticated) can select/insert/update/delete
-- this table directly, even the reporter's own row. The only way in
-- is the report_review() function below, which is `security definer`
-- (runs with the privileges of its owner — the postgres role in the
-- SQL Editor — which bypasses RLS) and does its own auth.uid() check.
-- This keeps "who reported what" fully out of client reach.
--
-- `review_note_snapshot` copies the review's `note` at the moment it
-- is reported. Without this, an author who realizes their review was
-- reported could edit the note to remove the offending text before a
-- moderator ever reads it, erasing the evidence the report was about.
-- ------------------------------------------------------------
create table if not exists review_reports (
  id                  uuid primary key default gen_random_uuid(),
  review_id           uuid not null references reviews(id) on delete cascade,
  reporter_id         uuid not null references auth.users(id) on delete cascade,
  reason              text not null check (reason in ('spam', 'offensive', 'not_about_stop', 'personal_info', 'other')),
  note                text check (char_length(note) <= 280),
  review_note_snapshot text,
  created_at          timestamptz not null default now(),
  unique (review_id, reporter_id)
);

create index if not exists review_reports_review_id_idx on review_reports(review_id);

alter table review_reports enable row level security;
-- No policies — see comment above.

-- ------------------------------------------------------------
-- reviews: enforce invariants a plain RLS `with check` can't express
-- (column-level rules based on old vs. new value)
--
-- Three things this trigger locks down, all only for ordinary
-- signed-in users (auth.role() = 'authenticated' — see the note below
-- on why that matters):
--   1. is_hidden: a brand new review is never pre-hidden (insert), and
--      an author's edit can't flip is_hidden either way (update).
--      Closes 002's documented "author can un-hide" gap.
--   2. created_at: forced to now() on insert, pinned to the original
--      value on update. Without this, a malicious client could POST a
--      review with a `created_at` far enough in the past to skip the
--      24-hour publish delay in get_stop_reviews/get_stop_review_stats
--      below — the whole delay is worthless if the timestamp it's
--      compared against isn't trustworthy.
--   3. stop_id / user_id: pinned on update, so an "edit" can't secretly
--      re-point a review at a different stop or reassign its author.
--
-- auth.role() reads the request's JWT claims. The Supabase SQL
-- Editor / dashboard runs as the `postgres` role with no JWT
-- attached, so auth.role() returns null there, not 'authenticated'
-- — the condition below is false and the trigger does nothing. That
-- is exactly what keeps the founder free to hide/un-hide a review, or
-- hand-correct a bad row, from the dashboard.
-- ------------------------------------------------------------
create or replace function reviews_enforce_invariants()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.role() = 'authenticated' then
    if tg_op = 'INSERT' then
      new.is_hidden := false;
      new.created_at := now();
    elsif tg_op = 'UPDATE' then
      new.is_hidden := old.is_hidden;
      new.created_at := old.created_at;
      new.stop_id := old.stop_id;
      new.user_id := old.user_id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists reviews_enforce_is_hidden_trigger on reviews;
drop trigger if exists reviews_enforce_invariants_trigger on reviews;
create trigger reviews_enforce_invariants_trigger
  before insert or update on reviews
  for each row
  execute function reviews_enforce_invariants();

-- ------------------------------------------------------------
-- reviews: insert/update policies also refuse a banned account
--
-- A policy `with check`, not a trigger: the insert/update policies
-- already scope every write to `auth.uid() = user_id`, so adding "and
-- the caller isn't banned" is a one-line extension of a boolean
-- expression already being evaluated by RLS on every write, for every
-- role, before any row lands — no new function or trigger needed. A
-- trigger would duplicate that check at a different layer and would
-- need its own auth.role() gating (like reviews_enforce_invariants
-- above) to avoid also blocking the founder's own dashboard edits;
-- the policy approach only ever applies to actual client writes,
-- because dashboard writes run as `postgres` and RLS policies don't
-- apply to a table's owner role at all.
-- ------------------------------------------------------------
drop policy if exists "Authenticated users can write their own review" on reviews;
create policy "Authenticated users can write their own review"
  on reviews for insert
  with check (
    auth.uid() = user_id
    and not exists (select 1 from banned_users b where b.user_id = auth.uid())
  );

drop policy if exists "Authors can edit their own review" on reviews;
create policy "Authors can edit their own review"
  on reviews for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and not exists (select 1 from banned_users b where b.user_id = auth.uid())
  );

-- ------------------------------------------------------------
-- reviews: delete policy also refuses to delete a moderated review
--
-- 002's delete policy let an author delete their own review no matter
-- what. That's a moderation-undo hole: deleting a hidden review
-- cascade-deletes its review_reports (on delete cascade) — erasing
-- the evidence a moderator hid it for — and clears the way to repost
-- the same content as a brand new, not-yet-reported review. Adding
-- `and is_hidden = false` closes that: once a review is hidden, its
-- own author can no longer delete it (only the founder, from the
-- dashboard, which bypasses RLS entirely).
-- ------------------------------------------------------------
drop policy if exists "Authors can delete their own review" on reviews;
create policy "Authors can delete their own review"
  on reviews for delete
  using (auth.uid() = user_id and is_hidden = false);

-- ------------------------------------------------------------
-- get_stop_reviews(p_stop_id text)
-- Callable by: anon, authenticated.
--
-- This is the one place review rows reach the client from here on.
-- It is `security definer`, so — same reasoning as review_reports
-- above — it runs as its owner and bypasses RLS entirely. That means
-- it MUST reproduce the visibility rules the dropped public-read
-- policy used to provide, by hand, in its own WHERE clause:
--   - a non-hidden review is visible to everyone, but only once it's
--     past the publish delay (review_publish_delay() above)
--   - the caller's own review is visible immediately, even while
--     hidden or brand new, so they always see what they wrote and
--     know if it was moderated
--   - a review the caller personally hid (hidden_reviews) is excluded
--   - a review by a banned author is excluded outright, for everyone
--     including that author themselves — "disappear everywhere"
-- `user_id` is never in the SELECT list — the whole point of this
-- migration. `created_month` is `date_trunc('month', ...)`, so no
-- day-level timestamp (which could hint at travel timing) leaves
-- the database either.
-- ------------------------------------------------------------
create or replace function get_stop_reviews(p_stop_id text)
returns table (
  id                uuid,
  stop_id           text,
  overall_feeling   smallint,
  lighting          smallint,
  restroom_quality  smallint,
  cleanliness       smallint,
  staff_kindness    smallint,
  loitering_concern text,
  would_stop_again  boolean,
  time_of_visit     text,
  note              text,
  created_month     date,
  is_mine           boolean,
  is_hidden         boolean
)
language sql
security definer
stable
set search_path = public
as $$
  select
    r.id,
    r.stop_id,
    r.overall_feeling,
    r.lighting,
    r.restroom_quality,
    r.cleanliness,
    r.staff_kindness,
    r.loitering_concern,
    r.would_stop_again,
    r.time_of_visit,
    r.note,
    date_trunc('month', r.created_at)::date as created_month,
    coalesce(r.user_id = auth.uid(), false) as is_mine,
    r.is_hidden
  from reviews r
  where r.stop_id = p_stop_id
    and (r.is_hidden = false or r.user_id = auth.uid())
    and (r.user_id = auth.uid() or r.created_at < now() - review_publish_delay())
    and not exists (
      select 1 from hidden_reviews h
      where h.user_id = auth.uid() and h.review_id = r.id
    )
    and not exists (
      select 1 from banned_users bu where bu.user_id = r.user_id
    )
  order by r.created_at desc
  limit 50;
$$;

revoke execute on function get_stop_reviews(text) from public;
grant execute on function get_stop_reviews(text) to anon, authenticated;

-- ------------------------------------------------------------
-- get_stop_review_stats(p_stop_ids text[])
-- Callable by: anon, authenticated.
--
-- One aggregate row per stop id that has at least one visible review;
-- stops with none are simply absent from the result (an inner GROUP
-- BY, not a LEFT JOIN, does that for free). Hidden, not-yet-published,
-- and banned-author reviews are excluded outright here — unlike
-- get_stop_reviews this is a shared aggregate across all callers, not
-- a per-caller view, so there's no "except my own hidden/new one" case
-- and no per-caller hidden_reviews filtering (a viewer hiding a review
-- only changes what *they* read, not the aggregate score every
-- traveler sees).
--
-- `p_stop_ids[1:200]` caps how many stop ids one call can aggregate
-- over — Postgres array-slice syntax, keeps a pathological huge array
-- from turning this into an expensive scan regardless of who calls it
-- (anon has no other rate limit here).
-- ------------------------------------------------------------
create or replace function get_stop_review_stats(p_stop_ids text[])
returns table (
  stop_id                   text,
  review_count              int,
  avg_overall               numeric(3, 2),
  avg_lighting              numeric(3, 2),
  avg_restroom              numeric(3, 2),
  avg_cleanliness           numeric(3, 2),
  avg_staff                 numeric(3, 2),
  would_stop_again_count    int,
  loitering_high_count      int,
  night_count               int,
  night_low_lighting_count  int,
  last_review_month         date
)
language sql
security definer
stable
set search_path = public
as $$
  select
    r.stop_id,
    count(*)::int as review_count,
    round(avg(r.overall_feeling)::numeric, 2) as avg_overall,
    round(avg(r.lighting)::numeric, 2) as avg_lighting,
    round(avg(r.restroom_quality)::numeric, 2) as avg_restroom,
    round(avg(r.cleanliness)::numeric, 2) as avg_cleanliness,
    round(avg(r.staff_kindness)::numeric, 2) as avg_staff,
    count(*) filter (where r.would_stop_again)::int as would_stop_again_count,
    count(*) filter (where r.loitering_concern = 'high')::int as loitering_high_count,
    count(*) filter (where r.time_of_visit = 'night')::int as night_count,
    count(*) filter (where r.time_of_visit = 'night' and r.lighting <= 2)::int as night_low_lighting_count,
    max(date_trunc('month', r.created_at))::date as last_review_month
  from reviews r
  where r.stop_id = any(p_stop_ids[1:200])
    and r.is_hidden = false
    and r.created_at < now() - review_publish_delay()
    and not exists (
      select 1 from banned_users bu where bu.user_id = r.user_id
    )
  group by r.stop_id;
$$;

revoke execute on function get_stop_review_stats(text[]) from public;
grant execute on function get_stop_review_stats(text[]) to anon, authenticated;

-- ------------------------------------------------------------
-- report_review(p_review_id uuid, p_reason text, p_note text)
-- Callable by: authenticated only. `revoke … from public, anon` below
-- is belt-and-suspenders with the missing anon grant: even if a
-- future migration ever granted EXECUTE to PUBLIC by habit, this
-- explicit revoke means anon still can't call it.
--
-- A caller can only report a review they can actually see — same
-- "not found or not visible" check, and deliberately the SAME error
-- message for both cases (see the comment above hide_review for why:
-- a caller shouldn't be able to tell "that review id doesn't exist"
-- apart from "it exists but you're not allowed to see it").
-- Deliberately NOT checked: whether the caller has this review's
-- author's reviews hidden via hidden_reviews. Hiding only filters a
-- traveler's own reading list going forward; it doesn't retroactively
-- revoke their ability to report a review they already saw. Idempotent
-- — a second report from the same user on the same review is a no-op,
-- not an error (`unique (review_id, reporter_id)` + ON CONFLICT).
-- ------------------------------------------------------------
create or replace function report_review(p_review_id uuid, p_reason text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_hidden boolean;
  v_author uuid;
  v_note   text;
begin
  if v_uid is null then
    raise exception 'report_review requires an authenticated user';
  end if;

  select is_hidden, user_id, note into v_hidden, v_author, v_note
  from reviews
  where id = p_review_id;

  if not found then
    raise exception 'review not found or not visible to the caller';
  end if;

  if v_hidden and v_author <> v_uid then
    raise exception 'review not found or not visible to the caller';
  end if;

  insert into review_reports (review_id, reporter_id, reason, note, review_note_snapshot)
  values (p_review_id, v_uid, p_reason, p_note, v_note)
  on conflict (review_id, reporter_id) do nothing;
end;
$$;

revoke execute on function report_review(uuid, text, text) from public, anon;
grant execute on function report_review(uuid, text, text) to authenticated;

-- ------------------------------------------------------------
-- hide_review(p_review_id uuid)
-- Callable by: authenticated only (same anon-rejection mechanism as
-- report_review — explicit revoke from public and anon, grant only to
-- authenticated).
--
-- "Not found" and "not visible" share one error message with
-- report_review's wording, for the same reason: don't let a response
-- distinguish "this id doesn't exist" from "it exists but you can't
-- see it". No-op (not an error) if the review is the caller's own —
-- hiding your own review from yourself makes no sense, and this is
-- also what keeps hidden_reviews from ever containing an
-- author-hid-their-own-review row (see the get_stop_reviews comment
-- on why that invariant matters). Idempotent via
-- `on conflict … do nothing`, same as report_review.
-- ------------------------------------------------------------
create or replace function hide_review(p_review_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_hidden boolean;
  v_author uuid;
begin
  if v_uid is null then
    raise exception 'hide_review requires an authenticated user';
  end if;

  select is_hidden, user_id into v_hidden, v_author
  from reviews
  where id = p_review_id;

  if not found then
    raise exception 'review not found or not visible to the caller';
  end if;

  if v_hidden and v_author <> v_uid then
    raise exception 'review not found or not visible to the caller';
  end if;

  if v_author = v_uid then
    return;
  end if;

  insert into hidden_reviews (user_id, review_id)
  values (v_uid, p_review_id)
  on conflict (user_id, review_id) do nothing;
end;
$$;

revoke execute on function hide_review(uuid) from public, anon;
grant execute on function hide_review(uuid) to authenticated;

-- ------------------------------------------------------------
-- Rollback: see docs/features/community-reviews/db-verification.md.
-- ------------------------------------------------------------

commit;
