# HerStop — Architecture

## Repo Structure

```
herstop/
  apps/
    mobile/          # Expo + React Native app (primary)
  packages/
    types/           # Shared TypeScript types (Stop, Review, User, etc.)
    scoring/         # Stop scoring logic (pure functions, no RN deps)
    ui/              # Shared UI primitives (future)
  docs/              # Architecture and product docs
```

## Mobile App Structure (`apps/mobile`)

```
app/
  _layout.tsx         # Root Stack — onboarding, tabs, stop detail
  onboarding.tsx      # Welcome screen (shown once, logic added with storage)
  (tabs)/
    _layout.tsx       # Tab navigator — Discover, Saved, Profile
    index.tsx         # Discover tab — route input + stop results
    saved.tsx         # Saved stops (requires auth)
    profile.tsx       # Profile / auth entry point
  stop/
    [id].tsx          # Stop detail — score, reviews, amenities

components/
  themed-text.tsx     # Text with theme-aware color
  themed-view.tsx     # View with theme-aware background
  haptic-tab.tsx      # Tab bar button with iOS haptics
  ui/
    icon-symbol.ios.tsx   # SF Symbols (iOS native)
    icon-symbol.tsx       # Fallback (non-iOS)

constants/
  theme.ts            # Brand colors + font families

hooks/
  use-color-scheme.ts       # Light/dark mode
  use-theme-color.ts        # Resolve color from theme by key
```

## Data Flow (MVP)

```
User enters destination
  → Route input (home screen)
  → [future] Google Routes API → waypoints
  → [future] Nearby Places lookup per waypoint
  → [future] Supabase: fetch reviews for places
  → scoring package: compute stop score
  → render stop cards (map + list)
  → user taps stop → stop/[id].tsx
  → user leaves review → Supabase insert
```

## Tech Stack

| Layer | Choice | Notes |
|-------|--------|-------|
| Framework | Expo SDK + React Native | iOS-first, Expo Router file-based routing |
| Language | TypeScript | Strict mode everywhere |
| Navigation | Expo Router v3 | File-based, typed routes |
| Styling | React Native StyleSheet | No heavy UI lib in v1 |
| Backend | Supabase | Auth (OTP), DB, Storage — phase 2 |
| Maps | Google Maps APIs | Routes + Places — phase 2 |
| Analytics | PostHog | Phase 3 |
| Errors | Sentry | Phase 3 |

## Key Design Decisions

- **No map in v1 shell** — map view added when Google Maps is integrated
- **No auth in v1 shell** — OTP login added with Supabase
- **Scoring is a pure package** — `packages/scoring` has zero RN deps, testable in isolation
- **Shared types in `packages/types`** — Stop, Review, User types shared between mobile and any future web surface
