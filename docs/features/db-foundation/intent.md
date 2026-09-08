# Intent — db-foundation

> Founder/product intent. Written before any code.

## User problem
Nothing user-facing yet. This is the DB groundwork the next real features (save a stop, leave a
review, have a profile) need: right now `getSavedStops()`, `toggleSaveStop()`, and `getReviews()`
are stubs (`lib/api.ts`) because there's no auth and no tables for them.

## Desired outcome
1. The live Supabase read path (`stops`) is confirmed working end-to-end and the result is
   documented, closing out `db-live-reads`.
2. A reviewed, migration-first SQL proposal exists for `profiles`, `saved_stops`, and `reviews` —
   with RLS that keeps every write scoped to `auth.uid()` — so that once OTP auth ships, the
   saved-stops and reviews features can be built directly against real tables instead of stubs.

## Non-goals
- No OTP/auth UI (separate, queued feature — see `docs/agent-os/TASK_BOARD.md`).
- No `packages/scoring` implementation (separate queued feature).
- Nothing in the migration is executed against the live project by an agent.
- No admin/moderation UI — the schema is designed with moderation in mind (`is_hidden` on
  `reviews`), not a moderation feature.

## Constraints
- Anon/public key only; no service-role key anywhere.
- Public read stays OK for non-sensitive `stops`; every `profiles`/`saved_stops`/`reviews` write
  must be scoped to `auth.uid()`.
- Migration-first: SQL lives in the repo (`docs/migrations/`), reviewed, then run by the founder.
- No destructive DB ops, no dropped tables/columns, no schema/auth changes executed by the agent.
- Product-language rules apply to any user-facing copy this touches (none in this task).
