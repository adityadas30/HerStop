# Intent — saved-stops persistence

## User problem
A driver bookmarks a promising stop while planning a trip, closes the app, and the bookmark is
gone. Worse, a stop that came from Supabase could be bookmarked but never showed up in the Saved
tab at all, because the Saved list was built by filtering the local `MOCK_STOPS` array.

## Desired outcome
- A signed-in user's saved stops live in Supabase and come back after a full app restart, on any
  device they sign in on.
- Any stop the app can show — live or mock — can be saved and appears in the Saved tab.
- Guests can still browse, open stop detail, and bookmark within a session; saving is the only
  thing that invites an account.

## Non-goals
- Migrating a guest's whole in-memory list into their account at sign-in (only the stop they were
  actively trying to save is carried through).
- Offline write queueing / retry. A failed write rolls back and says so; it is not retried later.
- Reviews, scoring, folders, or ordering controls for the saved list.

## Constraints
- Anon key only; authorization is RLS on `auth.uid()`, never a client-supplied user id.
- Mock fallback preserved; live-vs-mock obvious in `__DEV__` logs.
- No new dependencies. Existing `components/ui/` primitives and `constants/theme.ts` only.
- Copy follows `.claude/rules/product-boundaries.md`.
