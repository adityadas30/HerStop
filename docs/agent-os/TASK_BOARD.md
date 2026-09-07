# TASK BOARD

> Move lines between sections. Keep it terse. `[owner]` = agent. Link feature folders.

## Blocked
- **saved-stops persistence** [supabase-db] — schema proposed (`docs/migrations/002_auth_tables.sql`,
  not yet applied); auth now implemented in code but not end-to-end verified (see auth-otp
  verification.md) — wire up once both are done.
- **reviews** [mobile-builder + supabase-db] — same as above; also needs `lib/types.ts`'s `Review`
  interface updated to the structured fields in the migration.

## Queued
- **scoring package** [mobile-builder] — pure functions in `packages/scoring`; add first Jest test.
- **lint cleanup (tiny)** [mobile-builder] — pre-existing: `components/ui/JourneyShield.tsx:4`
  unused import. (The `profile.tsx` unescaped-apostrophe error was fixed by `auth-otp-foundation`.)

## In progress
- **auth-otp-foundation follow-up** [supabase-db] — code complete (`lib/auth.ts`, `contexts/auth.tsx`,
  `_layout.tsx`, `profile.tsx`); OTP round-trip needs founder verification on a real
  device/simulator + inbox. See `docs/features/auth-otp/verification.md`.

## Done
- **agent-os-v0.1** [orchestrator] — harness build (2026-09-06).
- **db-live-reads** [supabase-db] — blocker diagnosed + tooling added (2026-09-06).
  See `docs/features/db-live-reads/`.
- **db-foundation** [supabase-db] — live reads re-confirmed; RLS anon-write block confirmed;
  proposed `profiles`/`saved_stops`/`reviews` schema (2026-09-06, separate branch/PR).
  See `docs/features/db-foundation/`.
- **auth-otp-foundation** [supabase-db] — email OTP sign-in implemented, guest browsing preserved
  (2026-09-06). See `docs/features/auth-otp/`.

## Dependency chain (do not skip ahead)
`db-live-reads` → `db-foundation` (schema proposal) + `auth-otp-foundation` (code, done) → founder
verifies OTP round-trip + runs the migration → saved-stops persistence → reviews → real scoring →
recommendation ranking. Maps/Places can scaffold after DB reads are stable. Sentry/PostHog before
beta, after core flows.
