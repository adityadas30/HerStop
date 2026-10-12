# Audit: t1–t10 evidence (2026-10-12)

_Written by Juniper (t13) from `git show <sha>` of each task commit plus a fresh gate re-run at
HEAD `f872119` (`astra/full-development`). Nothing in this file is Live-verified, and nothing was
run against the live Supabase project. No migrations applied, no accounts deleted._

## Bottom line
- **Every gate that can run offline passes today.** Nothing is Simulator-verified or Live-verified.
- **The "18/22 guard failure" (t5) is real but is a test-harness path bug, not a guard bug.**
- **The "missing react-native-maps types" (t6) is refuted** at a clean install.
- The live DB is still 001 + 002 only (6 fictional stops). 003/005/006/007 are unapplied. Every
  review, report, delete-account and "44 real stops" claim is therefore unverified live.

## Evidence levels
| Level | Meaning |
|---|---|
| Implemented | Code/SQL exists and merged; at most compiled. |
| Static | tsc / lint / unit tests / `expo export` pass. No app run. |
| Simulator | Seen running in the iOS Simulator. |
| Live | Exercised against the real Supabase project with the migration applied. |
| Blocked | Cannot progress without a founder action. |

## A. Gate re-run at HEAD (all from `apps/mobile/`, clean `npm ci`)

| Gate | Result today | Notes |
|---|---|---|
| `npm ci` | **pass**, 1094 packages | Needed nvm node v24.14.1 (see environment note). `npm audit` reports 77 vulnerabilities (1 low, 17 moderate, 57 high, 2 critical): not triaged, none is an app-code finding. |
| `npx tsc --noEmit` | **pass**, exit 0, no output | |
| `npm run lint` (`expo lint`) | **pass**, exit 0, no output | |
| `npm test` (jest) | **pass**, 4 suites, **46/46** tests | scoring, directions, location, monitoring. Matches t9's 46. t8 originally reported 37 (before t9's 9). |
| `npx expo export --platform ios` | **pass**, exit 0 | 1 iOS bundle (`.hbc`, 5.7 MB). Git tree left clean (`dist/` ignored). |
| `test_guards.py`, `CLAUDE_PROJECT_DIR=<worktree>` | **18/22 guard cases; product-language 7/7 checked** | 4 FAIL, see below. |
| `test_guards.py`, `CLAUDE_PROJECT_DIR=/Users/adityadas/herstop` | **22/22 guard cases** | Same file, same hooks. |

### t5's guard failure (18/22): confirmed, root cause identified
- **Reproduced exactly:** the same 4 cases fail (privileged key in code, real JWT in tracked file,
  RLS turned off, open policy on user data).
- **Cause:** `.claude/hooks/tests/test_guards.py` hard-codes `HOOKS = "/Users/adityadas/herstop/.claude/hooks"`
  and `REPO = "/Users/adityadas/herstop"`. `guard-write.py` only applies content rules to files
  under `CLAUDE_PROJECT_DIR` (`in_repo` check, lines 21–25). In any worktree, `CLAUDE_PROJECT_DIR`
  is the worktree, so the test's `REPO` paths count as "outside the project", the content is blanked
  and the guard passes through. It also means a worktree run exercises the **main checkout's**
  hooks, not the worktree's.
- **Not a regression:** t5's diff touched no `.claude` files. Re-running with
  `CLAUDE_PROJECT_DIR=/Users/adityadas/herstop` gives **22/22**.
- **Implication:** "guards pass" in the t2/t3/t4/t6/t7/t8/t9 commit bodies is only meaningful if they
  ran with the right env var, or in the main checkout; from a plain worktree it is 18/22.
  Those four cases are the ones that matter most (secrets, RLS), so a worktree run is not evidence
  for them. **Follow-up (not done here, out of scope: docs only):** make the test derive
  `REPO`/`HOOKS` from `__file__`, and set `CLAUDE_PROJECT_DIR` to match.
- Note: the file's header says "29 cases" in STATUS.md; the script today has 22 guard + 7
  product-language cases (29 total), so that figure is consistent.

### t6's missing react-native-maps types: refuted
t6 saw a TS error on `components/StopsMap.tsx` because it used a symlinked `node_modules` from the
main checkout that predated t5's `react-native-maps` install. With a fresh `npm ci` from the
lockfile, `react-native-maps@1.20.1` is present with its own `.d.ts` files and `tsc --noEmit` is
clean. No code change needed.

### Environment note
`/opt/homebrew/bin/node` (25.6.0) is currently broken on this machine: it aborts at startup with
`dyld: Library not loaded: libsimdjson.29.dylib` (Homebrew has simdjson 4.2.4 and 5.0.4 installed,
the node binary wants `.29`). All gates above were run with `~/.nvm/versions/node/v24.14.1/bin`
first in `PATH`. The fix is `brew reinstall node` (or `brew upgrade`), a founder-machine
change that I did not make. Anyone running `npm`/`npx` from a fresh shell on this machine will hit it.

## B. Per-task audit

"Claimed" = the checks listed in the commit body. "Re-run today" = section A.
Commit shas are the t-commits; each is merged into `astra/full-development`.

| Task | Shipped (commit) | Evidence level | Gates claimed → re-run today | Failed / unrun gates | Remaining blockers |
|---|---|---|---|---|---|
| **t1** migration audit + runbook | `0b0e3fc`: APPLY_RUNBOOK, 004 marked DO-NOT-RUN, STATUS baseline. No SQL logic changed. | **Implemented** (docs; counts derived from SQL and `rls-check.mjs`) | No gate claimed in body. Runbook counts not re-derived by running anything. | Nothing was executed against a DB. Counts (44 stops, 12/12 → 13/13) are unverified. §0/§4 were stale (fixed in t13). | Founder must apply 003→005→006→007. |
| **t2** account deletion | `ca2d01e`: `007_delete_my_account.sql` (SECURITY DEFINER RPC), `lib/account.ts`, Profile "Delete account" UI, `destructive` Button, rls-check assertion 13. | **Static** (Blocked for Live) | tsc, lint, guards, export → **tsc / lint / export pass today**; guards pass only with correct `CLAUDE_PROJECT_DIR` (see above). | Simulator not run. Live RPC never run (007 unapplied, project was paused). **No unit test yet** for `lib/account.ts` (t12 Wren pending). The postgres-role-can-delete-from-`auth.users` assumption is unverified. | Apply 007; verify delete on a throwaway account; security review noted "APPROVE WITH NOTE". |
| **t3** directions | `eca0068`: `lib/directions.ts`, Directions button on stop detail, removed 3 dead Explore header buttons. | **Static** | tsc, lint, guards, export → pass today. Plus `directions.test.ts` (t8) now covers URL building. | Not seen in Simulator; "Apple Maps opens" never confirmed. | Tap Directions on a device/Simulator. |
| **t4** privacy / support / safety | `793a22b`: `/legal/{privacy,support,safety-disclosure}`, About card in Profile, `docs/release/privacy-policy.md`. | **Static** | tsc, lint, guards (7 language cases), export → pass today. | Not seen in Simulator (Xcode licence was blocking then). `SUPPORT_EMAIL` is still `SUPPORT_EMAIL_PLACEHOLDER` and renders on screen. Policy describes 003 review behaviour and account deletion, neither live. | Real support email; hosted privacy/support URLs; 003 + 007 applied before the policy is true. |
| **t5** Explore map | `ed29c4d`: `components/StopsMap.tsx`, List/Map toggle, `react-native-maps@1.20.1` (Apple provider). | **Static** | tsc, lint, export → pass today. Guards reported **18/22** → **reproduced 18/22; 22/22 with correct env** (harness path bug). | Map render, marker callout, user dot never seen. | Simulator/device pass. |
| **t6** no fabricated stops in release | `060963f`: `getStops()`/`getStopById()` result shapes, `MOCK_STOPS` only under `__DEV__`, Explore loading/error/empty/permission states, stop-detail not-found/error. | **Static** | tsc, lint (with "one pre-existing error", react-native-maps types), guards, export → **all pass today at a clean install** (error refuted). | **Release-vs-dev behaviour never run.** Error + Retry state never seen. **No unit tests for `lib/api.ts`** (t12 Wren pending). | Run a release-config build with Supabase env unset to see the error state; Simulator pass of each state. |
| **t7** release readiness | `d165f97`: `eas.json` preview/production profiles, iOS privacy manifest in `app.json`, `docs/release/app-store-privacy.md`, `testflight.md`. | **Implemented** | Only "guard suite re-run: passes" claimed. → guards 18/22 vs 22/22 as above; tsc/lint/export pass. | **No EAS build ever run.** No `projectId` in `app.json`. Privacy manifest never validated by a build/App Store Connect. | Apple Developer + App Store Connect, `eas init`, `eas env:create`, first preview build. |
| **t8** Jest + unit tests | `59bb5e6`: jest-expo, tests for scoring, directions, distance. | **Static** (this is a real, run, passing test suite) | `npm test` 37/37 → **46/46 today** (t9 added 9). tsc/lint pass. | Only pure `lib` code is covered. No tests for `api.ts`, `account.ts`, `auth`, or any screen. | t12 (Wren) in progress. |
| **t9** Sentry | `85bc30a`: `lib/monitoring.ts` DSN-gated + scrubbers, ErrorBoundary in `_layout.tsx`, `.env.example`, testflight docs. | **Static** | tsc, lint, 46 tests, export, `expo config` → pass today. | No DSN, so **no event was ever sent**; ErrorBoundary fallback never seen; export warns about missing sentry org/project (expected, upload OFF). | Founder creates a Sentry project + DSN (optional) and source-map upload setup. |
| **t10** Simulator verification | **pending**: branch `agentcraft/kit/t10-t10-simulator` has no commits; no `docs/verification/t10-simulator/REPORT.md` has merged. Re-issued as board task t11 (Kit). | **pending** | n/a | n/a | Result of t11 (Kit). Update this row when it lands. |

### What is NOT covered by any task above
- **t12 (Wren)** unit tests for `lib/api.ts` and `lib/account.ts`: in progress, not merged. Pending.
- No Maestro run exists for any t1–t9 change.
- No screen-level evidence at all: the Simulator is exercised only by t11.

## C. Open blockers (all founder-gated), in order
1. Apply 003 → 005 → 006 → 007 to the live DB (see `docs/release/FOUNDER_CHECKLIST.md`). Live
   `saved_stops` has 2 rows that 006 may cascade-delete: founder decides.
2. Apple Developer Program + App Store Connect record.
3. `eas init` (no `projectId`), EAS env vars (URL, anon key, optional Sentry DSN).
4. Resend SMTP (the built-in mailer is limited to 2 emails/hour on this project per
   `docs/features/auth-otp/verification.md`; outside testers cannot sign in reliably).
5. Real `SUPPORT_EMAIL` + hosted privacy/support URLs.
6. Fix the guard test's hard-coded paths (small repo change, not done in this docs-only task) and
   `brew reinstall node` on the dev machine.
