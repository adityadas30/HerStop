# Plan — auth-otp-foundation

## Files to create / edit
- `apps/mobile/lib/auth.ts` — new. Thin wrapper: `sendOtp`, `verifyOtp`, `signOut`, `getSession`,
  `onAuthStateChange`, built on the existing `supabase` client.
- `apps/mobile/contexts/auth.tsx` — new. `AuthProvider` + `useAuth()`; hydrates session on mount,
  subscribes to auth-state changes, cleans up on unmount.
- `apps/mobile/app/_layout.tsx` — edit. Wrap the tree in `AuthProvider`, outermost (above the
  existing `SavedStopsProvider`).
- `apps/mobile/app/(tabs)/profile.tsx` — edit (full rewrite of the screen body). Guest/enter-email,
  enter-code, and signed-in states using existing `Button`/`Card` primitives and `theme.ts` tokens.
  Also fixes the pre-existing unescaped-apostrophe lint error as part of the rewrite.
- `docs/schema.sql` — edit. Append a comment-only block (no DDL) noting the OTP dashboard
  prerequisite and that `profiles`/`saved_stops`/`reviews` stay deferred.
- `docs/migrations/{README.md,002_auth_tables.sql}` — new (copied from the sibling `db-foundation`
  branch's proposal, not yet merged anywhere shared). Pure additive documentation, nothing executed;
  brought in so `docs/schema.sql`'s new comment has something real to point at regardless of which
  branch merges first.
- `docs/features/auth-otp/{intent,spec,plan,verification}.md` — new, this feature's artifacts.
- `docs/agent-os/STATUS.md` — edit, log this session.

## Sequence
1. Bring this worktree's branch up to date with the Agent OS harness (it was cut before the harness
   commit landed — see verification.md for why) so `CLAUDE.md`/`.claude/rules/`/`docs/agent-os/`
   actually exist here.
2. Install deps (`npm install`, not yet run in this worktree), confirm live reads
   (`npm run supabase:check`) and check Supabase Auth settings read-only (`GET /auth/v1/settings`
   with the anon key) to confirm email OTP is enabled before writing UI against it.
3. Write `lib/auth.ts`, then `contexts/auth.tsx`, then wire `_layout.tsx`.
4. Rewrite `profile.tsx` against `useAuth()`.
5. Append the `docs/schema.sql` comment block; bring over the migration-proposal docs it references.
6. Write feature docs; update `STATUS.md`.
7. Run `tsc`/`lint`/`supabase:check`; attempt a real OTP send/verify if a test email is available.
8. Commit to `agent/auth-otp-foundation`. No push, no merge.

## Tests / checks
- Level 0: `npx tsc --noEmit`, `npm run lint` (from `apps/mobile/`).
- Data: `npm run supabase:check` — confirms auth work didn't disturb the `stops` read path.
- Level 2 (simulator): not run in this environment (no iOS Simulator here) — code-level
  verification only; documented as a gap with exact manual steps for the founder in verification.md.
- Live OTP round-trip: attempted only as far as `sendOtp` against the real project; completing
  `verifyOtp` needs a real inbox to read the code from, which this environment doesn't have —
  documented as a founder-side manual check.

## Acceptance criteria (from spec.md)
Restated and checked off in `verification.md`.

## Rollback plan
All changes are additive/new files plus two small edits (`_layout.tsx` wiring, `profile.tsx`
rewrite, a comment appended to `schema.sql`). Revert the commit or drop the branch — no live
Supabase state was touched (no dashboard settings changed, no tables created).
