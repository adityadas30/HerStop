# Plan — db-foundation

## Files to create / edit
- `docs/migrations/README.md` — new. Migration numbering/apply convention.
- `docs/migrations/002_auth_tables.sql` — new. `profiles`, `saved_stops`, `reviews` + RLS, proposed
  only, not run.
- `docs/features/db-foundation/{intent,spec,plan,verification}.md` — new. This feature's artifacts.
- `docs/architecture/data-model.md` — edit. Flesh out the "planned tables" section with the real
  column lists (link to the migration instead of duplicating it) and correct the live-reads status.
- `docs/architecture/supabase-rls.md` — edit. Replace the "current blocker" section (now resolved)
  with the confirmed RLS posture; add the auth-tables RLS summary.
- `docs/architecture/current-state.md` — edit. Update the "Backend (verified)" section: live reads
  confirmed (with a real `.env`); no schema change made to `stops`.
- `docs/agent-os/STATUS.md`, `docs/agent-os/TASK_BOARD.md` — edit. Log this session; move
  `saved-stops persistence`/`reviews` task-board notes to reflect that a schema proposal now exists.
- No `apps/mobile/**` changes — this task is docs/SQL only.

## Sequence
1. Read all required context docs + current `lib/api.ts`/`types.ts`/`schema.sql` (done).
2. Verify live reads: copy the founder's real `.env` into this worktree's `apps/mobile/` (gitignored,
   never committed), run `npm run supabase:check`, record the result, then delete the copy.
3. Verify RLS write posture on `stops` with a non-destructive anon-key probe (insert colliding with
   an existing PK — can 401/permission-deny without ever writing a row). Confirm `profiles` /
   `saved_stops` / `reviews` don't exist yet (expected).
4. Decide the TEST-row question: since the anon key can't write to `stops` at all (confirmed by the
   probe), there is no way to rename it without a service-role key — which is off-limits. Document
   that as the reason it stays as-is, plus the exact SQL for the founder to run later if desired.
5. Design and write `docs/migrations/002_auth_tables.sql` (schema + RLS only, no destructive ops).
6. Update the architecture docs and agent-os docs to match reality + the new proposal.
7. Run `npx tsc --noEmit` and `npm run lint` from `apps/mobile/` (no app code touched, so this
   should reproduce the same pre-existing baseline).
8. Commit to `agent/db-foundation`, push, open a PR into `dev` (not `main`).

## Tests / checks
- Level 0: `npx tsc --noEmit`, `npm run lint` (from `apps/mobile/`).
- Data: `npm run supabase:check` — confirms live reads with a real `.env` present.
- No Level 1/2 simulator checks — no UI changed.
- SQL in `002_auth_tables.sql` is reviewed here, not executed; verifying it end-to-end happens when
  it's actually applied and RLS is tested against a real signed-in session (part of the future
  saved-stops/reviews task, once OTP auth exists to create that session).

## Acceptance criteria (from spec.md)
See `spec.md` — restated and checked off in `verification.md`.

## Rollback plan
- Everything here is additive documentation + an unexecuted SQL file — reverting is
  `git revert`/drop the branch, no live state to undo.
- If `002_auth_tables.sql` is later applied and needs to be undone, that's a separate, explicitly
  human-approved destructive operation (drop table) — not something to script preemptively.
