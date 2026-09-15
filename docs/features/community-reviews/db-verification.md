# community-reviews — DB verification (Track DB)

Migration: `docs/migrations/003_reviews_privacy_and_moderation.sql` — **proposed, not applied.**
No agent has run this against the live database. Read the whole migration file top to bottom
before running it — it matches the comment style of `002_auth_tables.sql`.

This file went through one internal security review (2026-09-10, verdict **BLOCK**) before ever
being applied, and 003 was rewritten in place to address it — see §5 below and the revision-
history comment at the top of the migration file itself. Nothing in this document describes
anything that has actually run against the live project.

## 1. Pre-flight (founder, before running 003)

Run these read-only queries in the Supabase SQL Editor first, in order:

```sql
-- (a) Row count. 003 adds `unique (user_id, stop_id)` to `reviews`. An anon-key
-- REST probe (below) can only ever see non-hidden rows, so it can't rule out a
-- pre-existing duplicate `(user_id, stop_id)` pair sitting in a *hidden* row —
-- that would make the `alter table ... add constraint` fail.
select count(*) from reviews;

-- (b) Table ownership. 003's security-definer functions rely on being owned
-- by the role that runs the SQL Editor, which must bypass RLS to apply its
-- own hand-written visibility rules. Confirm that's still `postgres`.
select tableowner from pg_tables where schemaname = 'public' and tablename = 'reviews';

-- (c) Row security is not in FORCE mode. FORCE would apply RLS even to the
-- table owner, which would break every security-definer function in 003.
-- Expected: false.
select relforcerowsecurity from pg_class where relname = 'reviews';

-- (d) Exactly the four policies 002 created, nothing unexpected added since.
select policyname, cmd from pg_policies where tablename = 'reviews' order by policyname;
-- Expected 4 rows:
--   "Authenticated users can write their own review"          | INSERT
--   "Authors can delete their own review"                     | DELETE
--   "Authors can edit their own review"                       | UPDATE
--   "Authors can read their own review even if hidden"        | SELECT
```

Anon-key probe run on 2026-09-10 (read-only REST, no privileged key), for the record:

```
GET {url}/rest/v1/reviews?select=id&limit=5  (Prefer: count=exact)
→ HTTP 200, Content-Range: */0, body: []
```

0 visible rows. If the founder's `select count(*)` above also returns 0, the constraint add is
guaranteed safe. If it returns anything greater than 0, stop and check for duplicate
`(user_id, stop_id)` pairs before running 003:

```sql
select user_id, stop_id, count(*)
from reviews
group by user_id, stop_id
having count(*) > 1;
```

## 2. Apply (founder action, Supabase SQL Editor)

1. Read `docs/migrations/003_reviews_privacy_and_moderation.sql` top to bottom.
2. Run the pre-flight queries above; confirm no duplicate `(user_id, stop_id)` pairs and that (b)/(c)/(d) match.
3. Paste the whole migration file into the SQL Editor and run it. It is wrapped in its own
   `begin … commit` with a 5s `lock_timeout`, and every statement inside is idempotent — safe to
   re-run if the first attempt is interrupted partway or fails (a failed transaction rolls back
   everything, so a re-run always starts from a clean base).
4. Run the post-apply checks below.
5. Note the run in `docs/agent-os/STATUS.md` and update the migration's status in
   `docs/migrations/README.md` to "applied".
6. **Do not run `004_seed_real_stops_i65.sql` yet — it does not exist.** See §7.

## 3. Post-apply checks

From `apps/mobile/`:

```bash
npm run supabase:check
npm run rls:check
```

`rls:check` should report all 12 assertions passing. Also spot-check directly in the SQL Editor:

```sql
-- Confirms the constraint landed.
select conname from pg_constraint
where conrelid = 'public.reviews'::regclass and conname = 'reviews_user_id_stop_id_key';

-- Confirms the old public-read policy on reviews is GONE — this should return
-- exactly the 4 policies listed in §1(d) above, and NOT
-- "Anyone can read visible reviews".
select policyname from pg_policies where tablename = 'reviews' order by policyname;

-- Confirms the new tables all have RLS on.
select relname, relrowsecurity from pg_class
where relname in ('review_reports', 'hidden_reviews', 'banned_users');
```

Functional check (as the founder's own signed-in test account, via the app once mobile-builder's
side lands, or via `supabase.rpc(...)` in a scratch script using the anon key + a real session):
create a review, confirm `get_stop_reviews` returns it with `is_mine: true` and no `user_id` key
in the response payload, then confirm a second insert for the same `(user_id, stop_id)` fails
with a unique-violation (edit should go through the app's `upsert`, not a second insert). Confirm
a *second* test account does **not** see that review in `get_stop_reviews` until 24 hours have
passed (or temporarily shorten `review_publish_delay()` in a throwaway local test, never in the
migration file itself, to verify the mechanism without waiting a day).

## 4. Rollback

Run in the Supabase SQL Editor to undo 003 and return to 002's state. **Before running this,
export `review_reports` if it has any rows you want to keep** (Table Editor → export CSV) — the
table is dropped here and its data is not recoverable afterward.

Block A is always safe to run and fully reverses everything 003 added *except* the public-read
policy on `reviews`:

```sql
begin;

-- Functions and their trigger first — nothing else depends on them.
drop trigger if exists reviews_enforce_invariants_trigger on reviews;
drop function if exists reviews_enforce_invariants();
drop function if exists get_stop_reviews(text);
drop function if exists get_stop_review_stats(text[]);
drop function if exists report_review(uuid, text, text);
drop function if exists hide_review(uuid);
drop function if exists review_publish_delay();

-- New tables. `if exists` is safe here because all three are 003-only
-- additions with no other object depending on them except the functions
-- already dropped above.
drop table if exists review_reports;
drop table if exists hidden_reviews;
drop table if exists banned_users;

-- Reviews: drop the new constraint, restore 002's insert/update/delete
-- policies to their unconditional (no banned_users / is_hidden-lock) form.
alter table reviews drop constraint if exists reviews_user_id_stop_id_key;

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

commit;
```

Block B — **only run this if `reviews` still contains nothing but test data.** Once real traveler
reviews exist, recreating the old public-read policy republishes every review (including ones a
moderator hid, or ones still inside the publish delay) to every anonymous client immediately,
which is exactly the exposure 003 exists to prevent. If in doubt, leave `reviews` with no public
SELECT policy — the app can still function in a reduced way (author-only reads) until 003 (or a
narrower replacement) is reapplied:

```sql
begin;
drop policy if exists "Anyone can read visible reviews" on reviews;
create policy "Anyone can read visible reviews"
  on reviews for select
  using (is_hidden = false);
commit;
```

After rollback, re-run `npm run rls:check` from `apps/mobile/` — it should report the same
results as it did on 002 alone if Block B was also run (anon SELECT on `reviews` succeeds again);
if only Block A was run, anon SELECT on `reviews` still returns 0 rows (no author, no public
policy) and every 003 assertion FAILs with "not applied" / "table does not exist", which is
expected and not a crash.

## 5. Changes from the original 003 draft (security review, verdict BLOCK, 2026-09-10)

The first draft of 003 (never applied) used a `blocked_users` table + `block_review_author()`
letting one traveler block another outright. The review found this is an **authorship oracle**:
an attacker who blocks one author and diffs `get_stop_reviews` results across many stops (which
rows disappear) can reconstruct which stops that traveler reviewed — reconstructing travel
history from what was supposed to be private per-viewer state. Fixes applied, all now live in the
migration file:

- **Removed** `blocked_users` and `block_review_author()` entirely.
- **Added** `hidden_reviews` (per-review, not per-author, hiding) + `hide_review()`. Hiding one
  review only ever removes that one row from the caller's own view — nothing to diff.
- **Added** `banned_users` (founder-only, dashboard-inserted, no client policies, no client-facing
  function) so the app still has a way to block an abusive account from the service (App Store
  1.2) without reintroducing an oracle: it's a moderation action *about* a user, never exposed as
  something a client can query or diff.
- **Recreated** the author delete policy as `using (auth.uid() = user_id and is_hidden = false)`
  — an author could previously delete a moderated (hidden) review, cascade-deleting its reports
  and reposting the same content as new.
- `report_review`/`hide_review`: identical "review not found or not visible" wording for both the
  not-found and not-visible cases, in both functions, so a response can't be used to tell them
  apart.
- `revoke execute … from public, anon` (explicit) on both write functions; explicit
  `grant … to anon, authenticated` on both read functions.
- Trigger `reviews_enforce_invariants` (renamed from `reviews_enforce_is_hidden`) now also forces
  `created_at := now()` on insert and pins `created_at`/`stop_id`/`user_id` on update, for
  ordinary signed-in callers — without this, a client could forge a past `created_at` to skip the
  new publish delay.
- `get_stop_review_stats`: input capped with `p_stop_ids[1:200]`.
- `review_reports` gained `review_note_snapshot`, filled from the review's `note` at report time,
  so an author can't edit away the evidence after being reported.
- **New: 24-hour publish delay.** Other travelers only see a review once `created_at` is more
  than `review_publish_delay()` (one function, one literal, one place to change it) in the past;
  the author always sees their own review immediately. Applied in both `get_stop_reviews` and
  `get_stop_review_stats`.
- Whole file wrapped in `begin; set local lock_timeout = '5s'; … commit;` — still fully
  re-runnable (every DDL statement inside is still idempotent on its own terms).

No other deviations from `docs/features/community-reviews/spec.md` §1: function signatures,
column names/types, and grant lists otherwise match the spec exactly.

## 6. Open questions / risks for the security reviewer

- `banned_users` has zero client-facing surface by design (no policy, no function). If a future
  feature needs "tell a banned user they're banned" copy in-app, that has to come from somewhere
  other than a live query against this table (e.g. a generic "action not allowed" error from the
  insert/update policy failing) — flagging so it isn't mistaken for an oversight.
- `security definer` functions in this migration rely on being owned by the role that runs the
  SQL Editor (Supabase's default admin role, which bypasses row level security) to see every row
  before applying their own hand-written visibility filter — see pre-flight check (b)/(c) in §1.
  If the founder ever runs this migration as a different, lower-privileged role, confirm that
  role still bypasses RLS or these functions will silently under-return rows instead of erroring.
- The `reviews_enforce_invariants` trigger and the banned-user write policies both key off
  `auth.role() = 'authenticated'` / RLS applying only to non-owner roles respectively. Any future
  moderation tooling that writes to `reviews` using a different, more-privileged Supabase role
  would bypass both — intended (moderation code should be able to hide/unhide, ban/unban) but
  worth confirming once a real moderation path exists beyond the dashboard.
- `review_reports` has zero SELECT policy, so there is currently no way — app-side or even via the
  founder's own signed-in session — to read reports back except the Supabase dashboard's table
  editor. Intentional for v1 (no moderation UI exists yet) but worth flagging so it isn't mistaken
  for a bug later.
- The 24-hour publish delay is a judgment call (spec called it "recommended default; founder may
  veto"). If the founder wants a different number, or wants it configurable without editing SQL,
  say so before this is applied — changing it after real reviews exist is safe (it only affects
  future comparisons against `now()`), but changing the *migration file* after it's been applied
  live would violate the "never edit an applied migration" rule in `docs/migrations/README.md`
  and would need a `005` instead.

## 7. Part 2 — seed real stops (004) — NOT COMPLETED

Task instructions pointed at a scratch folder
(`/private/tmp/claude-501/-Users-adityadas-herstop/6cadce63-358f-45fa-bd3c-4b0738c13058/scratchpad/beta-stops/`)
expected to contain `beta-stops.json` and `provenance.json` (OpenStreetMap/Nominatim-derived
data for 16 real I-65 stops between West Lafayette and Indianapolis). That folder exists but is
**empty** — confirmed 2026-09-15, and a full search of `/private/tmp/claude-501` found no copy of
either file anywhere on the machine.

Per the task's own instruction ("If that scratch folder is gone, STOP Part 2 and say so in your
report — do not invent stop data"), Part 2 was not attempted:

- `docs/migrations/004_seed_real_stops_i65.sql` — **not created.**
- `docs/data/osm-i65-west-lafayette-indianapolis/` — **not created.**
- The fictional test rows (`stops` ids `'1'`–`'6'`, including "Willow Creek Plaza TEST") are
  **still live** — nothing was deleted, since 004 never ran.

**To finish this later:** re-run the OpenStreetMap + Nominatim extraction that produced
`beta-stops.json`/`provenance.json` (16 stops, ODbL-licensed, "© OpenStreetMap contributors"
attribution required), excluding `osm-way-229125508` (Lebanon Rest Area — tagged
`landuse=construction` + `toilets=no`), and hand the two files to db-engineer again with the same
instructions. No SQL, schema, or app-code work is blocked by this — Part 1 (003) stands on its
own and does not depend on 004.
