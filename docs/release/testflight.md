# TestFlight release — founder steps

EAS Build is approved. `eas submit` is **not** — get founder sign-off before running it.
All steps below need the founder's Apple/EAS logins; an agent cannot do these.

## One-time setup (needs Apple Developer + EAS login)
1. `eas login` — log in with the EAS/Expo account.
2. Confirm Apple Developer Program membership (needed for a bundle ID + TestFlight).
3. From `apps/mobile/`: `eas init` — links this app to an EAS project (writes a project ID
   into `app.json`/`app.config`; review before committing).
4. Set the two client env vars as **EAS environment variables** (not committed to git):
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY` — this is the public anon key, safe to expose in a
     client bundle by design. Never set any other, more privileged Supabase key here or
     anywhere in app code/env — mobile only ever uses the public anon key.
   - `eas env:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value <url> --environment production`
   - repeat for the anon key. EAS cloud builds don't see your local gitignored `.env`, so
     this step is required or the app will silently fall back to mock data in the build.

## Build
```
eas build -p ios --profile production
```
Uses the `production` profile in `eas.json` (`autoIncrement: true`, so EAS bumps the build
number for you each run — no need to hand-edit `ios.buildNumber` in `app.json`).

Use `eas build -p ios --profile preview` for an internal-distribution build to test on a
personal device before a TestFlight submission.

## Submit (requires founder approval first)
```
eas submit -p ios --profile production
```
Needs an App Store Connect API key or Apple ID + app-specific password, entered interactively
or configured under `submit.production` in `eas.json` — left empty in this repo on purpose.
Do not add Apple IDs or API keys to `eas.json` without the founder present.

## Notes
- `ios.bundleIdentifier` is `com.adityadas.herstop`, `supportsTablet` is `false` (iPhone-only v1).
- No `development` build profile — `expo-dev-client` isn't installed yet.
- No secrets live in this repo; the anon key is public by design but still only ever
  set via EAS environment variables or a local gitignored `.env`.
