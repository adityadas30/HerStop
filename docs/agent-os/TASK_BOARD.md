# TASK BOARD

> Move lines between sections. Keep it terse. `[owner]` = agent. Link feature folders.

## Blocked
- **saved-stops persistence** [supabase-db] — blocked by `db-live-reads` + auth.
- **reviews** [mobile-builder + supabase-db] — blocked by auth.

## Queued
- **auth (OTP)** [supabase-db] — after live reads confirmed. Needs a spec.
- **scoring package** [mobile-builder] — pure functions in `packages/scoring`; add first Jest test.
- **lint cleanup (tiny)** [mobile-builder] — pre-existing: `app/(tabs)/profile.tsx:19` unescaped `'`;
  `components/ui/JourneyShield.tsx:4` unused import. Unrelated to db-live-reads.

## In progress
- (none)

## Done
- **agent-os-v0.1** [orchestrator] — harness build (2026-09-06).
- **db-live-reads** [supabase-db] — blocker diagnosed + tooling added (2026-09-06).
  See `docs/features/db-live-reads/`.

## Dependency chain (do not skip ahead)
`db-live-reads` → saved-stops persistence → auth → reviews → real scoring → recommendation ranking.
Maps/Places can scaffold after DB reads are stable. Sentry/PostHog before beta, after core flows.
