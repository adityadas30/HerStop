# STATUS

> One-line-per-session log. Newest on top. Keep it scannable from a phone.

## Snapshot
- **Phase:** early — UI shell + typed data layer with Supabase live reads confirmed; auth-dependent
  tables proposed but not created.
- **Backend:** Supabase client wired; **live reads CONFIRMED** (2026-09-06, with a real `.env` in
  place) — `stops` returns 6 rows including the `Willow Creek Plaza TEST` marker. `.env` is
  gitignored/per-machine, so a fresh clone/worktree needs its own copy before this is true locally.
  RLS confirmed to reject anon writes to `stops` (`42501`), not just allow anon reads.
- **Schema proposal:** `docs/migrations/002_auth_tables.sql` — `profiles`, `saved_stops`, `reviews`
  with RLS scoped to `auth.uid()`. **Not applied yet** — needs founder review + manual run.
- **Branch:** `main` (protected) + `dev` (integration, exists on remote) + `agent/*` worktrees
  (`db-foundation`, `auth-foundation`, `qa-baseline` currently checked out; no overlapping work yet).
- **Tests:** none (no Jest/Maestro). Deterministic checks = `tsc` + `lint`.
- **Checks (2026-09-06, db-foundation):** `tsc` ✅ · `supabase:check` ✅ LIVE (6 rows) · `lint` ⚠️ 2
  pre-existing issues in untouched files (profile.tsx, JourneyShield.tsx) — unchanged, see task board.

## Immediate priorities
1. Founder: review `docs/migrations/002_auth_tables.sql` (esp. the public-read-on-`reviews`
   product-scope call, flagged in the file) and run it in the Supabase SQL Editor when ready.
2. After that → OTP auth UI (queued) unblocks saved-stops persistence + reviews for real.

## Log
- **2026-09-06** — `db-foundation`: re-confirmed live Supabase reads end-to-end (closing out
  `db-live-reads`'s open blocker — the project host was fixed at the platform level, no app-side
  change needed). Confirmed via non-destructive probe that RLS also blocks anon writes to `stops`.
  Left the `Willow Creek Plaza TEST` marker row as-is (documented why — the anon key can't rename it
  anyway, and it's harmless pre-launch). Wrote `docs/migrations/002_auth_tables.sql`, a proposed
  (unexecuted) schema + RLS for `profiles`/`saved_stops`/`reviews`, all writes scoped to
  `auth.uid()`. Updated architecture docs to match. No service-role key used. `tsc`/`lint` results
  in `docs/features/db-foundation/verification.md`.
- **2026-09-06** — Built Agent OS v0.1 harness (agents, rules, agent-os docs, feature template,
  reorganized docs). Validated with `db-live-reads`: pinned live-read blocker to NXDOMAIN on the
  Supabase project host; added `.env.example`, live-vs-mock logging, and `supabase:check` script.
  `tsc`/`lint` results recorded in `docs/features/db-live-reads/verification.md`.
