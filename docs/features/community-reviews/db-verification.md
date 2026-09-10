# community-reviews — DB verification (Track DB)

Migration: `docs/migrations/003_reviews_privacy_and_moderation.sql` — **proposed, not applied.**
No agent has run this against the live database. Read the whole migration file top to bottom
before running it — it matches the comment style of `002_auth_tables.sql`.

## 1. Pre-flight (founder, before running 003)

Run this read-only query in the Supabase SQL Editor first:

```sql
select count(*) from reviews;
```

**Why:** 003 adds `unique (user_id, stop_id)` to `reviews`. An anon-key REST probe (below) can only
ever see non-hidden rows, so it can't rule out a pre-existing duplicate `(user_id, stop_id)` pair
sitting in a *hidden* row — that would make the `alter table ... add constraint` fail.

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
2. Run the pre-flight query above; confirm no duplicate `(user_id, stop_id)` pairs.
3. Paste the whole migration file into the SQL Editor and run it. It is idempotent — safe to
   re-run if the first attempt is interrupted partway.
4. Run the post-apply checks below.
5. Note the run in `docs/agent-os/STATUS.md` and update the migration's status in
   `docs/migrations/README.md` to "applied".

## 3. Post-apply checks

From `apps/mobile/`:

```bash
npm run supabase:check
npm run rls:check
```

`rls:check` should report all assertions passing (see the "after 003" expectations in
`apps/mobile/scripts/rls-check.mjs`'s header comment). Also spot-check directly in the SQL
Editor:

```sql
-- Confirms the constraint landed and there's exactly one row per (user_id, stop_id).
select conname from pg_constraint
where conrelid = 'public.reviews'::regclass and conname = 'reviews_user_id_stop_id_key';

-- Confirms the old public-read policy on reviews is gone.
select policyname from pg_policies where tablename = 'reviews';

-- Confirms both new tables have RLS on.
select relname, relrowsecurity from pg_class
where relname in ('review_reports', 'blocked_users');
```

Functional check (as the founder's own signed-in test account, via the app once mobile-builder's
side lands, or via `supabase.rpc(...)` in a scratch script using the anon key + a real session):
create a review, confirm `get_stop_reviews` returns it with `is_mine: true` and no `user_id` key
in the response payload, then confirm a second insert for the same `(user_id, stop_id)` fails
with a unique-violation (edit should go through the app's `upsert`, not a second insert).

## 4. Rollback

Run this in the Supabase SQL Editor to fully undo 003 and return to 002's state. This drops the
two new tables and their data (there is none yet, since `reviews` itself is currently empty) and
restores the public-read policy 003 removed. It does **not** touch `reviews`' existing rows,
`stops`, `profiles`, `saved_stops`, or anything in `auth.*`.

```sql
-- Functions (and their trigger) first — nothing else depends on them.
drop trigger if exists reviews_enforce_is_hidden_trigger on reviews;
drop function if exists reviews_enforce_is_hidden();
drop function if exists get_stop_reviews(text);
drop function if exists get_stop_review_stats(text[]);
drop function if exists report_review(uuid, text, text);
drop function if exists block_review_author(uuid);

-- New tables. `if exists` is safe here because both tables are 003-only
-- additions with no other object depending on them except the functions
-- already dropped above.
drop table if exists review_reports;
drop table if exists blocked_users;

-- Reviews: drop the new constraint, restore the 002 public-read policy.
alter table reviews drop constraint if exists reviews_user_id_stop_id_key;

drop policy if exists "Anyone can read visible reviews" on reviews;
create policy "Anyone can read visible reviews"
  on reviews for select
  using (is_hidden = false);
```

After rollback, re-run `npm run rls:check` from `apps/mobile/` — it should report the same
results as it did on 002 alone (anon SELECT on `reviews` succeeds again; `review_reports` /
`blocked_users` assertions FAIL with "table does not exist").

## 5. Deviations from the spec contract

None. Function signatures, column names/types, grant lists, and table shapes match
`docs/features/community-reviews/spec.md` §1 exactly. One judgment call the spec left open,
documented in the migration itself: `report_review()` does **not** check whether the caller has
blocked the review's author — blocking only filters what a traveler sees going forward, it
doesn't retroactively revoke their ability to report something they already saw. `report_review`
does still refuse to report a hidden review that isn't the caller's own (a review they can't see).

## 6. Open questions / risks for the security reviewer

- `block_review_author()` looks up a review's `user_id` (the author) regardless of whether that
  review is currently visible to the caller (hidden-and-not-theirs included), because blocking
  never returns any data to the client — the function returns `void`. Worth a second opinion:
  is silently allowing "block the author of a review you can't see" acceptable, or should it
  mirror `report_review`'s visibility check even though nothing leaks either way?
- `security definer` functions in this migration rely on being owned by the role that runs the
  SQL Editor (Supabase's default admin role for that editor, which bypasses row level security)
  for `get_stop_reviews`/`get_stop_review_stats` to see every row before applying their own
  hand-written visibility filter. If the founder ever runs this migration as a different,
  lower-privileged role, confirm that role still bypasses RLS or these two functions will
  silently under-return rows instead of erroring.
- The `is_hidden`-lock trigger keys off `auth.role() = 'authenticated'`. Any future moderation
  tooling that writes to `reviews` using a different, more-privileged Supabase role would also
  see `auth.role()` return something other than `'authenticated'`, so the trigger would leave
  `is_hidden` alone for that caller too — intended (moderation code should be able to
  hide/unhide) but worth confirming once a real moderation path exists.
- `review_reports` has zero SELECT policy, so there is currently no way — app-side or even via
  the founder's own signed-in session — to read reports back except the Supabase dashboard's
  table editor. That's intentional for v1 (no moderation UI exists yet) but worth flagging so
  it isn't mistaken for a bug when someone goes looking for a "my reports" feature later.
