# Spec — db-live-reads

## Screens / routes affected
None visually. Behavior is in the data layer used by `(tabs)/index.tsx` (Explore) and
`stop/[id].tsx`.

## Data involved
- `lib/supabase.ts` — client + `supabaseConfigured` gate + `EXPO_PUBLIC_*` env vars.
- `lib/api.ts` — `getStops()`, `getStopById()` and their mock fallback.
- `docs/schema.sql` — `stops` table + seed. `data/mock-stops.ts` — mock fallback.

## UX states
- **Live:** Supabase returns rows → app shows DB data.
- **Mock fallback:** not configured / error / 0 rows → app shows `MOCK_STOPS` (unchanged UX).

## Copy
No user-facing copy changes. Dev-only console lines only.

## Edge cases
- `.env` missing or placeholder → mock, no network hang (`supabaseConfigured` false).
- Project host unreachable (NXDOMAIN) → caught, mock fallback.
- Auth/RLS error (401/403) → caught, mock fallback; `supabase:check` explains it.
- `stops` table missing (404) → caught; `supabase:check` says run `schema.sql`.
- Live query returns 0 rows → mock fallback (logged with that reason).

## Privacy / security / RLS implications
- Anon key only. Never log the key (host only). `.env` stays gitignored; `.env.example` is safe.
- `stops` is public-read (non-sensitive) — appropriate for anonymous browsing.

## Acceptance criteria
- [ ] `npm run supabase:check` prints either a live row count or the exact blocker.
- [ ] Dev logs say `LIVE Supabase: N rows` or `MOCK fallback (reason: …)`.
- [ ] `.env.example` exists with safe placeholders; `.env` remains untracked.
- [ ] `npx tsc --noEmit` and `npm run lint` pass.
- [ ] Mock fallback still works; no secrets logged.
