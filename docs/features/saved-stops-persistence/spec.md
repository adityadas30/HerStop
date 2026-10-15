# Spec — saved-stops persistence

## Screens / routes affected
- `app/(tabs)/saved.tsx` — adds a signed-out sign-in invitation, a loading state while the list
  restores, and a quiet inline sync message. Browsing is never blocked.
- `app/stop/[id].tsx` — a guest tapping the bookmark is routed to the existing OTP sign-in flow on
  the Profile tab; the save completes automatically when they come back signed in.
- `contexts/saved-stops.tsx` — reads auth state, loads/clears the list, owns optimistic updates.
- `lib/api.ts` — real `getSavedStops` / `toggleSaveStop`.

## Data involved
- Table `saved_stops` (`id`, `user_id`, `stop_id`, `created_at`, `unique (user_id, stop_id)`) as
  defined in `docs/migrations/002_auth_tables.sql`. **Proposed, not yet applied** — see
  verification.md.
- `lib/types.ts` `SavedStop` — unchanged, already matches the migration.
- No schema change authored by this task. No new env vars.

## Data flow
- Guest: `toggleSaved` → in-memory only, Saved tab invites sign-in.
- Signed in: `toggleSaved` → optimistic local flip → upsert (save) or delete (unsave) → on error,
  roll back the flip and show a quiet inline message.
- App launch while signed in: auth session restores → `getSavedStops(auth user id)` → hydrate.
- The Saved list is derived by intersecting saved ids with the stop catalog from `getStops()`
  (live, with mock fallback) — never from `MOCK_STOPS` directly.

## UX states
Loading (spinner while restoring) · empty signed-in (existing bookmark empty state) ·
empty guest (sign-in invitation) · guest with in-session saves (cards + "keep these stops" card) ·
sync error (one-line inline message, no alert) · mock fallback (saves work in memory, logged).

## Copy
- "Save stops for later" / "Bookmark a stop while you browse. Sign in to keep your list across
  trips and devices."
- "Keep these stops" / "Sign in to keep these stops after you close the app, and to reach them
  from any device."
- "Sign in"
- "Could not sync that change. Check your connection."
- "Sign in to keep your saved stops."
No absolute safety claims; nothing describing a place at all.

## Edge cases
- Offline / Supabase unreachable → local state rolls back, inline message.
- Double-tap save → upsert with `onConflict: 'user_id,stop_id'`, `ignoreDuplicates` and an
  idempotent delete; the unique constraint cannot be violated.
- Stop deleted server-side but still in the saved list → the id has no matching stop and is
  skipped, not rendered as a broken card.
- Sign-out mid-request → a monotonic `loadIdRef` token invalidates in-flight loads and writes, so
  a late response cannot repopulate a cleared list.
- Guest saves then signs in → the pending save is applied only after the restore finishes, so it
  is not overwritten by it.

## Privacy / security / RLS implications
- Anon key only. `toggleSaveStop` takes the user id from the stored session
  (`supabase.auth.getSession()`), never from its caller.
- `getSavedStops(userId)` passes the id as a query *filter*; access is granted by the RLS policies
  (`auth.uid() = user_id`) in `002_auth_tables.sql`, which have no public read.
- Logs record counts, ids of stops (not users) and event names — no tokens, no coordinates.

## Acceptance criteria
- [ ] `npx tsc --noEmit` passes.
- [ ] `npm run lint` introduces no new errors.
- [ ] A live Supabase stop can be saved and appears in the Saved tab.
- [ ] Saved stops survive a full app restart while signed in.
- [ ] Sign-out clears the visible saved list; sign-in restores it.
- [ ] Guests can browse and open stop detail with no auth wall.
