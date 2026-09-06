# Rule: Testing & Verification

There is **no unit-test runner configured yet** (no Jest, no Maestro). Do not claim tests pass
when none exist. Use the verification levels below and record results in the feature's
`verification.md`.

## Verification levels
- **Level 0 — Deterministic:** `npm install` ok; `npx tsc --noEmit` passes; `npm run lint` passes.
- **Level 1 — Bundle:** `npm start` boots, no bundling errors, main screens render.
- **Level 2 — Simulator/manual (iOS):** Explore loads; filters work; stop card opens detail;
  save/unsave works; Saved tab updates; no product-language violations.
- **Level 3 — E2E (Maestro):** only when Maestro is installed/configured (not yet).

## Data reads
- Use `npm run supabase:check` to confirm live Supabase reads vs mock fallback.

## Future work (needs approval to add deps)
- Add Jest + a first test for the (future) `packages/scoring` pure functions.
- Add a minimal Maestro smoke flow (launch → onboarding → Explore → open stop → save → Saved).
