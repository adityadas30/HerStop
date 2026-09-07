# TASK BOARD

> Move lines between sections. Keep it terse. `[owner]` = agent. Link feature folders.

## Blocked
- **saved-stops persistence** [supabase-db] — schema proposed (`docs/migrations/002_auth_tables.sql`),
  still blocked on OTP auth existing (needs a real `auth.uid()` session) and the migration being run.
- **reviews** [mobile-builder + supabase-db] — same: schema proposed, blocked on auth. Also needs
  `lib/types.ts`'s `Review` interface updated to match the structured fields (see spec.md note).

## Queued
- **auth (OTP)** [supabase-db] — live reads confirmed; this is the next dependency. Needs a spec.
  Founder should review/run `docs/migrations/002_auth_tables.sql` first (or in parallel).
- **scoring package** [mobile-builder] — pure functions in `packages/scoring`; add first Jest test.
- **lint cleanup (tiny)** [mobile-builder] — pre-existing: `app/(tabs)/profile.tsx:19` unescaped `'`;
  `components/ui/JourneyShield.tsx:4` unused import. Unrelated to db-live-reads/db-foundation.

## In progress
- (none)

## Done
- **agent-os-v0.1** [orchestrator] — harness build (2026-09-06).
- **db-live-reads** [supabase-db] — blocker diagnosed + tooling added (2026-09-06).
  See `docs/features/db-live-reads/`.
- **db-foundation** [supabase-db] — live reads re-confirmed (LIVE, 6 rows); RLS anon-write block
  confirmed on `stops`; proposed `profiles`/`saved_stops`/`reviews` schema + RLS in
  `docs/migrations/002_auth_tables.sql` (not yet applied) (2026-09-06). See `docs/features/db-foundation/`.

## Dependency chain (do not skip ahead)
`db-live-reads` → `db-foundation` (schema proposal, done) → auth (OTP) → saved-stops persistence +
reviews (run the migration, wire up `lib/api.ts`) → real scoring → recommendation ranking.
Maps/Places can scaffold after DB reads are stable. Sentry/PostHog before beta, after core flows.
