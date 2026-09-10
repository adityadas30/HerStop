# Rule: Testing & Verification

There is **no unit-test runner for app code** (no Jest). The one automated suite in this repo is
the harness's own guard regression suite. Do not claim tests pass when none exist. Use the
verification levels below and record results in the feature's `verification.md`.

```bash
python3 .claude/hooks/tests/test_guards.py   # from the repo root — 29 cases
```
Run it after touching anything in `.claude/hooks/`.

## Verification levels
- **Level 0 — Deterministic:** `npm install` ok; `npx tsc --noEmit` passes; `npm run lint` passes.
- **Level 1 — Bundle:** `npm start` boots, no bundling errors, main screens render.
- **Level 2 — Simulator/manual (iOS):** Explore loads; filters work; stop card opens detail;
  save/unsave works; Saved tab updates; no product-language violations.
- **Level 3 — E2E (Maestro):** flows are staged in `apps/mobile/.maestro/` but Maestro is
  **not installed**. Report "Level 3 skipped — Maestro not installed"; do not install it
  without approval.

**A UI change is not verified because TypeScript compiled.** Level 2 (Simulator + a screenshot
you actually looked at) is required for anything that changes a screen. Procedure:
`.claude/skills/ios-verify/SKILL.md`.

## Data reads
- Use `npm run supabase:check` to confirm live Supabase reads vs mock fallback.

## Future work (needs approval to add deps)
- Add Jest + a first test for the (future) `packages/scoring` pure functions.
- Install Maestro and enable the staged flows in `apps/mobile/.maestro/`.
- Add `testID`s across the remaining interactive components so E2E stops matching on copy.
