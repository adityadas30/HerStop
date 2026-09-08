# TASK BOARD

> Move lines between sections. Keep it terse. `[owner]` = agent. Link feature folders.

## Blocked
- **reviews** [mobile-builder + supabase-db] — schema proposed (`docs/migrations/002_auth_tables.sql`),
  blocked on the migration being run (auth is now verified working). Also needs `lib/types.ts`'s
  `Review` interface updated to the structured fields in the migration.

## Queued
- **scoring package** [mobile-builder] — pure functions in `packages/scoring`; add first Jest test.
- **lint cleanup (tiny)** [mobile-builder] — pre-existing: `components/ui/JourneyShield.tsx:4`
  unused import. (The `profile.tsx` unescaped-apostrophe error was fixed by `auth-otp-foundation`;
  the "Verified safe stops" product-language error was fixed by `qa-baseline`.)

## In progress
- **saved-stops persistence** [supabase-db] — implementing authenticated `saved_stops` persistence
  against `docs/migrations/002_auth_tables.sql` (not yet applied — founder run still required
  before this can be exercised against real data). See `docs/features/saved-stops-persistence/`.

## Done
- **agent-os-v0.1** [orchestrator] — harness build (2026-09-06).
- **db-live-reads** [supabase-db] — blocker diagnosed + tooling added (2026-09-06).
  See `docs/features/db-live-reads/`.
- **db-foundation** [supabase-db] — live reads re-confirmed (LIVE, 6 rows); RLS anon-write block
  confirmed on `stops`; proposed `profiles`/`saved_stops`/`reviews` schema + RLS in
  `docs/migrations/002_auth_tables.sql` (not yet applied) (2026-09-06). See `docs/features/db-foundation/`.
- **auth-otp-foundation** [supabase-db] — email OTP sign-in implemented and **verified working
  end-to-end** with a real round trip (2026-09-06 / 2026-09-08). See `docs/features/auth-otp/`.
- **qa-baseline** [qa-verifier] — fresh-context baseline; fixed a real product-language violation
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
