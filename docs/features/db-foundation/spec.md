# Spec — db-foundation

> Concrete behavior. This task is docs/SQL-proposal only — no app code changes.

## Screens / routes affected
None. No UI code changed.

## Data involved
- **`stops`** (exists, live) — read path re-verified, no schema change.
- **`profiles`, `saved_stops`, `reviews`** (proposed, not yet created) — full column list and RLS
  policies in `docs/migrations/002_auth_tables.sql`. Types already stubbed in
  `apps/mobile/lib/types.ts` (`Stop`, `Review`, `SavedStop`); `Review`/`SavedStop` will need small
  updates once the table is live and the real columns are known to match (see Known differences
  below) — that update is part of the *next* task (saved-stops persistence / reviews), not this one.
- `lib/api.ts` stub functions (`getSavedStops`, `toggleSaveStop`, `getReviews`) are unchanged —
  wiring them to real tables is out of scope here (needs auth first).

## Known differences vs. current `lib/types.ts`
The existing `Review` interface (`id, stop_id, user_id, rating, body, created_at`) is a rough
placeholder from before the structured review model was written up. The proposed `reviews` table
in `002_auth_tables.sql` uses the actual structured fields from `CLAUDE.md` / product brief
(`overall_feeling`, `lighting`, `restroom_quality`, `cleanliness`, `staff_kindness`,
`loitering_concern`, `would_stop_again`, `time_of_visit`, `note`, `is_hidden`) instead of a single
`rating`/`body`. Flagging this now so whoever builds the reviews feature updates the type to match
the migration rather than the other way around.

## UX states
N/A — no UI in this task.

## Copy
N/A — no user-facing copy added.

## Edge cases considered in the schema
- **Low review count** → not enforced in SQL (that's `packages/scoring`'s job); the schema just
  needs `reviews.stop_id` indexed so "count reviews for this stop" is cheap.
- **Repeat visits** → no uniqueness constraint on `(user_id, stop_id)` in `reviews` — a user may
  legitimately stop at the same place on different trips and leave more than one review.
- **Duplicate saves** → `saved_stops` has `unique (user_id, stop_id)` so toggling save twice can't
  create two rows (the app-side `toggleSaveStop` should upsert/delete, not blind-insert).
- **Account deletion** → `on delete cascade` on all three tables' `user_id`/`id` foreign keys, so
  deleting an `auth.users` row cleans up their profile, saved stops, and reviews automatically.
- **Moderated content** → `reviews.is_hidden` lets a moderator hide a review without deleting it
  (audit trail preserved); the author still sees their own hidden review via RLS so they know
  something happened to it.
- **Anonymous browsing sees reviews** → `reviews` SELECT is public for non-hidden rows (see
  rationale in `002_auth_tables.sql`), matching "browse without account" in MVP scope. `profiles`
  and `saved_stops` stay fully private (no public SELECT policy at all).

## Privacy / security / RLS implications
- No service-role key used or referenced anywhere (verified: the anon key alone rejects writes to
  `stops` with `42501 permission denied for table stops` — see verification.md).
- `profiles.display_name` is the only PII-shaped field proposed, and it's private (owner-only read).
- No precise location/travel-history table is proposed — out of scope per
  `.claude/rules/security-privacy-rules.md`, and not needed for MVP save/review features.
- Every `profiles`/`saved_stops`/`reviews` write policy checks `auth.uid()`; none of the three
  tables has a public write policy.
- `reviews` SELECT is intentionally public (see above) — this is a product/scope call, flagged
  explicitly for founder review rather than assumed silently.

## Acceptance criteria
- [ ] `npm run supabase:check` (from `apps/mobile/`, with a real `.env`) reports `LIVE` with row
      count and the current `stops` content, confirming the read path still works.
- [ ] RLS on `stops` confirmed to reject anonymous writes (not just reads) using a non-destructive
      probe (an insert that can only collide with an existing PK, never actually write a row).
- [ ] `docs/migrations/002_auth_tables.sql` exists, is not executed against the live project, and
      defines `profiles`, `saved_stops`, `reviews` with RLS scoped to `auth.uid()` for every write.
- [ ] `docs/architecture/data-model.md` and `docs/architecture/supabase-rls.md` updated to match.
- [ ] TEST marker row (`Willow Creek Plaza TEST`, id `1`) — decision documented (kept vs. renamed)
      with rationale; no live write performed if not founder-approved.
- [ ] `npx tsc --noEmit` and `npm run lint` pass (or lint shows only the two pre-existing,
      untouched-file issues already on the task board).
- [ ] `docs/agent-os/STATUS.md` and `TASK_BOARD.md` updated.
- [ ] No service-role key used, referenced, or requested at any point.
