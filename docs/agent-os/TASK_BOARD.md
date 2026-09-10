# TASK BOARD

> Move lines between sections. Keep it terse. `[owner]` = agent. Link feature folders.

## Blocked
_(none — migration 002 applied 2026-09-10, `rls:check` 5/5)_

## Queued
- **integrate into `dev` → `main`** [founder decision] — `agent/agent-os-v0.2` is ahead of both;
  backed up to `origin/agent/agent-os-v0.2` (2026-09-10), not merged.
- **agent-teams pilot** [Lead] — must run from an **interactive** session started after the
  Agent Teams env var landed. See `AGENT_TEAMS.md`. Could not be run during the harness build.
- **scoring package** [mobile-builder] — pure functions in `packages/scoring`; add first Jest test.
  Downstream of reviews in the dependency chain.

## In progress
Sprint dependency graph (founder priority order, 2026-09-10):
- ✅ dev consolidation — `dev` fast-forwarded to the integration branch and pushed.
- ✅ OTP length bug — input accepted 6 digits, Supabase sends 8; now accepts 6–10 (`fbc43c3`).
- ✅ saved-stops cold-launch fix merged (`7fa6dd0`).
- ⏳ **auth UI + saved-stops live QA** [mobile-verifier, Maestro, sim `7ABF361F`] — waits on the
  founder's OTP code; "sign back in restores list" deferred to the second OTP.
- ⏳ **migration 003** (reviews privacy + report/block) — drafted and merged; `security-reviewer`
  running → founder approval brief → founder runs it.
- ⏳ **community-reviews app side** [mobile-builder, worktree, sim `BBB1BA5C`, port 8083] —
  reviews, form, report/hide, scoring labels from real reviews only, removes fabricated
  rating/count/badge/distance. Spec: `docs/features/community-reviews/`.
- ⏳ **Coming Soon surfaces + TestFlight config** [mobile-builder, worktree, sim `A7B10A46`, port 8082].
- ⏳ **OSM beta stop dataset** (I-65 West Lafayette → Indianapolis) [research agent, scratchpad]
  → seed migration (founder runs; replaces the fictional stops).
- ⬜ foreground location + distance (`expo-location`) — after reviews merges (same files).
- ⬜ loading/empty/error polish → Sentry → TestFlight build (founder login) → beta-readiness audit.

## Done
- **repo maintenance** [Lead] — canonical docs brought in line with repo reality; 8 merged, clean
  task worktrees removed (branches kept); final read-only review of `002_auth_tables.sql`
  (2026-09-10).
- **origin/dev repair** — resolved **by merge, not reset**: `origin/dev` = local `dev` = `60749f0`,
  and the old divergent tip `89c9237` is now an ancestor of it. `dev` contains `CLAUDE.md`, the
  harness, the Supabase client and auth. Confirmed with `git ls-remote` (2026-09-10).
- **agent-os-v0.2** [Lead] — single-Lead orchestration, worktree specialists, enforced hooks,
  guard regression suite, staged Maestro flows (2026-09-10).
- **harness-pilot** [mobile-builder x2 + mobile-verifier] — proved concurrent worktree builders,
  autonomous dispatch, integration, and independent verification (2026-09-10). Cleared the last
  lint warning and added Maestro `testID` anchors. See `docs/features/harness-pilot/`.
- **db-auth-tables-verify** [db-engineer] — `stops.id` confirmed `text`; migration made re-runnable;
  `npm run rls:check` added (2026-09-08). See `docs/features/auth-tables/`.
- **agent-os-v0.1** [Lead] — harness build (2026-09-06).
- **db-live-reads** [db-engineer] — blocker diagnosed + tooling added (2026-09-06).
  See `docs/features/db-live-reads/`.
- **db-foundation** [db-engineer] — live reads re-confirmed (LIVE, 6 rows); RLS anon-write block
  confirmed on `stops`; proposed `profiles`/`saved_stops`/`reviews` schema + RLS in
  `docs/migrations/002_auth_tables.sql` (not yet applied) (2026-09-06). See `docs/features/db-foundation/`.
- **auth-otp-foundation** [db-engineer] — email OTP sign-in implemented and **verified working
  end-to-end** against the live API with a real round trip (2026-09-06 / 2026-09-08).
  See `docs/features/auth-otp/`.
- **qa-baseline** [mobile-verifier] — fresh-context baseline; fixed a real product-language violation
  ("Verified safe stops within 5 miles" → "Better-reviewed stops within 5 miles") (2026-09-06).
  See `docs/features/qa-baseline/`.

## Dependency chain (do not skip ahead)
`db-live-reads` ✅ → `db-foundation` ✅ + `auth-otp-foundation` ✅
→ migration 002 ✅ *(applied 2026-09-10, `rls:check` 5/5)*
→ `saved-stops` live verification ⏳ *(code already done)* → reviews → real scoring →
recommendation ranking. Maps/Places can scaffold after DB reads are stable. Sentry/PostHog before
beta, after core flows.

> Branches: cut new work from the current integration branch (`agent/agent-os-v0.2`). `dev` is
> healthy but behind it; `main` is further behind.
