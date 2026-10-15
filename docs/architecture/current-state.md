# Architecture — Current State (audit-based)

> Ground truth from a repository audit. Original audit **2026-09-06**; re-audited **2026-09-10**
> (auth, saved stops, branches). Where this conflicts with older docs, **this file wins.**
> Update it after meaningful structural changes.

## Stack (verified)
Monorepo, **npm** (`package-lock.json`). Node `.nvmrc` = `lts/*`.
Expo `~54.0.33` · expo-router `~6.0.23` · React Native `0.81.5` · React `19.1.0` ·
`@supabase/supabase-js ^2.104.0` · TypeScript `~5.9.2` (strict) · ESLint via `eslint-config-expo` (flat).
`app.json`: typed routes + React Compiler + new architecture enabled.

## Layout (verified)
```
herstop/
  apps/mobile/            # the app (all config lives here, not at root)
    app/                  # Expo Router routes
    components/ components/ui/
    contexts/             # auth.tsx, saved-stops.tsx
    hooks/ lib/ data/ constants/
    scripts/              # supabase-check.mjs, rls-check.mjs (read-only live checks)
    .maestro/             # staged E2E flows — Maestro NOT installed
    .env  .env.example
  packages/{ui,types,scoring}/   # EMPTY placeholders (no package.json yet)
  docs/
  CLAUDE.md
```

## Branches (2026-09-10)
Integration branch: `agent/agent-os-v0.2` — contains every earlier `agent/*` branch; backed up to
origin, not merged. `dev` = `origin/dev` = `60749f0`, healthy, behind it. `main` is further behind.
Cut new work from the integration branch. Details: `docs/agent-os/STATUS.md`.

## Routes (verified)
- `app/_layout.tsx` → `ThemeProvider` › `AuthProvider` › `SavedStopsProvider` › `Stack`.
  Auth is outermost so the saved-stops context can read the signed-in user.
- `app/index.tsx` → redirects to onboarding.
- `app/onboarding.tsx` → welcome + "decision support, not safety guarantees" disclaimer.
- `app/(tabs)/_layout.tsx` → tabs: **Explore, Safety, Journeys, Saved, Profile**.
  - `(tabs)/index.tsx` (Explore) — `getStops()`, search, filter chips, `StopCard` list → `/stop/[id]`.
  - `(tabs)/saved.tsx` — `useSavedStops()`; guests see a sign-in invitation, browsing is not blocked.
  - `(tabs)/safety.tsx`, `(tabs)/journeys.tsx` — placeholders.
  - `(tabs)/profile.tsx` — email OTP sign-in: enter email → enter 6-digit code → signed in; sign-out
    resets the local step/email/code state.
- `app/stop/[id].tsx` — `getStopById(id)`; bookmark calls `toggleSaved`. A guest tapping save is
  routed to Profile to sign in, and the pending save completes on return.

## Auth (verified)
Supabase email OTP. `lib/auth.ts` wraps `sendOtp` / `verifyOtp` / `signOut` / `getSession` /
`onAuthStateChange`; `contexts/auth.tsx` exposes `useAuth()` (`user`, `isGuest`, `loading`, …).
Session persisted via AsyncStorage in `lib/supabase.ts`. **Verified end-to-end against the live API**
(real email → real code → real session, 2026-09-08). Not yet tapped through on a device.
See `docs/features/auth-otp/verification.md`.

## Data flow (verified)
UI → `lib/api.ts` → `lib/supabase.ts` (anon key, AsyncStorage) with fallback to `data/mock-stops.ts`.
- `getStops()` / `getStopById()` query Supabase, map rows via `dbToStopData`, else fall back to mock.
- `getSavedStops(userId)` — real: selects `saved_stops` for the user (RLS-scoped). No mock data on
  error — returns `[]` and logs it, because inventing saved stops would be wrong.
- `toggleSaveStop(stopId, nextSaved)` — real: upsert with `ignoreDuplicates` (save) or delete
  (unsave); user id taken from the session, never the caller.
- `getReviews()` — **still a stub** (returns `[]`). `lib/types.ts`'s `Review` (`rating`/`body`)
  does not yet match the structured columns in the proposed `reviews` table.
- `contexts/saved-stops.tsx` — loads saved ids on sign-in, clears on sign-out, optimistic toggle
  with rollback on error. The Saved list is derived from the `getStops()` catalog (live, with mock
  fallback), not from `MOCK_STOPS`.

## Backend (verified 2026-09-10)
- One Supabase project, host `xnkjqcygzjlspeagcoal.supabase.co` (from `apps/mobile/.env`; no
  staging project exists). Live reads work: `npm run supabase:check` → LIVE, 6 rows incl. the
  `Willow Creek Plaza TEST` marker.
- Applied schema: `docs/schema.sql` — `stops` only (text PK, public-read RLS, anon writes rejected
  with `42501`). No explicit grants; access relies on the project's default privileges + RLS.
- **Not applied:** `docs/migrations/002_auth_tables.sql` (`profiles`, `saved_stops`, `reviews`).
  `npm run rls:check` → 2/5, the 3 failures being "table does not exist yet".
- Consequence: saved-stops code is live but **inert** — a signed-in save hits `PGRST205` and rolls
  back by design until the migration runs.
- The app never writes `profiles` yet (the migration comment anticipates an app-side upsert on
  first sign-in; not built). Nothing reads it either.

## Known issues / risks
Migration 002 not applied (the current blocker) · no device tap-through of sign-in or saved stops ·
no test runner (no Jest; Maestro not installed) · `Review` type out of date · `packages/*` empty.

## Commands
See `docs/agent-os/COMMANDS.md`.
