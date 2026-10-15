# TASK BOARD

> Move lines between sections. Keep it terse. `[owner]` = agent. Link feature folders.

## Blocked
_(none — migration 002 applied 2026-09-10, `rls:check` 5/5)_

## Queued
- **integrate into `dev` → `main`** [founder decision] — `agent/agent-os-v0.2` is ahead of both;
  backed up to `origin/agent/agent-os-v0.2` (2026-09-10), not merged.
- **agent-teams pilot** [Lead] — must run from an **interactive** session started after the
  Agent Teams env var landed. See `AGENT_TEAMS.md`. Could not be run during the harness build.
- **scoring package** [mobile-builder] — pure functions in `packages/scoring`; add first Jest test.
  Downstream of reviews in the dependency chain.

## In progress
**Confirmed critical path to beta (founder, 2026-09-15). Do not start anything below step 4
until steps 1–4 are live — no location, maps, Sentry, PostHog, or polish before that.**

1. ⏳ **OSM attribution** [`agent/osm-attribution`, mobile-builder] — "© OpenStreetMap
   contributors" on Explore + stop detail, small and unobtrusive, existing theme tokens.
   Commit only, founder reviews before merge. **Hard gate: migration 004's data must not be
   user-visible without this** (ODbL requirement).
2. ⏳ **Founder runs migration 003** (reviews privacy + moderation). Reviewed twice
   (verdict BLOCK → fixed → PASS). Pre-flight + apply steps:
   `docs/features/community-reviews/db-verification.md` §1. Verify `rls:check` → 12/12.
3. ⏳ **Founder runs migration 004** (18 real I-65 stops, replaces the 6 fictional rows).
   Verify `supabase:check` → 18 rows, no "TEST" marker.
4. ⏳ **Reviews live verification** [mobile-verifier, fresh context, Maestro] — write / read /
   report / hide a real review; confirm labels come only from real reviews; grep-confirm no
   `stop.rating` / `stop.reviewCount` / `stop.badge` remain live. Needs one founder OTP code.
5. ⬜ **Account deletion** [`agent/account-deletion`] — `005_delete_own_account.sql` + Profile UI.
   Apple Guideline 5.1.1(v). **Agent must stop and ask the founder hard-delete vs soft-delete
   (with pros/cons) before implementing.** No SQL execution, no merge without review.
6. ⬜ **Privacy policy + support contact URLs** — required for App Store and for UGC (1.2).
7. ⬜ **Resend SMTP** [founder] — Supabase's default sender only delivers to project team
   members, so no outside beta tester can sign in until this is done.
8. ⬜ **EAS build** [founder login] → internal TestFlight. Submit needs explicit approval.

Done this sprint and merged: OTP length fix (`fbc43c3`), saved-stops cold-launch fix (`7fa6dd0`),
saved-stops live QA (all criteria PASS on a real account), Coming Soon previews + TestFlight
config, Maestro flows (fixed and verified working), 003 + 004 staged, OSM dataset committed.

## Done
- **repo maintenance** [Lead] — canonical docs brought in line with repo reality; 8 merged, clean
  task worktrees removed (branches kept); final read-only review of `002_auth_tables.sql`
  (2026-09-10).
- **origin/dev repair** — resolved **by merge, not reset**: `origin/dev` = local `dev` = `60749f0`,
  and the old divergent tip `89c9237` is now an ancestor of it. `dev` contains `CLAUDE.md`, the
  harness, the Supabase client and auth. Confirmed with `git ls-remote` (2026-09-10).
- **agent-os-v0.2** [Lead] — single-Lead orchestration, worktree specialists, enforced hooks,
  guard regression suite, staged Maestro flows (2026-09-10).
- **harness-pilot** [mobile-builder x2 + mobile-verifier] — proved concurrent worktree builders,
  autonomous dispatch, integration, and independent verification (2026-09-10). Cleared the last
  lint warning and added Maestro `testID` anchors. See `docs/features/harness-pilot/`.
- **db-auth-tables-verify** [db-engineer] — `stops.id` confirmed `text`; migration made re-runnable;
  `npm run rls:check` added (2026-09-08). See `docs/features/auth-tables/`.
- **agent-os-v0.1** [Lead] — harness build (2026-09-06).
- **db-live-reads** [db-engineer] — blocker diagnosed + tooling added (2026-09-06).
  See `docs/features/db-live-reads/`.
- **db-foundation** [db-engineer] — live reads re-confirmed (LIVE, 6 rows); RLS anon-write block
  confirmed on `stops`; proposed `profiles`/`saved_stops`/`reviews` schema + RLS in
  `docs/migrations/002_auth_tables.sql` (not yet applied) (2026-09-06). See `docs/features/db-foundation/`.
- **auth-otp-foundation** [db-engineer] — email OTP sign-in implemented and **verified working
  end-to-end** against the live API with a real round trip (2026-09-06 / 2026-09-08).
  See `docs/features/auth-otp/`.
- **qa-baseline** [mobile-verifier] — fresh-context baseline; fixed a real product-language violation
  ("Verified safe stops within 5 miles" → "Better-reviewed stops within 5 miles") (2026-09-06).
  See `docs/features/qa-baseline/`.

## Dependency chain (do not skip ahead)
`db-live-reads` ✅ → `db-foundation` ✅ + `auth-otp-foundation` ✅
→ migration 002 ✅ *(applied 2026-09-10, `rls:check` 5/5)*
→ `saved-stops` live verification ⏳ *(code already done)* → reviews → real scoring →
recommendation ranking. Maps/Places can scaffold after DB reads are stable. Sentry/PostHog before
beta, after core flows.

> Branches: cut new work from the current integration branch (`agent/agent-os-v0.2`). `dev` is
> healthy but behind it; `main` is further behind.
