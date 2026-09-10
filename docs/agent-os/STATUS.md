# STATUS

> One-line-per-session log. Newest on top. Keep it scannable from a phone.

## Snapshot
- **Harness:** Agent OS **v0.2** (2026-09-10) — one **HerStop Lead** session dispatches
  worktree-isolated builders (`mobile-builder`, `db-engineer`) and read-only
  `mobile-verifier` / `code-reviewer` / `security-reviewer` / `repo-scout`. Deterministic
  guards in `.claude/hooks/` block secrets, destructive/production DB operations, RLS
  weakening, pushes to `main`, production deploys, and safety-claim copy. Guard regression
  suite: `python3 .claude/hooks/tests/test_guards.py` (29 cases). Agent Teams enabled in
  settings but **requires an interactive session** — see `AGENT_TEAMS.md`.
- **Phase:** early — UI shell + typed data layer; live Supabase reads confirmed; email OTP sign-in
  verified end-to-end against the live API; `saved_stops` persistence implemented and merged,
  now in live verification.
- **Sprint (2026-09-10 → ~09-17):** ship sprint toward a TestFlight-ready MVP. Product work only;
  no harness work unless a real product failure demands it.
- **Migration 002 APPLIED (2026-09-10)** by the founder. `rls:check` 5/5 (independently re-run by
  the Lead). `profiles` / `saved_stops` / `reviews` exist with RLS. The saved-stops blocker is cleared.
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
  with RLS scoped to `auth.uid()`. Reviewed (2026-09-08) as safe/correct, ready to run; final
  read-only re-review (Lead, 2026-09-10) found no blockers and confirmed the file is byte-identical
  to the reviewed version. **Applied by the founder 2026-09-10; `rls:check` 5/5.**
  Verified (2026-09-08, `db-auth-tables-verify`): `stops.id` is `text` (matches the migration's
  `stop_id text` — no correction needed); fixed a real idempotency gap (added `drop policy if
  exists` before every `create policy`, since Postgres has no `create policy if not exists` — a
  second run would previously have errored partway through). Added `npm run rls:check`
  (`apps/mobile/scripts/rls-check.mjs`) — read-only, anon-key RLS assertions for all three tables,
  runs cleanly (reports FAIL, doesn't crash) both before and after the migration is applied. Apply
  + rollback SQL in `docs/features/auth-tables/verification.md`.
- **Product-language fix:** `app/(tabs)/index.tsx`'s Explore subtitle said "Verified safe stops
  within 5 miles" — a direct violation of `.claude/rules/product-boundaries.md`. Fixed to
  "Better-reviewed stops within 5 miles" (found by an independent `qa-baseline` session,
  2026-09-06; folded into this branch's base — see "Branch consolidation note" below).
- **Fixed (2026-09-08, `saved-stops-persistence`):** the Saved tab used to filter the hardcoded
  `MOCK_STOPS` array, so a stop loaded live from Supabase could be saved but never appeared in the
  Saved tab. `contexts/saved-stops.tsx` now derives the list from the `getStops()` catalog (live,
  with mock fallback) and no longer imports `MOCK_STOPS` at all.
- **Saved stops:** client-side persistence implemented against `saved_stops` (load on sign-in,
  clear on sign-out, optimistic write with rollback). The table now exists (migration 002 applied
  2026-09-10); live signed-in verification in progress. See
  `docs/features/saved-stops-persistence/verification.md`.
- **Branches (2026-09-10):** integration branch is `agent/agent-os-v0.2` — every earlier
  `agent/*` branch is merged into it; ahead of both `dev` and `main`. **Pushed to
  `origin/agent/agent-os-v0.2` as a backup** (2026-09-10) — not merged anywhere. `origin/dev` = local `dev` = `60749f0` and is **healthy** — the
  divergence in the consolidation note below was resolved by a merge. `main` (protected) is at
  `ef220cf` — GitHub PR #1 merged `agent/agent-os-v0.1` into it (2026-09-10); still behind this branch. Worktrees: only `herstop-worktrees/dev` remains; the 8 finished task worktrees were
  removed 2026-09-10 (their branches are kept).
- **Tests:** none (no Jest/Maestro). Deterministic checks = `tsc` + `lint`.
- **Checks:** last full run 2026-09-10 (v0.2 pilot): `tsc` ✅ · `lint` ✅ 0 errors 0 warnings ·
  guard suite ✅ 29/29 · Level 2 Simulator ✅. Re-run 2026-09-10 (maintenance): `supabase:check` ✅
  LIVE (6 rows) · `rls:check` 2/5 (expected before the migration). Earlier:
  `expo export --platform ios` ✅ bundles clean (1349 modules, `qa-baseline`, 2026-09-06).

## Branch consolidation note (2026-09-08, saved-stops-persistence) — RESOLVED
> **Resolved as of 2026-09-10:** `origin/dev` was repaired by a merge — `origin/dev` = local `dev`
> = `60749f0`, and the old tip `89c9237` is now its ancestor. Kept below as history; do not act on it.

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
1. ~~Founder: run `002_auth_tables.sql`~~ — done 2026-09-10, `rls:check` 5/5.
2. Lead: saved-stops live verification (guest + signed-in), then reviews → scoring → ranking,
   after an MVP MUST/SHOULD/CUT scope pass.
3. Founder: tap through the OTP sign-in flow once on a Simulator or iPhone — verified via the live
   API, never via the UI.
4. Founder: decide when to integrate `agent/agent-os-v0.2` into `dev` → `main` (requires
   approval; the branch is backed up on origin but not merged).

## Log
- **2026-09-10** — **Ship sprint start.** Founder applied migration 002; Lead re-ran `rls:check`
  5/5. `mobile-verifier` (fresh context) on saved stops: tsc ✅ lint ✅ supabase:check ✅
  rls:check ✅ `expo export ios` ✅; guest browsing / guest Saved invitation ✅ (screenshots);
  signed-in criteria **BLOCKED** (no scripted taps + OTP needs a human). Found a real defect:
  cold launch treats a signed-in user as a guest until the session restores (Saved flashes the
  sign-in card; a bookmark tap routes to Profile) → fix dispatched. MVP scope scout found seeded
  `stops.rating`/`review_count`/`badge` shown as real (fabrication), a false "within 5 miles"
  claim, placeholder Safety/Journeys tabs, no bundle id / `eas.json`. Wrote
  `docs/features/community-reviews/` spec; found that 002's public `reviews` read policy exposes
  reviewer `user_id` + stop + time of visit → migration 003 (privacy + report/block) in progress.
  Confirmed Supabase's default email sender only delivers to project team members → custom SMTP
  is a beta blocker.
- **2026-09-10** — **Maintenance (Lead, pre-migration).** Confirmed with `git ls-remote` that
  `origin/dev` is healthy (= local `dev` = `60749f0`, old divergent tip merged in); marked the
  consolidation note resolved. Removed 8 finished worktrees (`auth-foundation`,
  `auth-otp-foundation`, `db-auth-tables-verify`, `db-foundation`, `harness-pilot-a`,
  `harness-pilot-taskB`, `qa-baseline`, `saved-stops-persistence`) after confirming each was merged
  into `agent/agent-os-v0.2`, had no tracked or untracked changes, and held only disposable ignored
  files (`node_modules`, `.expo/`, `.env` copies whose values match the main checkout's). All
  branches kept; the `dev` worktree kept. Rewrote `docs/architecture/current-state.md`, which still
  described auth and saved stops as unbuilt. Final read-only review of `002_auth_tables.sql`: no
  blockers, recommend RUN. No app code or database changes. Pushed `agent/agent-os-v0.2` to
  origin as a backup branch at the founder's request — nothing merged.
- **2026-09-10** — **Agent OS v0.2.** Replaced the manual multi-session model (separate Desktop
  chats named Orchestrator / DB Agent / Mobile Builder / QA, which could not actually
  communicate) with one **HerStop Lead** session that dispatches project subagents. New roster:
  worktree-isolated `mobile-builder` + `db-engineer`; read-only `mobile-verifier`,
  `code-reviewer`, `security-reviewer`, `repo-scout`. Deterministic guards added in
  `.claude/hooks/` with a 29-case regression suite. Skills: `herstop-orchestration`,
  `ios-verify`. Maestro flows staged (Maestro still not installed). Agent Teams enabled in
  settings; the team pilot still needs an **interactive** session.
  **Pilot (`docs/features/harness-pilot/`) passed 9/9** after one real round trip: two builders
  ran concurrently in separate worktrees and merged clean; the fresh verifier returned FAIL on a
  criterion that `tsc` and `lint` both passed — the spec wrongly claimed Journey Shield renders
  on the Safety tab (it renders on Explore). The Lead confirmed it independently, fixed the
  *spec* rather than the code, and re-verified to PASS.
  Three real bugs found by using the harness: the Stop-time quality gate never fired
  (a `**` git pathspec silently matched nothing); `node_modules/` in `apps/mobile/.gitignore`
  didn't match the worktree bootstrap's symlink; and a **stale `expo start` from an abandoned
  worktree** was serving another branch's code to the Simulator.
  Checks: `tsc` ✅ · `lint` ✅ 0 errors 0 warnings (last warning cleared by the pilot) ·
  guard suite ✅ 29/29 · Level 2 Simulator ✅ with screenshots.
- **2026-09-08** — `db-auth-tables-verify`: verified `stops.id` is `text` (3 read-only probes,
  ruling out both `uuid` and `integer`/`bigint`) — the migration already matched, no correction
  needed. Found and fixed a real idempotency gap in `002_auth_tables.sql` (11 `create policy`
  statements had no guard; added `drop policy if exists` before each). Added
  `apps/mobile/scripts/rls-check.mjs` (`npm run rls:check`), a read-only anon-key RLS verifier for
  `profiles`/`saved_stops`/`reviews`; ran clean against the pre-migration DB (2/5 pass, 3 correctly
  report "table doesn't exist", exit 1, no crash). Wrote apply + rollback SQL in
  `docs/features/auth-tables/verification.md`. No SQL executed against the live DB; no
  service-role key. Branched off `agent/db-foundation` instead of raw `dev` — same divergence
  problem as `saved-stops-persistence` hit, documented rather than fixed here.
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
- **2026-09-06** — `db-foundation`: re-confirmed live Supabase reads end-to-end (closing out
  `db-live-reads`'s open blocker — the project host was fixed at the platform level, no app-side
  change needed). Confirmed via non-destructive probe that RLS also blocks anon writes to `stops`.
  Left the `Willow Creek Plaza TEST` marker row as-is (documented why — the anon key can't rename it
  anyway, and it's harmless pre-launch). Wrote `docs/migrations/002_auth_tables.sql`, a proposed
  (unexecuted) schema + RLS for `profiles`/`saved_stops`/`reviews`, all writes scoped to
  `auth.uid()`. Updated architecture docs to match. No service-role key used. `tsc`/`lint` results
  in `docs/features/db-foundation/verification.md`.
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
