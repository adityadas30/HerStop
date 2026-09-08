# STATUS

> One-line-per-session log. Newest on top. Keep it scannable from a phone.

## Snapshot
- **Phase:** early — UI shell + typed data layer; live Supabase reads confirmed; email OTP sign-in
  verified end-to-end; `saved_stops` persistence in progress (Task 2 of the auth → saved-stops →
  reviews dependency chain).
- **Backend:** Supabase client wired; **live reads CONFIRMED** (re-verified repeatedly, with a real
  `.env` present) — `stops` returns 6 rows incl. the `Willow Creek Plaza TEST` marker. `.env` is
  gitignored/per-machine, so a fresh clone/worktree needs its own copy. See
  `docs/features/db-live-reads/` for the original NXDOMAIN diagnosis (since fixed at the project
  level, no app code change needed). RLS confirmed to reject anon writes to `stops` (`42501`), not
  just allow anon reads.
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
- **Schema proposal:** `docs/migrations/002_auth_tables.sql` — `profiles`, `saved_stops`, `reviews`
  with RLS scoped to `auth.uid()`. Reviewed (2026-09-08) as safe/correct, ready to run. **Not
  applied yet** — needs founder review + manual run in the Supabase SQL Editor.
- **Product-language fix:** `app/(tabs)/index.tsx`'s Explore subtitle said "Verified safe stops
  within 5 miles" — a direct violation of `.claude/rules/product-boundaries.md`. Fixed to
  "Better-reviewed stops within 5 miles" (found by an independent `qa-baseline` session,
  2026-09-06; folded into this branch's base — see "Branch consolidation note" below).
- **Fixed (2026-09-08, `saved-stops-persistence`):** the Saved tab used to filter the hardcoded
  `MOCK_STOPS` array, so a stop loaded live from Supabase could be saved but never appeared in the
  Saved tab. `contexts/saved-stops.tsx` now derives the list from the `getStops()` catalog (live,
  with mock fallback) and no longer imports `MOCK_STOPS` at all.
- **Saved stops:** client-side persistence implemented against `saved_stops` (load on sign-in,
  clear on sign-out, optimistic write with rollback). **Inert until the migration is applied** —
  `GET /rest/v1/saved_stops` currently returns `PGRST205` (table not in the schema cache), so a
  signed-in save fails and rolls back by design. See
  `docs/features/saved-stops-persistence/verification.md`.
- **Branch:** `main` (protected). **`origin/dev` has diverged and should not be built on as-is** —
  see "Branch consolidation note" below; this is a real repo-hygiene issue, not resolved here.
  `agent/*` worktrees: `db-foundation`, `auth-otp-foundation`, `qa-baseline`, `auth-foundation`,
  `saved-stops-persistence`.
- **Tests:** none (no Jest/Maestro). Deterministic checks = `tsc` + `lint`.
- **Checks (2026-09-06/08, pre-saved-stops):** `tsc` ✅ · `lint` ✅ (0 errors — the pre-existing
  `profile.tsx` apostrophe error was fixed by `auth-otp-foundation`; 1 unrelated pre-existing
  warning remains in `JourneyShield.tsx`) · `supabase:check` ✅ LIVE (6 rows) ·
  `expo export --platform ios` ✅ bundles clean (1349 modules, per `qa-baseline`).

## Branch consolidation note (2026-09-08, saved-stops-persistence)
`agent/saved-stops-persistence` was supposed to branch off "latest `dev`" per this task's
instructions. **`origin/dev` (tip `89c9237`/`b183edb`, "Configure Agent OS harness…") has diverged
from every other branch's real work** — its merge-base with `main`/the harness lineage is `10c156f`
("homepage aesthetic asf"), a point *before* the Supabase client was even added (`64a4e64`). Its own
"Agent OS harness" commit creates only 4 **empty** placeholder files
(`docs/agent-os/{AGENTS,DECISIONS,STATUS,TASK_BOARD}.md`, 0 bytes each) — none of the real
CLAUDE.md/`.claude/rules/`/Supabase client/auth work exists on it. Branching literally off it would
make this task's own goal 1 ("confirm auth foundation exists and `useAuth()` is available")
impossible to satisfy.

Built this branch instead on a consolidated local base: `agent/auth-otp-foundation` (harness +
verified OTP auth) merged with `agent/db-foundation` (schema proposal + architecture docs) merged
with `agent/qa-baseline` (the "Verified safe" copy fix above). All three are real, non-conflicting
work sitting on the same harness commit (`6778126`) that `origin/dev` is missing entirely. Only
`STATUS.md`/`TASK_BOARD.md` conflicted (resolved by hand, both branches' content preserved above);
no app code conflicted.

**This does not fix `origin/dev`** — that's a repo-hygiene decision for the founder (likely:
fast-forward or reset `origin/dev` to the real lineage, or formally merge these branches into it).
Flagging clearly rather than quietly rewriting a shared branch.

## Immediate priorities
1. **Founder: `origin/dev` needs attention** — see the consolidation note above. Until it's fixed,
   any future `agent/*` branch cut "from dev" will hit the same problem.
2. Founder: interactively tap through the OTP flow on-device once (Simulator or physical iPhone) to
   confirm the UI itself, not just the API — verified via direct API calls, not Simulator taps.
3. Founder: review `docs/migrations/002_auth_tables.sql` (reviewed 2026-09-08 — safe, correct,
   ready to run) and run it in the Supabase SQL Editor when ready — needed before `saved_stops`
   persistence (in progress) can be exercised against a real signed-in user.
4. Founder: merge the reviewed `agent/*` branches into a corrected `dev`, then `main`, when ready —
   not done automatically per workflow rules (requires human approval).

## Log
- **2026-09-08** — `saved-stops-persistence`: implemented. `lib/api.ts` `getSavedStops` /
  `toggleSaveStop` are real (anon key, RLS-scoped, `__DEV__` LIVE/MOCK logging); the context reads
  auth state, loads on sign-in, clears on sign-out, and derives the list from live stop data
  instead of `MOCK_STOPS`; the Saved tab invites sign-in without blocking browsing; a guest tapping
  save on stop detail is routed to the OTP flow and the save completes on return. Sign-out-mid-
  request, double-tap, offline-rollback and deleted-stop cases are handled explicitly. `tsc` ✅ ·
  `lint` ✅ (no new problems) · `supabase:check` ✅ LIVE (6 rows). **Blocked from live verification:**
  `saved_stops` does not exist in the project yet (`PGRST205`) — founder must run
  `docs/migrations/002_auth_tables.sql`. See `docs/features/saved-stops-persistence/`.
- **2026-09-08** — `saved-stops-persistence`: started. Found `origin/dev` diverged (see
  consolidation note above); built the branch on a merged local base instead of raw `dev`, folding
  in `db-foundation`, `auth-otp-foundation`, and `qa-baseline`'s product-language fix. Implementation
  in progress — see `docs/features/saved-stops-persistence/` once complete.
- **2026-09-06** — `qa-baseline`: fresh-context QA pass. Confirmed live reads (contradicting the
  stale "NXDOMAIN" note at the time), `tsc`/lint baseline. Found and fixed a real product-language
  violation: Explore screen said "Verified safe stops within 5 miles" — changed to "Better-reviewed
  stops within 5 miles". See `docs/features/qa-baseline/verification.md`.
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
- **2026-09-08** — Independent fresh-context verifier attempted to verify `saved-stops-persistence`
  before it existed: confirmed with the founder that the branch/feature hadn't been built yet
  (correctly left the task board entry as "blocked," not "in review," and changed nothing). Now
  superseded — the branch exists and this session is implementing it.
- **2026-09-06** — `qa-baseline`: fresh-context QA pass. Confirmed live reads (contradicting the
  stale "NXDOMAIN" note at the time), `tsc`/lint baseline, `expo export --platform ios` bundles
  clean. Fixed one product-language violation ("Verified safe stops..." → "Better-reviewed
  stops..." in the Explore subtitle) and found the `MOCK_STOPS`-in-Saved-tab bug (both folded into
  this branch's base above). Full detail in `docs/features/qa-baseline/verification.md`.
- **2026-09-06** — Built Agent OS v0.1 harness (agents, rules, agent-os docs, feature template,
  reorganized docs). Validated with `db-live-reads`: pinned live-read blocker to NXDOMAIN on the
  Supabase project host; added `.env.example`, live-vs-mock logging, and `supabase:check` script.
  `tsc`/`lint` results recorded in `docs/features/db-live-reads/verification.md`.
