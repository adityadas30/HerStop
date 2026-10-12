# Founder apply runbook — migrations 003 → 005 → 006 (→ 007 optional)

_Written 2026-10-12 from the SQL files and `apps/mobile/scripts/{rls,supabase}-check.mjs`, not from
older docs. Agents do not run any of this — it is founder-only (Supabase SQL Editor)._

**Scope:** takes the live project from "001 + 002 applied, 6 fictional stops" to "reviews live +
44 real OpenStreetMap stops". **Never run `004`** (DO-NOT-RUN banner in the file; superseded by 006).
Order matters: **003 → 005 → 006**. Each file is idempotent and wrapped in its own
`begin … commit` with a 5s `lock_timeout`, so a failed run rolls back cleanly and can be re-run.

Never re-run `002` after `003` — it would re-create the public-read policy on `reviews` that `003`
drops.

## 0. Restore the paused project
1. Supabase dashboard → project `herstop` (`xnkjqcygzjlspeagcoal`, us-east-1) → **Restore project**.
2. Wait until status is Healthy (a few minutes). The URL/anon key in `apps/mobile/.env` do not change.
3. Sanity check, from `apps/mobile/`:
   ```bash
   npm run supabase:check
   ```
   Expected **before** any migration: `✅ LIVE — Supabase returned 6 row(s) from "stops".`
   (includes the `Willow Creek Plaza TEST` marker). If you see `ENOTFOUND`, it is still paused.

## 1. Pre-flight (read-only, SQL Editor)
```sql
-- Expected 0. 003 adds unique (user_id, stop_id); duplicates would abort it.
select count(*) from reviews;
-- Expected 0 rows.
select user_id, stop_id, count(*) from reviews group by 1,2 having count(*) > 1;
-- Expected: postgres | false
select tableowner from pg_tables where schemaname='public' and tablename='reviews';
select relforcerowsecurity from pg_class where relname='reviews';
-- Expected 6 rows, ids '1'..'6' (006 deletes these).
select id, name from stops order by id;
-- 006 deletes ids 1-6; any saved_stops/reviews pointing at them cascade-delete. Expected 0 / 0
-- (or only test data). If either is non-zero and is real user data, STOP and ask.
select count(*) from saved_stops where stop_id in ('1','2','3','4','5','6');
select count(*) from reviews     where stop_id in ('1','2','3','4','5','6');
```

## 2. Apply, in order (paste the whole file each time, press Run)
| Step | File | Expect |
|---|---|---|
| 1 | `docs/migrations/003_reviews_privacy_and_moderation.sql` | "Success. No rows returned" |
| 2 | `docs/migrations/005_stops_provider_fields.sql` | "Success. No rows returned" |
| 3 | `docs/migrations/006_ingest_real_stops.sql` | "Success. No rows returned" |

What each does (verified against the SQL): 003 drops the public read policy on `reviews`, adds
`review_reports`, `hidden_reviews`, `banned_users` (RLS on, no policies) and the RPCs
`get_stop_reviews`, `get_stop_review_stats`, `report_review`, `hide_review`, `is_banned`,
`review_publish_delay`. 005 adds `source`, `source_id`, `stop_type`, `updated_at`,
`safety_context` to `stops` + unique index `(source, source_id)` + `updated_at` trigger. 006
deletes fictional rows `'1'`–`'6'` (only where `source = 'manual'`) and upserts 44 OSM stops.

## 3. Post-checks (from `apps/mobile/`)
```bash
npm run supabase:check
```
Expected: `✅ LIVE — Supabase returned 44 row(s) from "stops".` — 44 `insert` rows in 006
(40 `Gas`, 4 with empty categories); no `TEST` marker row. Any other number means rows were
added/removed outside these migrations.

```bash
npm run rls:check
```
Expected: **`12/12 passed.`** (assertions: stops.id text, anon select stops, anon select
saved_stops, anon select reviews, anon insert saved_stops, get_stop_reviews, get_stop_review_stats,
report_review rejected, hide_review rejected, review_reports / hidden_reviews / banned_users anon
select = 0 rows). Before 003 (with 001+002 only) the 003-dependent assertions fail — that is why
the historical figure was 5/12.

Optional SQL checks:
```sql
select count(*) from stops;                                  -- 44
select count(*) from stops where source = 'openstreetmap';   -- 44
select tablename, rowsecurity from pg_tables
 where tablename in ('review_reports','hidden_reviews','banned_users','reviews','saved_stops','profiles','stops');
                                                             -- rowsecurity = true for all 7
```

## 4. Optional: account deletion (007) — after t2 merges
Only once `docs/migrations/007_delete_my_account.sql` is on the branch you are applying from
(it ships with t2, which had **not** merged into `astra/full-development` when this was written;
t2's branch `agentcraft/juniper/t2-account-deletion` contains it). Apply **after 006**, same way:
paste the whole file into the SQL Editor and run. It defines `public.delete_my_account()`
(SECURITY DEFINER, `search_path = ''`, EXECUTE revoked from PUBLIC and anon, granted to
authenticated). Idempotent (`create or replace`).

Post-checks:
```sql
select has_function_privilege('anon','public.delete_my_account()','execute');
-- Expected: false
```
```bash
npm run rls:check
```
Counts are those of `apps/mobile/scripts/rls-check.mjs`; it has **12** assertions on this
branch and **13** once t2 lands (t2 adds one for `delete_my_account`):
- After 003 + 005 + 006, **before 007**, on a branch with t2's script: **12/13** — the single
  failure is the `delete_my_account` assertion (expected, not an error).
- After 007: **13/13 passed.**
- On a branch without t2's script change: 12/12 regardless of 007.

## 5. After applying
1. Add a dated line to `docs/agent-os/STATUS.md` (which migrations, counts observed).
2. Tell the Lead; live review/saved-stop E2E verification is unblocked.
3. 007 must have been reviewed (security-sensitive) before step 4 is run.

## Rollback
- 005: rollback SQL is at the bottom of the file (dev only).
- 003: see `docs/features/community-reviews/db-verification.md` §5/§5b.
- 006: `delete from stops where source = 'openstreetmap';` (does not restore the fictional rows).
