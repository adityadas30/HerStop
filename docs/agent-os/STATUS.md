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
- **Auth:** email OTP sign-in **VERIFIED working end-to-end** (2026-09-08). A real OTP round trip
  succeeded against the live Supabase project: `signInWithOtp` → real email delivered → 6-digit
  code entered → `verifyOtp` accepted it → real session (`access_token`/`refresh_token`/confirmed
  user) issued. Root-caused and fixed a real blocker along the way: the Supabase project's
  "Confirm sign up" and "Magic link or OTP" email templates only contained `{{ .ConfirmationURL }}`,
  not `{{ .Token }}` — a first-time OTP request uses the *signup* template, not the *magic link*
  one, so both needed the token block added (founder-approved dashboard edit). Independent
  qa-verifier review also caught and fixed a real bug: sign-out didn't reset `profile.tsx`'s local
  step/email/code state (expo-router keeps tab screens mounted), so a stale "enter the code" card
  could show after sign-out instead of the guest form — fixed in commit `31aee37`. See
  `docs/features/auth-otp/verification.md` for full evidence and remaining gaps (interactive
  Simulator tap-through and live refresh/sign-out calls with a fresh token were blocked by
  environment/rate-limit constraints, not implementation issues).
- **Schema:** no new tables. `profiles`/`saved_stops`/`reviews` remain proposed-only
  (`docs/migrations/002_auth_tables.sql`), not applied.
- **Branch:** `main` (protected) + `dev` (integration) + `agent/*` worktrees
  (`db-foundation`, `auth-otp-foundation`, `qa-baseline`, `auth-foundation`).
- **Tests:** none (no Jest/Maestro). Deterministic checks = `tsc` + `lint`.
- **Checks (2026-09-06, auth-otp-foundation):** `tsc` ✅ · `lint` ✅ (0 errors — the pre-existing
  `profile.tsx` apostrophe error is fixed by this task's rewrite; 1 unrelated pre-existing warning
  remains in `JourneyShield.tsx`) · `supabase:check` ✅ LIVE (6 rows, unaffected by the auth changes).

## Immediate priorities
1. Founder: interactively tap through the OTP flow on-device once (Simulator or physical iPhone)
   to confirm the UI itself, not just the API — this session verified the real Supabase round trip
   via direct API calls but could not drive Simulator taps (session/tooling restriction).
2. Founder: review `docs/migrations/002_auth_tables.sql` (reviewed this session — **safe, correct,
   ready to prepare as-is**, no blocking issues) and run it in the Supabase SQL Editor when ready.
3. Founder: merge `agent/auth-otp-foundation` into `dev`/`main` when ready — not done automatically
   per workflow rules (requires human approval).
4. After both → saved-stops persistence, then reviews (both now unblocked by real, verified auth).

## Log
- **2026-09-08** — `auth-otp-foundation` verification session: sent a real OTP to the founder's own
  inbox via the live Supabase Auth REST API, founder read back the 6-digit code, `verifyOtp`
  succeeded and issued a real session — genuine round-trip proof, not just code inspection. Found
  and fixed the actual blocker (email templates missing `{{ .Token }}` — both "Confirm sign up" and
  "Magic link or OTP", founder-approved dashboard edit). Confirmed invalid/expired-code handling
  returns a structured error (not a crash) and that OTP codes are single-use. Confirmed the app
  builds and runs correctly on a real booted iOS Simulator (iPhone 17 Pro, iOS 26.4) via
  `expo start --ios --offline`, with console logs confirming Supabase config and auth-state
  hydration — but could not interactively tap through the UI in this session (Simulator control
  tooling requires an approval dialog unavailable in this session type; tried three independent
  paths, all blocked). Independent qa-verifier agent re-ran `tsc`/`lint`/`supabase:check` (all
  pass) and found one real bug (sign-out not resetting local UI state) — fixed in commit `31aee37`.
  Separately reviewed `docs/migrations/002_auth_tables.sql`: safe/correct, ready to prepare, no
  blocking issues (two non-blocking notes: no unique constraint on `reviews(user_id, stop_id)`,
  and `saved_stops(stop_id)` has no index — neither needed for MVP). Not pushed/merged; still on
  `agent/auth-otp-foundation`, 2 commits ahead of `agent/agent-os-v0.1`.
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
