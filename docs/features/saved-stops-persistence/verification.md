# Verification — saved-stops persistence

Implemented 2026-09-08 on branch `agent/saved-stops-persistence` (worktree; not pushed, not merged).

## Branch base note
The task said to branch from `dev` after `agent/auth-otp-foundation` had been rebased into it.
That had not happened: `dev` is still at `493344c`, which predates even the Agent OS harness commit
(`6778126`) and contains no `contexts/auth.tsx` — branching there would have made this task
impossible, since it depends on reading auth state.

The branch already existed (created by the orchestrator) off the auth work, and during this session
`agent/db-foundation` and `agent/qa-baseline` were merged into it by a concurrent session. Work
proceeded on that consolidated base:

```
70e7f54 Merge branch 'agent/qa-baseline' into agent/saved-stops-persistence
dc02205 Merge branch 'agent/db-foundation' into agent/saved-stops-persistence
c3ac68c auth-otp-foundation: record real OTP round-trip verification
```
This matches the "Branch consolidation note" already recorded in `docs/agent-os/STATUS.md`.
`dev` still needs a human-approved consolidation; this task did not touch it.

## BLOCKER — the `saved_stops` table does not exist in the live project

Read-only probe with the anon key (a `GET`, nothing written):
```
GET /rest/v1/saved_stops?select=id&limit=1
status: 404
{"code":"PGRST205", "hint":"Perhaps you meant the table 'public.stops'",
 "message":"Could not find the table 'public.saved_stops' in the schema cache"}
```
`docs/migrations/002_auth_tables.sql` is still proposed-only. Applying it is a production schema
change and needs founder approval and a manual run — no agent executes it
(`.claude/rules/supabase-rules.md`). **Until it is applied, saving while signed in will fail and
roll back**; the client code is complete and correct against the migration as written, but two of
the acceptance criteria below cannot pass yet for reasons outside this task's authority.

Current pre-migration behavior is graceful, not a crash: the write returns `PGRST205`, the
optimistic flip rolls back, and the Saved tab shows one quiet line
("Could not sync that change. Check your connection."). The real Supabase error is printed in the
`__DEV__` log.

**Founder steps to unblock:** run `docs/migrations/002_auth_tables.sql` in the Supabase SQL Editor,
then re-run the probe above (expect `200 []` — RLS returns an empty list to an anon caller rather
than a 404), then work through the simulator checklist below.

## Commands run (with results)

`.env` is gitignored and per-worktree; copied in from the founder's main checkout so these checks
could run. It was **left in place** (still gitignored, never committed) so the founder can run
`npm run ios` from this worktree for the Simulator pass below without copying it again. No key or
token was logged — only host, status, and row counts.

```
$ npm install
(exit 0 — node_modules wasn't present in this fresh worktree)

$ npx tsc --noEmit
(exit 0 — no output)

$ npm run lint
components/ui/JourneyShield.tsx
  4:10  warning  'IconSymbol' is defined but never used  @typescript-eslint/no-unused-vars
✖ 1 problem (0 errors, 1 warning)   (exit 0)

$ npm run supabase:check
✅ LIVE — Supabase returned 6 row(s) from "stops".
   Found live marker row: "Willow Creek Plaza TEST" (id=1).
```

Lint note: the task brief expected two pre-existing failures (`profile.tsx`, `JourneyShield.tsx`).
The `profile.tsx` error was already fixed by `auth-otp-foundation` and is gone. The one remaining
`JourneyShield.tsx` warning is pre-existing, in a file this task did not touch. **No new lint
problems were introduced** (before and after this task: same single warning).

## Verified at the code level
- [x] `savedStops` no longer derives from `MOCK_STOPS` — it intersects saved ids with the catalog
      from `getStops()`, so a stop that exists only in Supabase now reaches the Saved tab. The old
      `MOCK_STOPS` import is gone from `contexts/saved-stops.tsx` entirely.
- [x] Guest browsing has no auth wall — Explore and `stop/[id]` render identically for guests; the
      only auth-aware branch on the detail screen is the bookmark button's handler.
- [x] Anon key only; `toggleSaveStop` reads the user id from `supabase.auth.getSession()`, never
      from its caller. `getSavedStops`'s `userId` argument is a query filter, with RLS
      (`auth.uid() = user_id`) as the actual authorization.
- [x] Sign-out mid-request — traced by hand. Both the loader and the write capture the monotonic
      `loadIdRef` value they started with; the sign-out path bumps it, so a late response returns
      early instead of repopulating a cleared list. This is the same bug shape found earlier in
      `profile.tsx` during the auth work.
- [x] Double-tap save — `upsert(..., { onConflict: 'user_id,stop_id', ignoreDuplicates: true })`
      and an equality-scoped `delete` are both idempotent, so the `unique (user_id, stop_id)`
      constraint cannot be hit regardless of ordering.
- [x] Stale/deleted stop — `savedStops` filters the catalog rather than mapping over saved ids, so
      an id with no matching stop is skipped, not rendered as a broken card.
- [x] Guest-save-then-sign-in ordering — the pending save on `stop/[id].tsx` waits for
      `savedLoading === false`, so it runs after the restore rather than being overwritten by it.

## Not verified — needs Simulator (founder)
No iOS Simulator interaction was available in this session (same restriction recorded in
`docs/features/auth-otp/verification.md`). **All of these also require the migration above first.**
- [ ] Sign in, save a live Supabase stop, confirm it appears in the Saved tab.
- [ ] Force-quit and reopen while signed in — confirm the saved list restores.
- [ ] Sign out — confirm the visible list clears and the sign-in invitation appears; sign back in
      and confirm the list returns.
- [ ] As a guest, tap the bookmark on stop detail — confirm it routes to the Profile sign-in flow
      and that the save completes on return. (`router.push('/profile')` typechecks against the
      generated typed routes, but the cross-group stack→tabs push is worth watching once.)
- [ ] Turn on airplane mode while signed in, tap save — confirm the bookmark flips back and one
      quiet line appears (no alert).

## Acceptance criteria
- [x] `npx tsc --noEmit` passes — PASS.
- [x] `npm run lint` introduces no new errors — PASS (same single pre-existing warning).
- [ ] A live Supabase stop can be saved and appears in the Saved tab — **BLOCKED** on the
      migration; code path verified by reading, not by running.
- [ ] Saved stops survive a full app restart while signed in — **BLOCKED**, same reason.
- [ ] Sign-out clears the visible saved list; sign-in restores it — clearing is verifiable today
      (it is local state); restoring needs the migration. Needs Simulator.
- [x] Guests can browse and open stop detail with no auth wall — PASS (code level; no auth check
      exists on either path).

## Product-language scan
No "safe" / "verified safe" / "guaranteed safe" / "crime-free" in any new copy. The new strings
describe the user's own list and sync status; none of them describes a place at all. (yes)

## Known remaining issues
- The migration blocker above is the single gate on this feature working.
- A guest's wider in-memory list is not migrated at sign-in — only the stop they were actively
  saving. Deliberate (see intent.md non-goals); revisit if it surprises testers.
- The Saved tab's sync message clears on the next successful toggle or user change, not on a timer.
- `SavedStopsProvider` calls `getStops()` once at mount to build its catalog, so app launch makes
  one more `stops` read than before. Fine at 6 rows; worth revisiting when the catalog is
  route-scoped rather than "all stops".

## Reviewer notes
- No service-role key used anywhere; anon key only. No SQL executed against the live DB — the only
  live calls made in this session were `GET`s (`supabase:check` and the `saved_stops` probe).
- `.env` copied in from the founder's own checkout for the checks and deliberately left in the
  worktree for the Simulator pass; never committed (gitignored, and confirmed absent from
  `git status` throughout).
- `__DEV__` logs record row counts, stop ids and event names — no tokens, no user ids, no
  coordinates.
- `toggleSaveStop` takes a second `nextSaved` argument rather than the bare `(stopId)` in the task
  brief. Rationale in plan.md: it makes the write a single idempotent upsert-or-delete (the
  double-tap guarantee) and keeps the write aligned with the optimistic flip already shown. Called
  out here rather than done silently.
- No new dependencies. No unrelated screens touched (`journeys.tsx`, `safety.tsx`, `StopCard.tsx`
  and the Explore screen are untouched — `toggleSaved(id)`'s public signature was kept precisely so
  `StopCard` did not need editing).
