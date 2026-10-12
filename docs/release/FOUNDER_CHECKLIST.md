# Founder checklist: live backend → TestFlight

_Written 2026-10-12 (t13). Ordered, do top to bottom. Details live in the linked docs; this file
only sequences them. Agents never run these steps against the live project. No secrets go in this file._

Evidence today: every task t1–t9 is **Static** only, nothing is Live-verified
([audit](../agent-os/AUDIT_t1-t10.md)). Finishing this list is what unlocks live verification.

## 0. Machine prerequisite
- [ ] `node -v` works in a fresh terminal. If it dies with `Library not loaded: libsimdjson.29.dylib`,
  Homebrew node is broken: `brew reinstall node` (or use `nvm use 24`).

## 1. Supabase is up
Project `herstop` (`xnkjqcygzjlspeagcoal`, us-east-1) was restored and reported `ACTIVE_HEALTHY` on 2026-10-12.
- [ ] From `apps/mobile/`:
  ```bash
  npm run supabase:check
  ```
  **Expect:** `✅ LIVE — Supabase returned 6 row(s) from "stops".` (6 fictional rows, one has a
  `TEST` marker). `ENOTFOUND` = still paused/restoring.

## 2. Pre-flight SQL (read-only, Supabase SQL Editor)
Run the queries in [APPLY_RUNBOOK §1](../migrations/APPLY_RUNBOOK.md#1-pre-flight-read-only-sql-editor).
- [ ] `reviews` count = 0, no duplicate `(user_id, stop_id)`, owner `postgres`, 6 stops with ids `'1'`–`'6'`.
- [ ] **Decision needed, `saved_stops`:** live currently has **2 rows**. Run:
  ```sql
  select user_id, stop_id, created_at from saved_stops order by created_at;
  ```
  If any `stop_id` is in `'1'`–`'6'`, **migration 006 deletes those stops and the rows cascade-delete.**
  They are probably your own test data, but only you can confirm. If they matter, copy them out first;
  the fictional stops will not exist afterwards, so they cannot be restored in-app.
- [ ] Also confirm `select count(*) from reviews where stop_id in ('1','2','3','4','5','6');` is 0.

## 3. Apply migrations: 003 → 005 → 006 → 007 (never 004)
Open each file from `docs/migrations/`, paste the whole file in the SQL Editor, press Run, and check the
result before the next one. Files are idempotent and run inside `begin … commit` with a 5s lock timeout.
Full detail: [APPLY_RUNBOOK §2 and §4](../migrations/APPLY_RUNBOOK.md).

- [ ] **003** `003_reviews_privacy_and_moderation.sql` → expect `Success. No rows returned`.
- [ ] **005** `005_stops_provider_fields.sql` → expect `Success. No rows returned`.
- [ ] **006** `006_ingest_real_stops.sql` → expect `Success. No rows returned`.
- [ ] **007** `007_delete_my_account.sql` → expect `Success. No rows returned`.
  Security-sensitive (deletes from `auth.users`); read it first.
- [ ] Do NOT run `004_seed_real_stops_i65.sql` (DO-NOT-RUN, fails after 005, superseded by 006).
- [ ] Do NOT re-run `002` after 003.

Post-checks (from `apps/mobile/`):
- [ ] `npm run supabase:check` → **expect `44 row(s) from "stops"`**, no `TEST` row.
- [ ] `npm run rls:check` → **expect `13/13 passed.`**
- [ ] In the SQL Editor:
  ```sql
  select has_function_privilege('anon','public.delete_my_account()','execute');
  ```
  → **expect `false`**.
- [ ] If any number differs, stop and send the output to Lead rather than re-running things.

> Rollbacks: [APPLY_RUNBOOK → Rollback](../migrations/APPLY_RUNBOOK.md#rollback). 006's rollback does not restore the fictional rows.

## 4. Apple
Background: [testflight.md](testflight.md), [app-store-privacy.md](app-store-privacy.md).
- [ ] Apple Developer Program membership is active (paid) at <https://developer.apple.com/programs/>.
- [ ] Register the bundle ID **`com.adityadas.herstop`** (Certificates, Identifiers & Profiles → Identifiers).
- [ ] Create the app record in App Store Connect (My Apps → +) with that bundle ID.
  (`eas build`/`eas submit` can also register the identifier for you; either is fine.)

## 5. EAS (from `apps/mobile/`)
- [ ] `eas login`
- [ ] `eas init`: `app.json` has **no `extra.eas.projectId` today**. Review the diff before committing it.
- [ ] Create env vars for **both** environments (EAS cloud builds do not read `.env`). The URL and
  anon key are in Supabase → Project Settings → API. Anon/public key only, never the service-role key.
  ```bash
  eas env:create --name EXPO_PUBLIC_SUPABASE_URL      --value <url>      --environment preview    --visibility plaintext
  eas env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <anon-key> --environment preview    --visibility plaintext
  eas env:create --name EXPO_PUBLIC_SUPABASE_URL      --value <url>      --environment production --visibility plaintext
  eas env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <anon-key> --environment production --visibility plaintext
  ```
  Optional Sentry (DSN is a public identifier; see [testflight.md → Crash reporting](testflight.md)):
  ```bash
  eas env:create --name EXPO_PUBLIC_SENTRY_DSN --value <dsn> --environment preview    --visibility plaintext
  eas env:create --name EXPO_PUBLIC_SENTRY_DSN --value <dsn> --environment production --visibility plaintext
  ```
  Check flags with `eas env:create --help` if the CLI has changed.
- [ ] `eas build -p ios --profile preview` (internal distribution; your device must be registered).
- [ ] Install it and open Explore. **Expect real stops (44), not the fictional ones.**
  Sign-in for people outside your team needs step 6 first.
- [ ] Production build and submit are [testflight.md](testflight.md) steps 9–12. Founder sign-off first.

## 6. Resend (so OTP emails reach people outside your team)
Why: Supabase's built-in mailer is for team members and heavily limited (this project's was
**2 emails/hour**, see [auth-otp verification](../features/auth-otp/verification.md)).
Sources: Supabase [Send emails with custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
(which links Resend's [Send with Supabase SMTP](https://resend.com/docs/send-with-supabase-smtp)) and
Supabase [Production Checklist](https://supabase.com/docs/guides/deployment/going-into-prod).
I read the Supabase pages; I could not open Resend's page directly, so confirm the values below there.

- [ ] Create a Resend account and **add and verify a sending domain** (Resend → Domains). Add the DNS
  records Resend shows at your DNS host; wait for "Verified".
- [ ] Create an **API key** (Resend → API Keys; sending access is enough). Store it in your password
  manager; do not paste it into chat, a repo or EAS env vars.
- [ ] Supabase → Authentication → **SMTP Settings**
  (<https://supabase.com/dashboard/project/xnkjqcygzjlspeagcoal/auth/smtp>): enable custom SMTP and set:

  | Field | Value |
  |---|---|
  | Host | `smtp.resend.com` |
  | Port | `465` |
  | Username | `resend` |
  | Password | _the Resend API key_ |
  | Sender email | an address on the verified domain, e.g. `no-reply@<your-domain>` |
  | Sender name | `HerStop` |
- [ ] Supabase → Authentication → **Rate Limits**: raise the email rate limit. Supabase imposes a low
  default of **30 messages/hour** once custom SMTP is saved, to protect sender reputation. Pick a
  number that fits your beta.
- [ ] Authentication → Email Templates: both **Confirm signup** and **Magic Link** must contain
  `{{ .Token }}` (the code), not only `{{ .ConfirmationURL }}`. (Fixed earlier; re-check.)
- [ ] Request a sign-in code to an email address **outside your team**.
  **Expect:** the code arrives (check spam) and verifies.

## 7. Support email + hosted legal pages
- [ ] Choose a support email (can be an alias on the Resend domain).
- [ ] Replace `SUPPORT_EMAIL_PLACEHOLDER` in `apps/mobile/constants/app-info.ts` (a code change: tell
  Lead); update `constants/legal-content.ts` and [privacy-policy.md](privacy-policy.md) if needed.
- [ ] Host the privacy policy ([privacy-policy.md](privacy-policy.md)) and a support page at public URLs.
- [ ] Enter both URLs in App Store Connect ([app-store-privacy.md → URLs](app-store-privacy.md)).

## 8. What to tell Lead after each step
| After | Send Lead | Unblocks |
|---|---|---|
| 1 | Output of `supabase:check` (row count) | Confirms the DB is reachable. |
| 2 | Your decision on the 2 `saved_stops` rows (keep / OK to delete) | 006 may be applied. |
| 3 | `supabase:check` (expect 44), `rls:check` (expect 13/13), `has_function_privilege` (expect false). Anything that errored, verbatim. | Live E2E for reviews, save, report, delete-account; the t11 Simulator pass against real stops; audit rows t2/t4/t6 can move to Live. |
| 4 | "Developer Program active, bundle ID + app record created" | `eas init` / builds. |
| 5 | `eas init` diff committed; preview build URL | Device verification of a release build (no mock stops, error state). |
| 6 | "Test code to a non-team address arrived: yes/no", and the rate limit you set | Outside-tester sign-in; TestFlight beta. |
| 7 | Support email + the two public URLs | Placeholder code change; App Store metadata. |

Never send the Resend API key or any password. "Step N done" plus the expected outputs is enough.
