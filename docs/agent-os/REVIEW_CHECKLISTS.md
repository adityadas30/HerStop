# REVIEW CHECKLISTS

## Verification levels (record results in the feature's `verification.md`)
- **Level 0 — Deterministic:** `npm install` ok · `npx tsc --noEmit` passes · `npm run lint` passes.
- **Level 1 — Bundle:** `npm start` boots · no bundling errors · main screens render.
- **Level 2 — iOS simulator/manual:** Explore loads · filters work · stop card opens detail ·
  save/unsave works · Saved tab updates · no product-language violations.
- **Level 3 — Maestro E2E:** launch → onboarding → Explore → tap stop → detail → save → Saved
  shows item. (Only when Maestro is installed — not yet.)

## Code review checklist
- [ ] Meets the spec's acceptance criteria; edge cases handled.
- [ ] Smallest good change; no unrelated refactors; no unnecessary abstraction/deps.
- [ ] TypeScript strict-clean; beginner-readable; reuses existing components/utilities.
- [ ] No product-language violations ("safe"/"verified safe"/"guaranteed"/"crime-free").

## Security & privacy checklist
- [ ] No service-role key in mobile code or `.env`.
- [ ] `.env` not committed; `.env.example` has placeholders only.
- [ ] No secrets/tokens/precise coordinates logged.
- [ ] No sensitive location/travel history stored without an approved spec.

## Supabase / RLS checklist
- [ ] Mobile uses anon/public key only.
- [ ] Public read only for non-sensitive `stops` data.
- [ ] `saved_stops` / `reviews` / `profiles` writes scoped to `auth.uid()`.
- [ ] Schema changes are migration-first and tracked in the repo.
- [ ] SQL reviewed before any execution; destructive ops / production changes flagged for approval.
- [ ] Mock fallback preserved.

## Approval gates (must be human-approved)
Push/merge to `main` · destructive DB ops · dropping tables/columns · production schema/auth changes ·
service-role keys · paid APIs / large deps · architecture rewrites · product-positioning changes ·
removing mock fallback · storing sensitive location data.
