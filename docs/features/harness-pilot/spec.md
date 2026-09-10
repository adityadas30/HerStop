# Spec — harness-pilot

## Why
Prove the Agent OS v0.2 orchestration works end to end before it is trusted with a real feature.
Both tasks are real, tiny, and independently useful, and they touch **disjoint files** so two
worktree-isolated builders can run at the same time.

## Task A — clear the last lint warning
`apps/mobile/components/ui/JourneyShield.tsx` imports `IconSymbol` on line 4 and never uses it.
It is the only warning `npm run lint` still reports.

**Acceptance criteria**
- A1. The unused `IconSymbol` import is gone from `JourneyShield.tsx`.
- A2. `npm run lint` reports **0 errors and 0 warnings**.
- A3. `npx tsc --noEmit` passes.
- A4. The **Explore** tab still renders the Journey Shield card (label "JOURNEY SHIELD",
  title "Active Monitoring", working switch) — unchanged visually.
  *(Corrected 2026-09-10: this criterion originally said "Safety tab". It was wrong —
  `JourneyShield` is rendered from `app/(tabs)/index.tsx:152` (Explore); `app/(tabs)/safety.tsx`
  is a "Safety tools coming soon" placeholder. The fresh verifier caught the spec error by
  looking at the actual screen, which is the point of Level 2.)*

## Task B — make E2E targets stable
The staged Maestro flows in `apps/mobile/.maestro/` match on visible text, which is brittle.
Add stable `testID`s so Level 3 has real anchors when Maestro is installed.

**Files (only these)**
- `apps/mobile/components/ui/StopCard.tsx`
- `apps/mobile/app/stop/[id].tsx`

**Acceptance criteria**
- B1. `StopCard`'s outer `TouchableOpacity` has `testID={`stop-card-${stop.id}`}`.
- B2. `StopCard`'s bookmark `TouchableOpacity` has `testID={`stop-card-bookmark-${stop.id}`}`.
- B3. The stop-detail bookmark `TouchableOpacity` (`app/stop/[id].tsx`, ~line 83) has
  `testID="stop-detail-bookmark"`.
- B4. No visual, styling, or behavioral change of any kind — `testID` additions only.
- B5. `npx tsc --noEmit` and `npm run lint` pass.

## Out of scope
Renaming anything, restyling, touching `contexts/saved-stops.tsx`, `lib/**`, or any migration.

## Non-negotiable
No copy changes. No safety-claim language anywhere near this work.

## Orchestration criteria (what the pilot itself is testing)
1. Lead creates a dependency-aware task list.
2. Lead dispatches two real project subagents autonomously.
3. Each executes in its own context and its own git worktree.
4. Concurrent edits do not collide.
5. Results return to the Lead with no founder copy/paste.
6. Lead integrates, then dispatches an independent fresh-context verifier.
7. Verifier returns PASS/FAIL/BLOCKED with evidence.
8. Lead reacts correctly to the verdict.
9. Hooks and the guard regression suite actually execute.
