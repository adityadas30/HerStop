-- ============================================================
-- HerStop — reviews privacy hardening + UGC moderation
-- PROPOSED — NOT YET APPLIED. Requires founder review + manual run
-- in the Supabase SQL Editor. No agent should execute this against
-- the live project (see .claude/rules/supabase-rules.md).
--
-- Depends on 002_auth_tables.sql (already applied — creates `reviews`
-- with RLS). Do not edit 002; this file only adds to what it built.
--
-- Idempotency, same rule as 002: every `create table` uses
-- `if not exists`, every `create policy` is preceded by a matching
-- `drop policy if exists`, functions use `create or replace`, the
-- trigger uses `drop trigger if exists`, and the one new constraint
-- is wrapped in a `do $$ … $$` block that checks `pg_constraint`
-- first (Postgres has no `alter table add constraint if not exists`).
-- Safe to run this whole file more than once.
--
-- Pre-flight the founder should run BEFORE this file (see
-- docs/features/community-reviews/db-verification.md): a plain
-- `select count(*) from reviews;` in the SQL editor. `reviews` is
-- empty end-to-end as of 2026-09-10 (0 rows, confirmed both via an
-- anon-key REST read AND — because anon can only ever see non-hidden
-- rows — the founder should double check total row count including
-- any hidden ones before this file adds `unique (user_id, stop_id)`,
-- since a pre-existing duplicate `(user_id, stop_id)` pair, hidden or
-- not, would make that `alter table` fail).
-- ============================================================

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
-- reviews: close the "author can un-hide" gap (002's documented
-- known limitation)
--
-- 002's own comment flagged that the author-update policy lets a
-- reviewer flip is_hidden back to false after a moderator hides
-- their review, because RLS `using`/`with check` can't do
-- column-level rules on their own. A BEFORE trigger can: for an
-- ordinary signed-in user (auth.role() = 'authenticated'), force
-- is_hidden = false on insert (a brand new review is never
-- pre-hidden) and pin is_hidden to whatever it already was on
-- update (an author's edit can't change hidden status either way).
--
-- auth.role() reads the request's JWT claims. The Supabase SQL
-- Editor / dashboard runs as the `postgres` role with no JWT
-- attached, so auth.role() returns null there, not 'authenticated'
-- — the condition below is false and the trigger does nothing. That
-- is exactly what keeps the founder free to hide/un-hide a review by
-- hand in the dashboard.
-- ------------------------------------------------------------
create or replace function reviews_enforce_is_hidden()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.role() = 'authenticated' then
    if tg_op = 'INSERT' then
      new.is_hidden := false;
    elsif tg_op = 'UPDATE' then
      new.is_hidden := old.is_hidden;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists reviews_enforce_is_hidden_trigger on reviews;
create trigger reviews_enforce_is_hidden_trigger
  before insert or update on reviews
  for each row
  execute function reviews_enforce_is_hidden();

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
-- ------------------------------------------------------------
create table if not exists review_reports (
  id          uuid primary key default gen_random_uuid(),
  review_id   uuid not null references reviews(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason      text not null check (reason in ('spam', 'offensive', 'not_about_stop', 'personal_info', 'other')),
  note        text check (char_length(note) <= 280),
  created_at  timestamptz not null default now(),
  unique (review_id, reporter_id)
);

create index if not exists review_reports_review_id_idx on review_reports(review_id);

alter table review_reports enable row level security;
-- No policies — see comment above. RLS being "on" with zero policies
-- is what makes it deny-by-default for every client role.

-- ------------------------------------------------------------
-- blocked_users
-- Personal block list: "hide this traveler's reviews from me", not a
-- global moderation action (that's what review_reports + is_hidden
-- are for). A blocker may read and remove their own blocks; inserts
-- only happen through block_review_author() below, same
-- security-definer pattern as report_review().
-- ------------------------------------------------------------
create table if not exists blocked_users (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

alter table blocked_users enable row level security;

drop policy if exists "Users can read their own blocks" on blocked_users;
create policy "Users can read their own blocks"
  on blocked_users for select
  using (auth.uid() = blocker_id);

drop policy if exists "Users can remove their own blocks" on blocked_users;
create policy "Users can remove their own blocks"
  on blocked_users for delete
  using (auth.uid() = blocker_id);

-- No insert policy: inserts happen only through block_review_author().

-- ------------------------------------------------------------
-- get_stop_reviews(p_stop_id text)
-- Callable by: anon, authenticated.
--
-- This is the one place review rows reach the client from here on.
-- It is `security definer`, so — same reasoning as review_reports
-- above — it runs as its owner and bypasses RLS entirely. That means
-- it MUST reproduce the visibility rules the dropped public-read
-- policy used to provide, by hand, in its own WHERE clause:
--   - a non-hidden review is visible to everyone
--   - the caller's own review is visible even if hidden (so they
--     know it was moderated)
--   - a review from an author the caller has blocked is excluded
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
    and not exists (
      select 1 from blocked_users b
      where b.blocker_id = auth.uid() and b.blocked_id = r.user_id
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
-- One aggregate row per stop id that has at least one non-hidden
-- review; stops with none are simply absent from the result (an
-- inner GROUP BY, not a LEFT JOIN, does that for free). Hidden
-- reviews are excluded outright here — unlike get_stop_reviews this
-- is a shared aggregate across all callers, not a per-caller view,
-- so there's no "except my own hidden one" case and no per-caller
-- blocked-author filtering (blocking only changes what a traveler
-- reads, not the aggregate score every traveler sees).
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
  where r.stop_id = any(p_stop_ids)
    and r.is_hidden = false
  group by r.stop_id;
$$;

revoke execute on function get_stop_review_stats(text[]) from public;
grant execute on function get_stop_review_stats(text[]) to anon, authenticated;

-- ------------------------------------------------------------
-- report_review(p_review_id uuid, p_reason text, p_note text)
-- Callable by: authenticated only (anon has no grant below, so a
-- call from an anon session is rejected by Postgres before the
-- function body ever runs).
--
-- A caller can only report a review they can actually see: a hidden
-- review that isn't theirs raises, same rule as get_stop_reviews.
-- Deliberately NOT checked: whether the caller has blocked the
-- review's author. Blocking only filters a traveler's own reading
-- list going forward; it doesn't retroactively revoke their ability
-- to report a review they already saw before blocking. Idempotent —
-- a second report from the same user on the same review is a no-op,
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
begin
  if v_uid is null then
    raise exception 'report_review requires an authenticated user';
  end if;

  select is_hidden, user_id into v_hidden, v_author
  from reviews
  where id = p_review_id;

  if not found then
    raise exception 'review not found';
  end if;

  if v_hidden and v_author <> v_uid then
    raise exception 'review is not visible to the caller';
  end if;

  insert into review_reports (review_id, reporter_id, reason, note)
  values (p_review_id, v_uid, p_reason, p_note)
  on conflict (review_id, reporter_id) do nothing;
end;
$$;

revoke execute on function report_review(uuid, text, text) from public;
grant execute on function report_review(uuid, text, text) to authenticated;

-- ------------------------------------------------------------
-- block_review_author(p_review_id uuid)
-- Callable by: authenticated only (same anon-rejection mechanism
-- as report_review — no grant, no execute privilege).
--
-- No-op (not an error) if the review is the caller's own, or if the
-- author is already blocked — both are ordinary repeat-tap cases in
-- the UI, not failures.
-- ------------------------------------------------------------
create or replace function block_review_author(p_review_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_author uuid;
begin
  if v_uid is null then
    raise exception 'block_review_author requires an authenticated user';
  end if;

  select user_id into v_author from reviews where id = p_review_id;
  if not found then
    raise exception 'review not found';
  end if;

  if v_author = v_uid then
    return;
  end if;

  insert into blocked_users (blocker_id, blocked_id)
  values (v_uid, v_author)
  on conflict (blocker_id, blocked_id) do nothing;
end;
$$;

revoke execute on function block_review_author(uuid) from public;
grant execute on function block_review_author(uuid) to authenticated;

-- ------------------------------------------------------------
-- Rollback: see docs/features/community-reviews/db-verification.md.
-- ------------------------------------------------------------
