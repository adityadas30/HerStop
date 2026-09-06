# Plan — db-live-reads

## Files to create / edit
- `apps/mobile/.env.example` (new) — variable names + safe placeholders.
- `apps/mobile/scripts/supabase-check.mjs` (new) — read-only connectivity check.
- `apps/mobile/package.json` — add `"supabase:check"` script.
- `apps/mobile/lib/supabase.ts` — clearer MOCK-vs-configured log (host only, never key).
- `apps/mobile/lib/api.ts` — `getStops`/`getStopById` log `LIVE` vs `MOCK fallback (reason)`.

## Sequence
1. Add `.env.example` + `supabase-check.mjs` + npm script.
2. Add dev-only logging (guarded by `__DEV__`).
3. Run Level 0 checks and `supabase:check`.
4. Record results in `verification.md`; write founder unblock steps.

## Tests / checks
- `npx tsc --noEmit`, `npm run lint` (from `apps/mobile/`).
- `npm run supabase:check`.

## Acceptance criteria
See `spec.md` — one-command diagnosis, clear live/mock logs, `.env.example`, checks pass, fallback intact.

## Rollback plan
All changes are additive/log-only. Revert the 5 files; no schema or data touched.
