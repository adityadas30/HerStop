# Verification — db-foundation

Verified 2026-09-06 on branch `agent/db-foundation` (worktree, no push to `main`/`dev` yet at time
of writing — see STATUS.md for whether a PR was opened this session).

## Commands run (with results)

### Live read + RLS probes
`.env` isn't committed (gitignored, per-machine); it was temporarily copied from the founder's main
checkout into this worktree's `apps/mobile/.env` to run these checks, then deleted afterward — no
secret was logged, only the host and HTTP status codes.

```
$ npm run supabase:check
→ Checking Supabase project host: xnkjqcygzjlspeagcoal.supabase.co
✅ LIVE — Supabase returned 6 row(s) from "stops".
   Found live marker row: "Willow Creek Plaza TEST" (id=1).
   Row names: The Atlas Point, Meridian Transit Hub, Cedar Falls Rest Area, Sunrise Travel Center,
   Harbor View Stop, Willow Creek Plaza TEST
```

```
# Anon-key table existence probe (read-only)
SELECT stops       → 200 OK
SELECT profiles    → 404 (table doesn't exist yet — expected)
SELECT saved_stops → 404 (table doesn't exist yet — expected)
SELECT reviews     → 404 (table doesn't exist yet — expected)

# Non-destructive write probe: INSERT colliding with an existing PK
# (can only fail — either on RLS or on the unique constraint — never
# succeeds, so no data can be written or changed by this check)
INSERT stops id=1 (already exists) → 401 Unauthorized
{"code":"42501","message":"new row violates row-level security policy for table \"stops\""}
```
`42501` (RLS violation) fired before `23505` (duplicate key) would have — confirming RLS blocks the
anon key's write outright, not just relying on the primary key to reject it.

### Deterministic checks (from `apps/mobile/`)
```
$ npx tsc --noEmit
(exit 0 — passes, no output)

$ npm run lint
/apps/mobile/app/(tabs)/profile.tsx
  19:70  error  `'` can be escaped …  react/no-unescaped-entities
/apps/mobile/components/ui/JourneyShield.tsx
  4:10  warning  'IconSymbol' is defined but never used
✖ 2 problems (1 error, 1 warning)   (exit 1)
```
Both are pre-existing issues in files this task didn't touch (already logged on the task board
from `db-live-reads`). This task changed no `apps/mobile/**` code, so the baseline is identical —
confirmed by re-running lint before and after the doc changes with the same result.

## TEST marker row — decision
**Kept as-is, not renamed.** Two independent reasons:
1. The anon-key write probe above proves the mobile app's credentials cannot write to `stops` at
   all — renaming the row would require a service-role key, which is against
   `.claude/rules/supabase-rules.md` and this task's instructions.
2. Even if it could: the row is a harmless internal verification marker, not shown to any real user
   yet, and removing it now would just require re-adding a marker the next time live reads need
   re-confirming.

If/when the founder wants it cleaned up (e.g. before a demo), the SQL is a one-liner to run by hand
in the Supabase SQL Editor:
```sql
update stops set name = 'Willow Creek Plaza' where id = '1';
```
This was **not** run — it's here for the founder to use at their discretion, not executed by the agent.

## Acceptance criteria
- [x] `npm run supabase:check` reports LIVE with row count and content — PASS (6 rows, TEST marker
      present, listed above).
- [x] RLS on `stops` confirmed to reject anonymous writes via a non-destructive probe — PASS
      (`42501` permission denied; no row created or changed).
- [x] `docs/migrations/002_auth_tables.sql` exists, unexecuted, defines `profiles`/`saved_stops`/
      `reviews` with `auth.uid()`-scoped writes — PASS.
- [x] `docs/architecture/data-model.md` and `supabase-rls.md` updated — PASS.
- [x] TEST marker decision documented — PASS (see above).
- [x] `npx tsc --noEmit` passes; `npm run lint` shows only the two pre-existing issues — PASS.
- [x] `docs/agent-os/STATUS.md` and `TASK_BOARD.md` updated — PASS (see those files).
- [x] No service-role key used, referenced, or requested — PASS.

## Product-language scan
No "safe"/"verified safe"/"guaranteed"/"crime-free" introduced anywhere in this task's docs. (yes)

## Known remaining issues / next steps
- `profiles`/`saved_stops`/`reviews` are **proposed only** — not created in the live project. Next
  step (after this PR is reviewed): founder runs `docs/migrations/002_auth_tables.sql` in the SQL
  Editor, or an agent does once given explicit go-ahead for that specific run.
- OTP auth UI doesn't exist yet — RLS policies here can't be exercised end-to-end (as an
  authenticated user) until it does. That's the `auth (OTP)` task already queued on the task board.
- `apps/mobile/lib/types.ts`'s `Review` interface is a placeholder that doesn't match the
  structured fields in the new migration — flagged in `spec.md` for whoever builds the reviews
  feature to update.
- The known moderation limitation (author can un-hide their own `is_hidden` review) is documented
  inline in `002_auth_tables.sql`, not fixed — intentionally scoped out of a v1 schema.
- Pre-existing lint issues (`profile.tsx`, `JourneyShield.tsx`) remain untouched, per scope
  discipline; still tracked as a tiny cleanup on the task board.

## Reviewer notes
- No service-role key used at any point; anon key only, never logged (only host + HTTP status
  codes appear in this doc).
- `.env` was never committed — copied into the worktree temporarily for verification, then deleted;
  `git status` was clean throughout (`.env` is gitignored regardless).
- All changes in this task are additive documentation + one unexecuted SQL file; no live schema or
  data was modified.
- `stops` public-read RLS is unchanged and still appropriate (non-sensitive, anonymous browsing).
- Flag for founder judgment call, not silently assumed: making `reviews` SELECT public (not just
  `stops`) is a product-scope decision, documented with rationale in `002_auth_tables.sql` and
  `spec.md` — please confirm this matches intent before the migration is run.
