# Spec — <feature name>

> Concrete behavior. What the builder implements against.

## Screens / routes affected
List each route (`app/...`) and how it changes.

## Data involved
Tables, `lib/api.ts` functions, types (`lib/types.ts`), mock data. New/changed schema?

## UX states
Loading · empty · error · success · offline/mock-fallback.

## Copy
Exact user-facing strings. Must follow `.claude/rules/product-boundaries.md`.

## Edge cases
Enumerate them (no data, one item, long text, slow network, unauthenticated, etc.).

## Privacy / security / RLS implications
Any user data? Location data? RLS policies needed? Anon-key-only confirmed?

## Acceptance criteria
- [ ] Criterion 1 (testable)
- [ ] Criterion 2
