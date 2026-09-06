# Architecture — Current State (audit-based)

> Ground truth from a repository audit on **2026-09-06**. Where this conflicts with older docs,
> **this file wins.** Update it after meaningful structural changes.

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
    contexts/ hooks/ lib/ data/ constants/
    .env  .env.example
  packages/{ui,types,scoring}/   # EMPTY placeholders (no package.json yet)
  docs/
  CLAUDE.md
```

## Routes (verified)
- `app/index.tsx` → redirects to onboarding.
- `app/onboarding.tsx` → welcome + "decision support, not safety guarantees" disclaimer.
- `app/(tabs)/_layout.tsx` → tabs: **Explore, Safety, Journeys, Saved, Profile**.
  - `(tabs)/index.tsx` (Explore) — `getStops()`, search, filter chips, `StopCard` list → `/stop/[id]`.
  - `(tabs)/saved.tsx` — `useSavedStops()`; `(tabs)/safety.tsx`, `(tabs)/journeys.tsx` are placeholders.
  - `(tabs)/profile.tsx` — guest view (no auth yet).
- `app/stop/[id].tsx` — `getStopById(id)`; bookmark toggles in-memory saved context.

## Data flow (verified)
UI → `lib/api.ts` → `lib/supabase.ts` (anon key, AsyncStorage) with fallback to `data/mock-stops.ts`.
- `getStops()` / `getStopById()` query Supabase, map rows via `dbToStopData`, else fall back to mock.
- `getSavedStops()`, `toggleSaveStop()`, `getReviews()` are **stubs** (return empty / `{saved:false}`).
- Saved state = **in-memory only** (`contexts/saved-stops.tsx`); not persisted, not user-scoped.

## Backend (verified)
- Schema in `docs/schema.sql`: `stops` (text PK, public-read RLS) + 6 seed rows. No `saved_stops` /
  `reviews` / `profiles` tables yet.
- `.env` has real-format `EXPO_PUBLIC_SUPABASE_URL` / `_ANON_KEY`, but the project host returns
  **NXDOMAIN** → live reads fail, app serves mock. See `docs/features/db-live-reads/`.

## Known differences vs older docs
- Older `architecture.md` lists tabs as "Discover, Saved, Profile"; reality is 5 tabs (above).
- Historical "placeholder .env" theory is wrong — values are real-format but point at a dead project.

## Known issues / risks
Dead Supabase project host · saved stops don't persist · no test runner · `packages/*` empty.

## Commands
See `docs/agent-os/COMMANDS.md`.
