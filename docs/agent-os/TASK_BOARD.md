# TASK BOARD

> Move lines between sections. Keep it terse. `[owner]` = agent. Link feature folders.

## Blocked
_(none — migration 002 applied 2026-09-10, `rls:check` 5/5)_

## Queued
- **auth-otp device tap-through** [founder / mobile-verifier] — the live API round trip is
  verified; the sign-in UI has never been tapped through on a Simulator or iPhone.
- **integrate into `dev` → `main`** [founder decision] — `agent/agent-os-v0.2` is ahead of both;
  backed up to `origin/agent/agent-os-v0.2` (2026-09-10), not merged.
- **agent-teams pilot** [Lead] — must run from an **interactive** session started after the
  Agent Teams env var landed. See `AGENT_TEAMS.md`. Could not be run during the harness build.
- **install Maestro** [founder decision] — flows staged in `apps/mobile/.maestro/`; enabling
  Level 3 pulls a JVM toolchain.
- **scoring package** [mobile-builder] — pure functions in `packages/scoring`; add first Jest test.
  Downstream of reviews in the dependency chain.

## In progress
- **saved-stops live verification** [mobile-verifier] — code done and merged; table now exists.
  Guest + code-path verification running; signed-in steps need a human sign-in (no scripted
  Simulator taps on this machine). See `docs/features/saved-stops-persistence/verification.md`.
- **MVP scope pass** [Lead + repo-scout] — MUST SHIP / SHOULD SHIP / CUT classification.
- **reviews** [db-engineer → mobile-builder] — next. Table + RLS live. `getReviews()` in
  `lib/api.ts` is still a stub; `lib/types.ts`'s `Review` (`rating`/`body`) must match the
  structured columns.

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
