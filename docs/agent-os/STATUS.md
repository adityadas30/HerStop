# STATUS

> One-line-per-session log. Newest on top. Keep it scannable from a phone.

## Snapshot
- **Phase:** early — UI shell + typed data layer with Supabase/mock fallback.
- **Backend:** Supabase client wired; **live reads now confirmed WORKING** — `supabase:check`
  returns 6 live rows (marker row `Willow Creek Plaza TEST`). Older "NXDOMAIN" note in this file
  and `docs/features/db-live-reads/` is stale; that feature's owner should re-run
  `supabase:check` and close it out. See `docs/features/qa-baseline/verification.md`.
- **Branch:** `agent/qa-baseline` (worktree), off `main`. `dev` branch exists.
- **Tests:** none (no Jest/Maestro). Deterministic checks = `tsc` + `lint`.
- **Checks (2026-09-06, QA baseline pass):** `tsc` ✅ · `lint` ⚠️ 2 pre-existing issues in
  untouched files (profile.tsx, JourneyShield.tsx — unchanged from prior log) ·
  `supabase:check` ✅ LIVE (6 rows) · `expo export --platform ios` ✅ bundles clean (1349 modules).
- **Known bug (found, not fixed):** Saved tab (`contexts/saved-stops.tsx`) filters the hardcoded
  `MOCK_STOPS` array instead of the live/current stop list, so a saved live stop can show stale
  mock data. See verification doc Finding #2.

## Immediate priorities
1. Founder: confirm the `Willow Creek Plaza TEST` row is intentional seed data (not accidental),
   then close out `docs/features/db-live-reads/` as unblocked.
2. Fix Saved-tab data source (`contexts/saved-stops.tsx` reading `MOCK_STOPS`) — likely bundled
   with the already-planned auth-backed `saved_stops` persistence work.
3. After that → saved-stops persistence (needs auth) is the next dependency.

## Log
- **2026-09-06** — Fresh-context QA baseline pass (`agent/qa-baseline`): ran install/tsc/lint/
  supabase:check, confirmed live Supabase reads now work (contradicts prior NXDOMAIN note),
  verified core flow (onboarding → Explore → filters → detail → save → Saved tab) by tracing code
  (no simulator-automation tool available this session, so no literal tap-through), fixed one
  product-language violation ("Verified safe stops..." → "Better-reviewed stops..." in Explore
  subtitle), and found a real pre-existing bug in the Saved tab's data source. Full detail in
  `docs/features/qa-baseline/verification.md`.
- **2026-09-06** — Built Agent OS v0.1 harness (agents, rules, agent-os docs, feature template,
  reorganized docs). Validated with `db-live-reads`: pinned live-read blocker to NXDOMAIN on the
  Supabase project host; added `.env.example`, live-vs-mock logging, and `supabase:check` script.
  `tsc`/`lint` results recorded in `docs/features/db-live-reads/verification.md`.
