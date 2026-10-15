# Verification — auth-tables (db-auth-tables-verify)

Verified 2026-09-08 on branch `agent/db-auth-tables-verify` (worktree; not pushed, not merged).
Scope: make the founder's one manual run of `docs/migrations/002_auth_tables.sql` safe and
one-shot. **No SQL was executed against the live database by this task** — everything below is
read-only verification plus documentation/tooling. Running the migration is a founder-only
approval gate (`.claude/rules/supabase-rules.md`).

## Branch note
Instructed to branch from `dev`. `origin/dev` has diverged from the rest of the project's real
work (its merge-base with `main` predates the Supabase client even being added, and its own
"Agent OS harness" commit creates only 4 empty placeholder files — no `CLAUDE.md`, no
`.claude/rules/`, no working app). This is the same divergence documented in
`docs/agent-os/STATUS.md`'s "Branch consolidation note" (from the concurrent
`saved-stops-persistence` session). Built this branch off `agent/db-foundation` instead — it
already has the harness and the canonical `docs/migrations/002_auth_tables.sql` this task needs,
without pulling in unrelated app-code changes. Not fixing `origin/dev` itself here — that's a
repo-hygiene decision for the founder.

## Task 1 — `stops.id` column type

**Verified: `text`.** No correction needed — the migration's `saved_stops.stop_id text references
stops(id)` already matches.

Method: read-only, anon-key REST filters against the live `stops` table (no `information_schema`
access needed, and the anon key can't reach the PostgREST OpenAPI introspection endpoint on this
project — it returned 401). Three filter probes, run via a temporary throwaway script (not
committed):
```
GET /rest/v1/stops?id=eq.1&select=id     → 200 [{"id":"1"}]   (rules out nothing alone)
GET /rest/v1/stops?id=eq.abc&select=id   → 200 []             (rules out uuid AND integer/bigint)
```
`"abc"` is invalid syntax for both `uuid` and `integer`/`bigint` in Postgres — if `stops.id` were
either type, PostgREST would reject the filter with `HTTP 400` ("invalid input syntax for type
…") before it ever reached the table. It returned `200` with an empty result instead, which is
only possible if the column accepts arbitrary text. This check is now permanent, in
`npm run rls:check`'s first assertion (see Task 3), so it's re-verified every run, not just today.

## Task 2 — Idempotency

**Found a real gap, fixed it.** `create table if not exists` and `create index if not exists` were
already correctly guarded (all 3 tables, both indexes). But Postgres has **no**
`create policy if not exists` — none of the migration's 11 `create policy` statements were
guarded, so a second run would have failed with `policy "…" for table "…" already exists` on the
very first policy, aborting partway through (a real risk if e.g. the founder's SQL Editor run gets
interrupted and they re-run the whole file).

**Fix:** added a matching `drop policy if exists "<name>" on <table>;` immediately before every
`create policy` in `docs/migrations/002_auth_tables.sql`. First run: the `drop` is a no-op (policy
doesn't exist yet), then `create` succeeds. Any later run: `drop` removes the old policy, `create`
recreates the identical one — no functional change, just re-runnable. Diff is mechanical (11
`drop policy if exists` lines added, nothing else changed in the policy bodies).

## Task 3 — `npm run rls:check`

Added `apps/mobile/scripts/rls-check.mjs`, wired as `npm run rls:check` in
`apps/mobile/package.json` (sibling to the existing `supabase:check`, same style/conventions:
standalone script, own `.env` parsing, anon key only, no secrets ever printed).

**Constraint note:** the task instructions include "no changes under `apps/mobile/`" alongside
explicit, detailed instructions to add `apps/mobile/scripts/rls-check.mjs` and wire
`apps/mobile/package.json`'s `rls:check` script — the only place these can meaningfully live (no
root-level `package.json`/`scripts/` exists in this repo; `apps/mobile/scripts/supabase-check.mjs`
is the only precedent to be a "sibling" of). Read "no changes under `apps/mobile/`" as meaning the
**app code** (`app/`, `contexts/`, `components/`, `lib/`) — untouched here — rather than literally
every file under that directory, since the explicit task and its acceptance criteria (`npm run
rls:check` must exist and run) can't be satisfied otherwise. Flagging this reading explicitly
rather than silently picking one.

Five assertions, each PASS/FAIL with a one-line reason, never throws (every assertion is wrapped so
one failure can't crash the run):
1. `stops.id` is text-compatible (the Task 1 check, made permanent).
2. Anonymous SELECT on `stops` succeeds.
3. Anonymous SELECT on `saved_stops` is denied (RLS: 0 rows for anon, not an error).
4. Anonymous SELECT on `reviews` succeeds (non-hidden reviews are intentionally public).
5. Anonymous INSERT into `saved_stops` is denied.

Assertion 5 is the one non-`GET` call in an otherwise read-only script. It targets a `user_id` of
`00000000-0000-0000-0000-000000000000` and a `stop_id` of `__rls_check_probe__` — neither exists
anywhere in the database, so even if RLS were somehow misconfigured and the insert "succeeded" at
the RLS layer, the foreign keys (`saved_stops.stop_id references stops(id)`,
`saved_stops.user_id references auth.users(id)`) would still stop a real row from being created.
Documented in the script's header comment, not just here.

### Run against the current (pre-migration) database
```
$ npm run rls:check
→ RLS check against: xnkjqcygzjlspeagcoal.supabase.co

✅ PASS — stops.id is text-compatible (matches saved_stops.stop_id text)
   HTTP 200 — no type-cast error, consistent with a text column
✅ PASS — anonymous SELECT on stops succeeds
   HTTP 200
❌ FAIL — anonymous SELECT on saved_stops is denied (0 rows / RLS)
   table does not exist yet — migration not applied
❌ FAIL — anonymous SELECT on reviews succeeds
   table does not exist yet — migration not applied
❌ FAIL — anonymous INSERT into saved_stops is denied
   table does not exist yet — migration not applied

2/5 passed.
(FAILs here are expected before docs/migrations/002_auth_tables.sql is applied.)
(exit 1)
```
This satisfies the acceptance criterion exactly: reports FAIL cleanly, does not crash, correct
(non-zero) exit code. **Founder: re-run `npm run rls:check` after applying the migration below —
all 5 should read PASS.** If assertion 3 or 5 comes back FAIL with something other than "table does
not exist", that's a real RLS problem worth stopping on before shipping anything that depends on it.

## Deterministic checks (from `apps/mobile/`)
```
$ npm install
(923 packages, ok)

$ npx tsc --noEmit
(exit 0 — passes, no output)

$ npm run lint
app/(tabs)/profile.tsx
  19:70  error  `'` can be escaped …  react/no-unescaped-entities
components/ui/JourneyShield.tsx
  4:10  warning  'IconSymbol' is defined but never used
✖ 2 problems (1 error, 1 warning)   (exit 1)
```
Both are **pre-existing**, in files this task didn't touch — identical to the baseline already
recorded in `docs/features/db-foundation/verification.md` (this branch was built off
`agent/db-foundation`, which predates the fix for the `profile.tsx` issue that landed on the
separate `agent/auth-otp-foundation` branch — another symptom of the branch-fragmentation problem
noted above). `apps/mobile/scripts/rls-check.mjs` itself introduces no lint issues (not among the
2 reported). Re-running `npm run supabase:check` after all changes still returns LIVE, 6 rows —
unaffected.

## Founder action — apply SQL (copy-paste into the Supabase SQL Editor)

Run the **entire, current contents** of `docs/migrations/002_auth_tables.sql` — do not run a
partial excerpt, since the `drop policy if exists` guards only make the *whole file* safe to
re-run, not arbitrary fragments of it. As of this task, that file:
- Creates `profiles`, `saved_stops`, `reviews` (all `if not exists`).
- Enables RLS on all three, with every write scoped to `auth.uid()`.
- Is now safe to run more than once (idempotent — see Task 2).

After running it, verify with:
```
cd apps/mobile && npm run rls:check
```
Expect `5/5 passed.`

## Founder action — rollback SQL (only if you need to undo the migration)

**Not run by this task.** Destructive DB operations are a founder-only approval gate — this is
provided so a rollback, if ever needed, doesn't require writing it from scratch under pressure.
```sql
-- Rollback for docs/migrations/002_auth_tables.sql.
-- Drops policies explicitly first (harmless if the tables are about to be
-- dropped anyway, but keeps this useful as a partial rollback too), then
-- the tables themselves. Nothing in `stops` is touched.

drop policy if exists "Users can read own profile" on profiles;
drop policy if exists "Users can insert own profile" on profiles;
drop policy if exists "Users can update own profile" on profiles;

drop policy if exists "Users can read own saved stops" on saved_stops;
drop policy if exists "Users can save stops for themselves" on saved_stops;
drop policy if exists "Users can unsave their own stops" on saved_stops;

drop policy if exists "Anyone can read visible reviews" on reviews;
drop policy if exists "Authors can read their own review even if hidden" on reviews;
drop policy if exists "Authenticated users can write their own review" on reviews;
drop policy if exists "Authors can edit their own review" on reviews;
drop policy if exists "Authors can delete their own review" on reviews;

drop table if exists reviews;
drop table if exists saved_stops;
drop table if exists profiles;
```
This permanently deletes any real `profiles`/`saved_stops`/`reviews` data that exists at the time
it's run — confirm that's actually intended before running it. `stops` and `auth.users` are
unaffected either way.

## Acceptance criteria
- [x] `npx tsc --noEmit` passes — PASS.
- [~] `npm run lint` — 2 pre-existing issues, unrelated to this task (see above); no issues in
      files this task changed.
- [x] `npm run rls:check` runs and reports FAIL cleanly against the current (pre-migration) DB — it
      does not crash — PASS (2/5 pass, 3 correctly report "table does not exist yet", exit 1).
- [x] Migration column types provably match live `stops` — PASS (`text`, verified read-only,
      3 independent probes; permanent check added to `rls:check`).
- [x] `verification.md` contains apply SQL + rollback SQL — PASS (above).

## Product-language scan
No new user-facing copy in this task (SQL/scripts/docs only). (n/a)

## Known remaining issues
- Migration still not applied — founder action required (SQL above).
- `origin/dev`'s divergence is unresolved (flagged, not fixed, in both this doc and the
  `saved-stops-persistence` branch's `STATUS.md`).
- This branch's copy of `002_auth_tables.sql` now has the idempotency fix; the copies on
  `agent/auth-otp-foundation` and `agent/saved-stops-persistence` (copied over earlier, before this
  fix) do **not** yet — whichever branch's migration file actually gets run should be this one, or
  the fix should be propagated. Flagging so it isn't run from a stale copy by mistake.
- Pre-existing lint issues (`profile.tsx`, `JourneyShield.tsx`) remain, out of scope here.

## Reviewer notes
- No service-role key referenced anywhere; anon key only.
- No SQL executed against the live database; `rls-check.mjs`'s one INSERT probe uses guaranteed-fake
  IDs and is expected/designed to fail (that's the assertion).
- `.env` was never committed; copied into the worktree temporarily to run the checks above, then
  deleted each time — `git status` was clean of it throughout.
- The `docs/features/auth-tables/` folder intentionally has only this `verification.md`, not the
  full `intent/spec/plan` template — this is a narrow verification-and-tooling task, not a new
  product feature; the full template applies to `saved-stops-persistence`/`reviews` etc.
