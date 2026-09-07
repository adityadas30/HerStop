# STATUS

> One-line-per-session log. Newest on top. Keep it scannable from a phone.

## Snapshot
- **Phase:** early — UI shell + typed data layer; live Supabase reads confirmed; email OTP sign-in
  now implemented (Task 1 of the auth → saved-stops → reviews dependency chain).
- **Backend:** Supabase client wired; **live reads CONFIRMED** (re-verified this session, with a
  real `.env` present) — `stops` returns 6 rows incl. the `Willow Creek Plaza TEST` marker. `.env`
  is gitignored/per-machine, so a fresh clone/worktree needs its own copy. See
  `docs/features/db-live-reads/` for the original NXDOMAIN diagnosis (since fixed at the project
  level, no app code change needed).
- **Auth:** email OTP sign-in implemented (`lib/auth.ts`, `contexts/auth.tsx`, wired into
  `_layout.tsx` and `profile.tsx`). Guest browsing unaffected — sign-in is optional. Supabase Auth
  settings confirmed via read-only probe: email provider enabled, autoconfirm off (matches an OTP
  flow). **Not fully end-to-end verified** — no iOS Simulator or test-inbox access in this
  environment; see `docs/features/auth-otp/verification.md` for the exact remaining founder check.
- **Schema:** no new tables. `profiles`/`saved_stops`/`reviews` remain proposed-only
  (`docs/migrations/002_auth_tables.sql`), not applied.
- **Branch:** `main` (protected) + `dev` (integration) + `agent/*` worktrees
  (`db-foundation`, `auth-otp-foundation`, `qa-baseline`, `auth-foundation`).
- **Tests:** none (no Jest/Maestro). Deterministic checks = `tsc` + `lint`.
- **Checks (2026-09-06, auth-otp-foundation):** `tsc` ✅ · `lint` ✅ (0 errors — the pre-existing
  `profile.tsx` apostrophe error is fixed by this task's rewrite; 1 unrelated pre-existing warning
  remains in `JourneyShield.tsx`) · `supabase:check` ✅ LIVE (6 rows, unaffected by the auth changes).

## Immediate priorities
1. Founder: verify the OTP round-trip on a real device/simulator (send a code to a real inbox,
   enter it, confirm sign-in) — see `docs/features/auth-otp/verification.md` for exact steps and
   what to check in the Supabase Auth dashboard if `verifyOtp` rejects a correct-looking code.
2. Founder: review `docs/migrations/002_auth_tables.sql` and run it when ready.
3. After both → saved-stops persistence, then reviews (both now unblocked by real auth).

## Log
- **2026-09-06** — `auth-otp-foundation`: implemented Supabase email OTP sign-in end-to-end in code
  (`lib/auth.ts` wrapper, `contexts/auth.tsx` provider/hook, `_layout.tsx` wiring, `profile.tsx`
  3-state UI). Fixed the pre-existing `profile.tsx` lint error as part of the rewrite. No new
  tables; `docs/schema.sql` got a comment-only addendum. No service-role key, no new dependencies,
  no Supabase Auth dashboard changes made. This worktree's branch was cut before the Agent OS
  harness landed — fast-forwarded onto `agent/agent-os-v0.1` (the harness commit, isolated on its
  own branch) first so `CLAUDE.md`/`.claude/rules/`/`docs/agent-os/` exist here; see
  `docs/features/auth-otp/verification.md` for details. `tsc`/`lint`/`supabase:check` results in
  that same file.
- **2026-09-06** — `db-foundation` (separate branch/PR): re-confirmed live Supabase reads; verified
  RLS blocks anon writes to `stops`; proposed `profiles`/`saved_stops`/`reviews` schema + RLS in
  `docs/migrations/002_auth_tables.sql` (not yet applied). See `docs/features/db-foundation/`.
- **2026-09-06** — Built Agent OS v0.1 harness (agents, rules, agent-os docs, feature template,
  reorganized docs). Validated with `db-live-reads`: pinned live-read blocker to NXDOMAIN on the
  Supabase project host; added `.env.example`, live-vs-mock logging, and `supabase:check` script.
  `tsc`/`lint` results recorded in `docs/features/db-live-reads/verification.md`.
