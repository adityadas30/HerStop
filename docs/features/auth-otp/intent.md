# Intent — auth-otp-foundation

> Founder/product intent. Written before any code.

## User problem
A guest browsing HerStop has no way to keep a stop saved, or leave a review, beyond the current
app session — `saved_stops` are in-memory only and `getReviews`/`toggleSaveStop` are stubs because
there's no real user identity yet.

## Desired outcome
The app has a real, working sign-in: a user enters their email, gets a 6-digit code, enters it, and
is signed in with a Supabase session that persists across app restarts. This unblocks the next two
tasks (saved-stops persistence, reviews), which both need `auth.uid()`. Guest browsing keeps working
exactly as before for anyone who doesn't sign in — sign-in is optional, not a gate.

## Non-goals
- No `saved_stops`/`reviews`/`profiles` tables created or wired up yet (Task 1 of the dependency
  chain — those are next).
- No password auth, no social sign-in — email OTP only, per MVP scope.
- No UI redesign beyond the Profile screen's sign-in states.
- No admin/moderation UI.

## Constraints
- Anon/public key only; no service-role key.
- No new npm dependencies (`@supabase/supabase-js` already has everything needed).
- Preserve the mock-data fallback and live-vs-mock logging in `lib/api.ts`/`lib/supabase.ts` —
  untouched by this task.
- Product-language rules apply to all new copy (`.claude/rules/product-boundaries.md`).
- No destructive DB ops; no Supabase Auth dashboard changes made by the agent (founder action only).
- Do not push/merge to `main` or `dev`.
