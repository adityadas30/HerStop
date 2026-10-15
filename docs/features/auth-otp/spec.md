# Spec — auth-otp-foundation

## Screens / routes affected
- `app/(tabs)/profile.tsx` — replaces the guest-only placeholder with a 3-state sign-in UI
  (enter email → enter code → signed in). No route changes.
- `app/_layout.tsx` — wraps the app tree in `AuthProvider` (outermost, above `SavedStopsProvider`,
  so a future Supabase-backed saved-stops provider can read `useAuth()`).

## Data involved
- No new tables. Uses Supabase's built-in `auth.users` via `supabase.auth.*` — nothing to migrate.
- New files: `lib/auth.ts` (thin wrapper: `sendOtp`, `verifyOtp`, `signOut`, `getSession`,
  `onAuthStateChange`), `contexts/auth.tsx` (`AuthProvider`, `useAuth()`).
- `lib/api.ts` stubs (`getSavedStops`, `toggleSaveStop`, `getReviews`) are unchanged — wiring them
  to `auth.uid()` is the next task, once this one is merged.
- `docs/schema.sql` gets a comment-only addendum (no DDL) noting the OTP dashboard prerequisite and
  that `profiles`/`saved_stops`/`reviews` stay deferred.

## UX states (Profile screen)
- **Loading** — brief spinner while the initial session restore (`getSession()`) runs on mount.
- **Guest, enter email** — email input + "Send code". Disabled while sending; shows a field-level
  error if the request fails (e.g. malformed email, rate limit).
- **Guest, enter code** — 6-digit code input + "Verify", plus "Use a different email" to go back.
  Disabled while verifying; shows an error if the code is wrong/expired.
- **Signed in** — "Signed in as {email}" + "Sign out".
- **Offline/mock-fallback** — N/A for auth (Supabase Auth is a separate service from the `stops`
  read path); if the network is down, `sendOtp`/`verifyOtp` surface the Supabase error message in
  the same inline error state as any other failure.

## Copy
- "You're browsing as a guest" (kept, now written with a typographic apostrophe `'` instead of a
  straight `'` so it doesn't trip `react/no-unescaped-entities`)
- "Sign in to save stops across devices and leave reviews for other travelers."
- "Enter the code sent to your email"
- "We sent a 6-digit code to {email}."
- "Send code" / "Sending…" · "Verify" / "Verifying…" · "Use a different email"
- "Signed in as {email}" · "Your saved stops and reviews will carry over across devices." · "Sign out"
- No use of "safe" / "verified safe" / "guaranteed safe" / "crime-free" anywhere in the above.

## Edge cases
- **Empty email / empty code** — "Send code"/"Verify" buttons are disabled until non-empty.
- **Wrong or expired code** — Supabase returns an error (e.g. "Token has expired or is invalid");
  shown inline, code field stays editable, user can retry or go back to re-send.
- **Double-tap while busy** — buttons disable during the in-flight request (`busy` state), so a
  second tap can't fire a duplicate `sendOtp`/`verifyOtp` call.
- **Session already exists on app start** — `getSession()` restores it before the first render
  settles (`loading` state guards this), so a returning signed-in user doesn't flash the guest form.
- **Sign-in dashboard not configured for OTP codes** — if the project's email template sends a
  magic-link URL instead of a `{{ .Token }}` code, `verifyOtp` will reject a well-formed 6-digit
  input; documented as a founder-side dashboard check in `docs/schema.sql` and `verification.md`.
- **Component unmounts mid-request or mid-subscription** — `AuthProvider`'s effect uses an
  `isMounted` flag before `setSession`/`setLoading`, and always unsubscribes the auth-state
  listener on cleanup.

## Privacy / security / RLS implications
- No service-role key used anywhere. Anon key only, via the existing `supabase` client.
- No secrets logged: `lib/auth.ts` logs only the auth *event name* (e.g. `SIGNED_IN`) and error
  *messages* in `__DEV__`, never a token, session, or the OTP code itself.
- Email address is not treated as a location/sensitive field, but it is real PII: it's held only in
  Supabase Auth's own storage (`auth.users`) and the on-device `AsyncStorage` session Supabase
  already uses — this task adds no separate copy of it anywhere (no new table, no analytics event).
- RLS is unaffected — no tables were created or altered besides the `docs/schema.sql` comment.

## Acceptance criteria
- [ ] `npx tsc --noEmit` passes.
- [ ] `npm run lint` passes (no new issues introduced; the pre-existing `profile.tsx` apostrophe
      issue is fixed as part of this rewrite).
- [ ] `npm run supabase:check` still returns LIVE with 6 rows (auth changes don't touch the `stops`
      read path).
- [ ] Guest browsing (Explore, stop detail) is unaffected — no auth gate anywhere.
- [ ] Profile screen renders all three states correctly (verified in code/logic; simulator/live-code
      verification depends on Supabase Auth dashboard config — see verification.md).
- [ ] No service-role key referenced anywhere; no Supabase Auth dashboard settings changed by the
      agent.
- [ ] `docs/features/auth-otp/` complete; `docs/schema.sql`, `STATUS.md` updated.
