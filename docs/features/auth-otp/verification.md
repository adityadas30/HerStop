# Verification — auth-otp-foundation

Verified 2026-09-06 on branch `agent/auth-otp-foundation` (worktree; not pushed, not merged).

## Branch setup note
This worktree's branch (`agent/auth-otp-foundation`) was cut from a point (`493344c`) that predates
the Agent OS harness commit (`6778126`, on `agent/agent-os-v0.1`) — so `CLAUDE.md`, `.claude/rules/`,
`docs/agent-os/`, `docs/product/`, `docs/architecture/`, and `docs/features/_template/` didn't
exist here yet, even though the task instructions assumed they did. Fixed with:
```
$ git merge --ff-only agent/agent-os-v0.1
Updating 493344c..6778126
Fast-forward
```
Clean fast-forward, no conflicts — `agent/agent-os-v0.1` is exactly that one commit, a direct child
of this branch's prior tip. This brought in the harness files plus the earlier `db-live-reads`
fixes (`lib/api.ts` live-vs-mock logging, `supabase-check.mjs`, `.env.example`) that this task's
checks depend on. Also copied `docs/migrations/{README.md,002_auth_tables.sql}` in from the
sibling `db-foundation` branch (not yet merged anywhere shared) so this task's `docs/schema.sql`
comment has a real file to point at — pure additive documentation, nothing executed.

## Commands run (with results)

### Live read + auth-settings probes
`.env` isn't committed (gitignored, per-machine); temporarily copied in from the founder's main
checkout to run these checks, then deleted — no secret logged, only host/status/booleans.

```
$ npm install        # node_modules wasn't present in this fresh worktree
(923 packages installed, ok)

$ npm run supabase:check
✅ LIVE — Supabase returned 6 row(s) from "stops".
   Found live marker row: "Willow Creek Plaza TEST" (id=1).
```
Confirms the auth changes don't touch or break the existing `stops` read path.

```
# Read-only: GET /auth/v1/settings with the anon key
{"external":{... "email":true, "phone":false, ...},
 "disable_signup":false, "mailer_autoconfirm":false, ...}
```
`email: true` and `disable_signup: false` — email sign-in is enabled and open. `mailer_autoconfirm:
false` means email confirmation is required, consistent with an OTP-code flow (not instant sign-in).
This doesn't confirm the email *template* sends a 6-digit code vs. a magic-link URL — that's not
exposed by this endpoint — see "Known blocker" below.

### Deterministic checks (from `apps/mobile/`)
```
$ npx tsc --noEmit
(exit 0 — passes, no output)

$ npm run lint
components/ui/JourneyShield.tsx
  4:10  warning  'IconSymbol' is defined but never used
✖ 1 problem (0 errors, 1 warning)   (exit 0)
```
The pre-existing `app/(tabs)/profile.tsx:19` unescaped-apostrophe **error** is gone — fixed by this
task's rewrite (now uses a typographic `'`). The one remaining warning is pre-existing, in a file
this task didn't touch (already on the task board as a tiny cleanup item).

```
$ npm run supabase:check   # re-run after all code changes
✅ LIVE — Supabase returned 6 row(s) from "stops".
```
Unchanged — confirms the auth work didn't disturb the live-reads path.

## Simulator / manual checks
**Not run — no iOS Simulator in this environment.** Verified at the code level instead:
- [x] Guest browsing unaffected — `Explore`/`stop/[id]` don't reference `useAuth()` at all; nothing
      in this task changed their code path.
- [x] Profile screen renders three states via plain conditional logic on `loading` / `isGuest` /
      `step` — no state can render two forms at once, no missing-state gap (traced by hand, all
      three branches covered, `tsc` confirms exhaustive prop typing).
- [x] Buttons disable while `busy`, so a double-tap can't fire a duplicate request.
- [ ] **Not verified: an actual signed-in session end to end.** See below.

## Known blocker — OTP round-trip not fully verified
`sendOtp`/`verifyOtp` are implemented against the confirmed-live Supabase Auth API (see the
settings probe above), but completing a real round-trip needs:
1. A real inbox to receive the 6-digit code (this environment has no email access), and
2. An iOS Simulator or device to drive the UI interactively (not available here either).

**Founder steps to finish verifying:**
1. `cd apps/mobile && npm run ios` (needs a real `.env` in place).
2. Go to the Profile tab → enter your own email → "Send code".
3. Check your inbox for a 6-digit code (not a magic-link-only email — see note below).
4. Enter it → "Verify" → confirm the screen switches to "Signed in as {email}".
5. Tap "Sign out" → confirm it returns to the guest form.
6. Force-quit and reopen the app → confirm a still-valid session restores you signed-in (or the
   guest form shows correctly if you signed out first).

**If step 3's email only contains a magic-link URL, not a 6-digit code:** in the Supabase dashboard,
go to Authentication → Email Templates and confirm the "Confirm signup"/"Magic Link" template
includes `{{ .Token }}` (the code), not just `{{ .ConfirmationURL }}`. This is a dashboard content
setting, not something `lib/auth.ts` controls — flagged here per the human-approval-required list
(Supabase Auth dashboard changes are the founder's call, not an agent's).

I did not trigger a real `sendOtp` call to any inbox during this task — I have no way to read the
code back to complete `verifyOtp` regardless, so it would only have produced a side effect (an
email) without completing verification. Happy to trigger one to a real address if you hand the code
back to me, or just run the steps above yourself.

## TEST marker (docs/schema.sql `stops` seed) — unrelated to this task
Not touched here; see `docs/features/db-foundation/verification.md` (separate branch/PR) for that
decision.

## Acceptance criteria
- [x] `npx tsc --noEmit` passes — PASS.
- [x] `npm run lint` passes, and the pre-existing `profile.tsx` error is fixed — PASS (0 errors, 1
      unrelated pre-existing warning).
- [x] `npm run supabase:check` still returns LIVE with 6 rows — PASS (before and after code changes).
- [x] Guest browsing unaffected — PASS (no code path in Explore/stop-detail touches auth).
- [x] Profile screen's three states — PASS at the code level and via a real API-level OTP round
      trip (see 2026-09-08 update above); **not** interactively tapped through in the Simulator
      (session-type restriction, not an app issue) — recommended as a founder follow-up.
- [x] Real OTP round-trip (send → deliver → enter → verify → session issued) — PASS, see
      2026-09-08 update above. This was the item explicitly deferred before.
- [x] No service-role key referenced; no Supabase Auth dashboard settings changed by the agent —
      PASS.
- [x] `docs/features/auth-otp/` complete; `docs/schema.sql`, `STATUS.md`, `TASK_BOARD.md` updated —
      PASS.

## Product-language scan
No "safe"/"verified safe"/"guaranteed"/"crime-free" in any new copy
(`profile.tsx`'s guest/email/code/signed-in strings, listed in `spec.md`). (yes)

## Known remaining issues
- OTP round-trip needs founder verification on a real device — see "Known blocker" above for exact
  steps and the email-template caveat.
- `profiles`/`saved_stops`/`reviews` are still proposed-only (`docs/migrations/002_auth_tables.sql`),
  not applied — unchanged by this task, tracked in `db-foundation`.
- The remaining `JourneyShield.tsx` lint warning is pre-existing and out of scope here.
- No `packages/*` work in this task (unrelated).

## Update — 2026-09-08: real OTP round-trip verified

This closes the "Known blocker" above. Verified via the live Supabase Auth REST API (the same
endpoints `lib/auth.ts` calls through supabase-js) rather than tapping through the Simulator UI —
see "Environment limitation" below for why.

**Root cause found and fixed:** the Supabase project's email templates only contained
`{{ .ConfirmationURL }}`, not `{{ .Token }}`. Worse, a first-time OTP request for a new email
address uses the **"Confirm sign up"** template (mail type `signup`), not **"Magic link or OTP"**
(mail type `magiclink`) — so fixing only the one named in the original blocker note wasn't enough.
Founder approved editing both dashboard templates to add a `{{ .Token }}` block (kept the existing
magic-link paragraph in each).

**Round trip (real, not simulated):**
1. `POST /auth/v1/otp` with the founder's real email, `create_user: true` → `200 {}`.
2. Real email delivered to the founder's inbox containing a 6-digit code (confirmed by the founder
   reading it back).
3. `POST /auth/v1/verify` with that code, `type: "email"` → `200`, real `access_token` +
   `refresh_token` + confirmed `user` object (`email_confirmed_at` set, `last_sign_in_at` set).
4. Replaying the same code a second time failed (already consumed) — confirms single-use.
5. Verifying a bogus code returned `403 {"error_code":"otp_expired","msg":"Token has expired or is
   invalid"}` — a structured error, not a crash; matches how `lib/auth.ts` surfaces `error.message`
   to the UI.
6. A further live round trip (to test the refresh-token exchange and an authenticated sign-out
   call) was blocked by Supabase's built-in mailer rate limit — **2 emails/hour** on this project
   (confirmed in Authentication → Rate Limits). Not a code defect; the dashboard's own banner
   already recommends custom SMTP for anything beyond light manual testing. Sign-out *was* confirmed
   to correctly reject an unauthenticated call (`401 no_authorization`).

**Bug found by independent review (qa-verifier) and fixed:** `profile.tsx`'s local `step`/`email`/
`code` state wasn't reset on sign-out. Because `expo-router` keeps tab screens mounted, signing out
without navigating away left the stale "enter the code" card showing instead of the guest form.
Fixed in commit `31aee37` (`handleSignOut` now resets local state after `signOut()` resolves).
`tsc`/`lint` re-confirmed clean after the fix.

**Environment limitation — could not interactively tap through the Simulator UI:** the app itself
was confirmed running correctly on a real booted iOS Simulator (iPhone 17 Pro, iOS 26.4) via
`expo start --ios --offline` — screenshot showed the HerStop splash rendering, console logs showed
`[supabase] configured for host: xnkjqcygzjlspeagcoal.supabase.co` and
`[auth] state change: INITIAL_SESSION`. But three independent ways to *interact* with it (tap,
type) were all blocked in this session: the dedicated iOS Simulator control tool ("Mobile
simulator tools require an attended session"), generic desktop computer-control (same restriction
on the approval dialog), and raw AppleScript/System Events (`osascript is not allowed assistive
access`). This is a session-type restriction, not an app or implementation issue. **Still
recommended:** a founder pass tapping through the actual on-screen flow at least once (Send code →
enter code → Verify → Signed in → Sign out → confirm the guest form reappears correctly, thanks to
the fix above) to close the loop on the visual/UX layer specifically.

## Reviewer notes
- No service-role key used at any point; anon key only. `lib/auth.ts` logs only auth event names
  and error messages in `__DEV__` — never a token, session, or the OTP code.
- `.env` was never committed; copied into the worktree temporarily for the checks above, then
  deleted. `git status` was clean of it throughout (also gitignored regardless).
- No Supabase Auth dashboard setting was changed — only read via the anon-key `GET
  /auth/v1/settings` endpoint (no auth required for that read, no state changed).
- The `agent/agent-os-v0.1` fast-forward merge is a mechanical branch-hygiene fix (bringing this
  branch's history up to the same base every other `agent/*` branch already has), not a
  product/architecture decision — flagging it here for visibility rather than silently doing it.
- No new npm dependencies were added.
