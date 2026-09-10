# Verification — harness-pilot

Date: 2026-09-10 · Branch `agent/agent-os-v0.2` · Verified at `d4ec397`

## Round 1 — VERDICT: FAIL (1 of 9 criteria)

Run by an independent fresh-context verifier that read the spec and the repository, never the
builders' summaries.

### Level 0 — deterministic
```
$ npx tsc --noEmit
(no output)  EXIT: 0

$ npm run lint
> mobile@1.0.0 lint
> expo lint
env: load .env
env: export EXPO_PUBLIC_SUPABASE_URL EXPO_PUBLIC_SUPABASE_ANON_KEY
(zero eslint output lines)  EXIT: 0
```

### Guard regression suite
```
$ python3 .claude/hooks/tests/test_guards.py
22/22 guard cases passed
7 product-language cases checked
EXIT: 0
```

### Results
| Criterion | Result | Evidence |
|---|---|---|
| A1 unused import removed | **PASS** | diff shows only the one deleted import line |
| A2 lint 0 errors 0 warnings | **PASS** | verbatim output above |
| A3 tsc passes | **PASS** | exit 0, no output |
| A4 Journey Shield renders | **FAIL** | see below |
| B1 StopCard testID | **PASS** | `StopCard.tsx:24` |
| B2 bookmark testID | **PASS** | `StopCard.tsx:31` |
| B3 detail bookmark testID | **PASS** | `app/stop/[id].tsx:84` |
| B4 no visual change | **PASS** | diff is exactly 2 added `testID` props; Explore screenshot renders normally |
| B5 tsc + lint | **PASS** | same runs as A2/A3 |

### Product-language scan
`git diff 02611a1..HEAD` — no violations in any `.tsx`. The only matches were STATUS.md prose
describing a *previously fixed* violation, and ordinary English in the orchestration docs
("the safe split in this repo").

### The failure
**A4 as originally written was wrong, and the spec was at fault — not the code.**

The spec said the Journey Shield card renders on the **Safety** tab. It does not.
`app/(tabs)/safety.tsx` is a "Safety tools coming soon" placeholder; `JourneyShield` is rendered
only from `app/(tabs)/index.tsx:152` — the **Explore** tab. Neither builder touched either tab
screen, so this was a pre-existing spec inaccuracy, not a regression.

The verifier established this by deep-linking to `/--/safety`, screenshotting, and reading the
screen — then confirming with `grep`. **A Level 0 run would have passed this change and never
noticed.** That is precisely why UI work requires Level 2.

### Lead's reaction
The failing criterion was a spec defect, so routing it back to a builder would have been wrong —
there was nothing to fix in the code. The Lead independently confirmed the finding
(`grep` + reading the Safety screenshot), corrected A4 in `spec.md` with a note recording why,
and dispatched a targeted re-verification of that single criterion.

## Round 2 — re-verification of corrected A4

**VERDICT: PASS.** Re-verified after the spec correction; no source code changed between rounds.

| Criterion | Result | Evidence |
|---|---|---|
| A4 (corrected) Explore tab renders Journey Shield | **PASS** | Screenshot `/tmp/herstop-a4.png`: **Explore** highlighted in the tab bar; card shows "JOURNEY SHIELD" label, "Active Monitoring" title, and a rendered toggle in the on position. |

Bundle freshness was established, not assumed: `iOS Bundled 912ms ... (1426 modules)` followed by
`[getStops] LIVE Supabase: 6 rows`. Preflight confirmed port 8081 was refused before the run;
the server was torn down after and the port confirmed refused again.

Notably, the verifier caught its **own** first screenshot coming from a stale cached Expo Go
session and discarded it as evidence rather than reporting it — the discipline the `ios-verify`
skill asks for, applied without being reminded.

**Final: 9 of 9 acceptance criteria PASS** (A1–A4, B1–B5).

## Orchestration criteria — what the pilot was really testing

| # | Criterion | Result |
|---|---|---|
| 1 | Lead creates dependency-aware tasks | **PASS** — intent/spec/plan + ownership table |
| 2 | Lead autonomously dispatches real project subagents | **PASS** — 2 builders + 2 verifier runs, no founder involvement |
| 3 | Subagents execute in their own contexts | **PASS** |
| 4 | Worktree isolation works under concurrency | **PASS** — separate worktrees, both merged `--no-ff` with no conflict |
| 5 | Results return to the Lead with no copy/paste | **PASS** |
| 6 | Lead dispatches an independent verifier | **PASS** — fresh context, read-only, read the spec not the summaries |
| 7 | Verifier returns PASS/FAIL | **PASS** — returned a real FAIL, with evidence |
| 8 | Lead reacts correctly | **PASS** — confirmed the finding independently, identified it as a *spec* defect rather than blindly routing it to a builder, fixed the spec, re-verified |
| 9 | Hooks and tests actually execute | **PASS** — guards blocked the Lead's own commands live; 29-case suite ran in both rounds |

Not demonstrated: the **Agent Teams** pilot. Teams require an interactive session and the
harness was built in a non-interactive one. See `docs/agent-os/AGENT_TEAMS.md`.

## Environment findings worth keeping
- `npx expo start --ios` prompts to upgrade Expo Go in the simulator and **hard-fails under
  `CI=1`** with `CommandError: Input is required...`. Use `npx expo start --localhost` and deep-link.
- No `idb` / `applesimutils`, and AppleScript lacks Accessibility permission → **scripted taps
  are not possible**. Navigate with
  `xcrun simctl openurl booted "exp://127.0.0.1:8081/--/<path>"`.
- Confirm a live bundle of the current branch via `[getStops] LIVE Supabase: 6 rows` in the dev
  server log, not just by the fact that a server is up.
- A stale `expo start` from an abandoned worktree was found holding port 8081 before this run.
  It would have served the wrong branch's code while every screenshot looked plausible.

All of these are now recorded in `.claude/skills/ios-verify/SKILL.md`.
