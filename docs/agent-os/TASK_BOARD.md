# TASK BOARD

> Move lines between sections. Keep it terse. `[owner]` = agent. Link feature folders.

## Blocked
- **saved-stops persistence** [mobile-builder] — app-side implementation **done and merged** into
  `agent/agent-os-v0.2`: Supabase-backed load/save/unsave, guest browsing preserved, Saved list
  derived from live stop data. **Blocked on the founder running
  `docs/migrations/002_auth_tables.sql`** — `saved_stops` does not exist yet (`npm run rls:check`
  2/5, re-confirmed 2026-09-10), so signed-in saves fail and roll back by design. After the run:
  `rls:check` should read 5/5, then a Level 2 Simulator pass (signed-in save → Saved tab →
  sign out → sign back in). See `docs/features/saved-stops-persistence/verification.md`.
- **reviews** [db-engineer → mobile-builder] — blocked on the same migration, then on saved-stops
  being verified. `getReviews()` in `lib/api.ts` is still a stub, and `lib/types.ts`'s `Review`
  interface (`rating`/`body`) must be updated to the structured columns in the migration.

## Queued
- **auth-otp device tap-through** [founder / mobile-verifier] — the live API round trip is
  verified; the sign-in UI has never been tapped through on a Simulator or iPhone.
- **integrate into `dev` → `main`** [founder decision] — `agent/agent-os-v0.2` is 12 commits ahead
  of `dev`, 27 ahead of `main`, and **not pushed to origin** (it exists only on this machine).
- **agent-teams pilot** [Lead] — must run from an **interactive** session started after the
  Agent Teams env var landed. See `AGENT_TEAMS.md`. Could not be run during the harness build.
- **install Maestro** [founder decision] — flows staged in `apps/mobile/.maestro/`; enabling
  Level 3 pulls a JVM toolchain.
- **scoring package** [mobile-builder] — pure functions in `packages/scoring`; add first Jest test.
  Downstream of reviews in the dependency chain.

## In progress
_(nothing — the next step is the founder's migration run)_

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
→ **founder runs `docs/migrations/002_auth_tables.sql`** ⏳ *(the only current blocker)*
→ `saved-stops` live verification *(code already done)* → reviews → real scoring →
recommendation ranking. Maps/Places can scaffold after DB reads are stable. Sentry/PostHog before
beta, after core flows.

> Branches: cut new work from the current integration branch (`agent/agent-os-v0.2`). `dev` is
> healthy but 12 commits behind it; `main` is 27 behind.
