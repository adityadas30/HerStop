# Plan — saved-stops persistence

## Files edited
- `apps/mobile/lib/api.ts` — implement `getSavedStops(userId)` and
  `toggleSaveStop(stopId, nextSaved)` against `saved_stops`, following the live-with-fallback +
  `__DEV__` LIVE/MOCK logging pattern already used by `getStops`.
- `apps/mobile/contexts/saved-stops.tsx` — read `useAuth()`; load on sign-in, clear on sign-out;
  derive `savedStops` from the `getStops()` catalog; optimistic update with rollback.
- `apps/mobile/app/(tabs)/saved.tsx` — signed-out invitation, loading state, inline sync message.
- `apps/mobile/app/stop/[id].tsx` — guest save routes to the Profile sign-in flow, then completes.

## Sequence
1. `lib/api.ts` first (no UI depends on the old stub return shapes).
2. Context rewrite — the only file that changes the public context value.
3. Saved tab, then stop detail.
4. `tsc` after each step; `lint` and `supabase:check` at the end.

## Checks
- Level 0: `npx tsc --noEmit`, `npm run lint`.
- Data: `npm run supabase:check` (LIVE, unchanged by this task).
- Level 2 simulator: deferred — see verification.md.

## Rollback plan
Every change is on `agent/saved-stops-persistence` and nothing is pushed. Drop the feature commit
to return to the in-memory behavior; no schema was changed, so there is nothing to un-apply.

## Signature note
`toggleSaveStop` takes the target state (`nextSaved`) rather than deriving it from a read. That
makes the write a single idempotent upsert-or-delete — which is what makes a double-tap safe —
and keeps the write consistent with the optimistic flip the UI already performed.
