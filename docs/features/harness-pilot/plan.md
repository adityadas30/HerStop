# Plan — harness-pilot

## Dependency graph
```
A (JourneyShield unused import)  ─┐
                                  ├─→ integrate ─→ verify ─→ react to verdict
B (testID anchors)               ─┘
```
A and B are independent — no ordering constraint, no shared file. Everything after integration
is strictly sequential.

## File ownership (the thing that makes concurrency safe)
| Agent | Owns | Must not touch |
|---|---|---|
| builder A (`mobile-builder`) | `apps/mobile/components/ui/JourneyShield.tsx` | StopCard, stop detail |
| builder B (`mobile-builder`) | `apps/mobile/components/ui/StopCard.tsx`, `apps/mobile/app/stop/[id].tsx` | JourneyShield |
| verifier (`mobile-verifier`) | nothing — read-only | all source |

## Execution
1. Lead commits the harness so both worktrees inherit it, and stays on the integration branch
   (worktrees branch from the Lead's HEAD).
2. Dispatch A and B **concurrently**, each with `isolation: "worktree"`, each told explicitly
   which paths it owns and which another agent holds.
3. Each builder bootstraps its worktree, implements, runs `tsc` + `lint`, commits, reports.
4. Lead merges both branches with `--no-ff`. A conflict here would mean the ownership split was
   wrong.
5. Lead dispatches the verifier with **fresh context** — it reads the spec, not the builders'
   summaries.
6. Lead reacts to the verdict: PASS → record it; FAIL → route each discrepancy back to the
   builder that owns those files, then re-verify.

## Schema / env / package impact
None. No migration, no env var, no dependency.

## Edge cases anticipated
- A fresh worktree has no `node_modules` and no local env file → `worktree-bootstrap.sh`.
- Builder B will still see A's lint warning in its own worktree (different worktree, A's fix not
  merged yet). Expected, not a failure — B's bar is 0 *errors*.
- A stale `expo start` from an old worktree can serve the wrong branch's code to the Simulator →
  verifier must preflight port 8081.

## Acceptance
The spec's A1–A4 and B1–B5, plus the nine orchestration criteria in `spec.md`.
