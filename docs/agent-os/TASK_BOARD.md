# TASK BOARD

> Move lines between sections. Keep it terse. `[owner]` = agent. Link feature folders.

## Blocked
- **reviews** [mobile-builder + db-engineer] — schema proposed (`docs/migrations/002_auth_tables.sql`),
  blocked on the migration being run (auth is now verified working). Also needs `lib/types.ts`'s
  `Review` interface updated to the structured fields in the migration.

## Queued
- **agent-teams pilot** [Lead] — must run from an **interactive** session started after the
  Agent Teams env var landed. See `AGENT_TEAMS.md`. Could not be run during the harness build.
- **install Maestro** [founder decision] — flows staged in `apps/mobile/.maestro/`; enabling
  Level 3 pulls a JVM toolchain.
- **origin/dev repair** [founder decision] — `origin/dev` diverged onto a lineage predating the
  Supabase client. Local `dev` is the real one. Until resolved, cut branches from the current
  integration branch, never `origin/dev` or `main`.
- **scoring package** [mobile-builder] — pure functions in `packages/scoring`; add first Jest test.

## In progress
- **saved-stops persistence** [mobile-builder] — client implementation **done** (2026-09-08):
  Supabase-backed load/save/unsave, guest browsing preserved, Saved list derived from live stop
  data. Remains "in progress" only because `docs/migrations/002_auth_tables.sql` has not been
  applied — `saved_stops` returns `PGRST205`, so signed-in saves fail and roll back until the
  founder runs it. Simulator pass still outstanding. See
  `docs/features/saved-stops-persistence/verification.md`.

## Done
- **agent-os-v0.2** [Lead] — single-Lead orchestration, worktree specialists, enforced hooks,
  guard regression suite, staged Maestro flows (2026-09-10).
- **harness-pilot** [mobile-builder x2 + mobile-verifier] — proved concurrent worktree builders,
  autonomous dispatch, integration, and independent verification (2026-09-10). Cleared the last
  lint warning and added Maestro `testID` anchors. See `docs/features/harness-pilot/`.
- **agent-os-v0.1** [Lead] — harness build (2026-09-06).
- **db-live-reads** [db-engineer] — blocker diagnosed + tooling added (2026-09-06).
  See `docs/features/db-live-reads/`.
- **db-foundation** [db-engineer] — live reads re-confirmed (LIVE, 6 rows); RLS anon-write block
  confirmed on `stops`; proposed `profiles`/`saved_stops`/`reviews` schema + RLS in
  `docs/migrations/002_auth_tables.sql` (not yet applied) (2026-09-06). See `docs/features/db-foundation/`.
- **auth-otp-foundation** [db-engineer] — email OTP sign-in implemented and **verified working
  end-to-end** with a real round trip (2026-09-06 / 2026-09-08). See `docs/features/auth-otp/`.
- **qa-baseline** [mobile-verifier] — fresh-context baseline; fixed a real product-language violation
  ("Verified safe stops within 5 miles" → "Better-reviewed stops within 5 miles") (2026-09-06).
  See `docs/features/qa-baseline/`.

## Dependency chain (do not skip ahead)
`db-live-reads` → `db-foundation` (schema proposal, done) + `auth-otp-foundation` (verified, done)
→ **founder runs `docs/migrations/002_auth_tables.sql`** (still required) + `saved-stops
persistence` (in progress) → reviews → real scoring → recommendation ranking. Maps/Places can
scaffold after DB reads are stable. Sentry/PostHog before beta, after core flows.

> Note: `origin/dev` has diverged from this lineage — see `docs/agent-os/STATUS.md`'s "Branch
> consolidation note". Task-board state here reflects the real, consolidated work across
> `db-foundation`/`auth-otp-foundation`/`qa-baseline`, not whatever `origin/dev` currently shows.
