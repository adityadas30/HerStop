# STATUS

> One-line-per-session log. Newest on top. Keep it scannable from a phone.

## Snapshot
- **Phase:** early — UI shell + typed data layer with Supabase/mock fallback.
- **Backend:** Supabase client wired; **live reads BLOCKED** — project host in `.env` returns
  NXDOMAIN (dead/incorrect project). App serves `MOCK_STOPS`. See `docs/features/db-live-reads/`.
- **Branch:** `main` only. No `dev`/worktrees yet (documented, not created).
- **Tests:** none (no Jest/Maestro). Deterministic checks = `tsc` + `lint`.
- **Checks (2026-09-06):** `tsc` ✅ · `supabase:check` ❌ NXDOMAIN (expected) · `lint` ⚠️ 2
  pre-existing issues in untouched files (profile.tsx, JourneyShield.tsx) — see task board.

## Immediate priorities
1. Founder: restore/recreate Supabase project + reseed, then run `npm run supabase:check`.
2. After live reads confirmed → saved-stops persistence (needs auth) is the next dependency.

## Log
- **2026-09-06** — Built Agent OS v0.1 harness (agents, rules, agent-os docs, feature template,
  reorganized docs). Validated with `db-live-reads`: pinned live-read blocker to NXDOMAIN on the
  Supabase project host; added `.env.example`, live-vs-mock logging, and `supabase:check` script.
  `tsc`/`lint` results recorded in `docs/features/db-live-reads/verification.md`.
