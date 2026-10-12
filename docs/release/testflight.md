# TestFlight release checklist

EAS Build is approved. `eas submit` is **not**: get founder sign-off before running it.
Agents cannot do the founder steps (they need Apple/EAS/Supabase logins).

## Done by code (in repo)
- [x] `apps/mobile/eas.json`: `preview` (internal distribution, device build, `environment: preview`) and `production` (`environment: production`, `autoIncrement`) profiles; `appVersionSource: remote`; `submit.production` intentionally empty.
- [x] iOS privacy manifest in `app.json` → `ios.privacyManifests` (sources in `app-store-privacy.md`).
- [x] `ITSAppUsesNonExemptEncryption: false`, location permission string, bundle ID `com.adityadas.herstop`, iPhone-only.
- [x] In-app privacy, support, safety disclosure screens and in-app account deletion.
- [x] App Store privacy-label answers and draft listing copy: `app-store-privacy.md`.
- [x] No secrets in repo; only the public anon key is ever used by the client.
- [ ] Release builds without mock stops (t6) and Sentry (t9): in progress on other tasks; confirm merged before building.

## Founder steps, in order
1. **Restore the Supabase project** `xnkjqcygzjlspeagcoal` (currently inactive).
2. **Apply migrations** per `docs/migrations` runbook: 003 → 005 → 006 → 007 (007 = account deletion). Do not run 004. Run `npm run rls:check` and `npm run supabase:check` from `apps/mobile`.
3. **Apple Developer Program** membership active (bundle ID + TestFlight).
4. `eas login`, then from `apps/mobile/`: `eas init` (writes the project ID into app config; review before committing).
5. **Set EAS environment variables** (EAS cloud builds do not see your local `.env`; without them the build has no backend):
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY` (public anon key only; never any privileged key)
   - later, when Sentry lands: `EXPO_PUBLIC_SENTRY_DSN`
   ```
   eas env:create --name EXPO_PUBLIC_SUPABASE_URL --value <url> --environment preview --visibility plaintext
   eas env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <anon-key> --environment preview --visibility plaintext
   ```
   Repeat with `--environment production`. (Flags per current EAS CLI; check `eas env:create --help`.)
6. **Resend SMTP** in Supabase Auth settings so one-time codes reach outside testers (the default Supabase mailer is rate-limited and for team members only).
7. **Host privacy policy + support page**, set a real support email (`constants/app-info.ts`, `legal-content.ts`, `privacy-policy.md`). See `app-store-privacy.md` → URLs.
8. **Preview build** and test on a device: `eas build -p ios --profile preview`. Check sign-in, Explore with real data, review/save, account deletion.
9. **Production build**: `eas build -p ios --profile production` (build number auto-increments).
10. **App Store Connect**: create the app, enter privacy answers and listing copy from `app-store-privacy.md`, add a reviewer test account (never commit credentials).
11. **Submit** (founder approval first): `eas submit -p ios --profile production`. Needs an App Store Connect API key or Apple ID entered interactively. Do not put Apple IDs or keys in `eas.json`.
12. Add testers in TestFlight.

## Notes
- No `development` profile: `expo-dev-client` isn't installed.
- Simulator builds are not produced by `preview` (`ios.simulator: false`).
