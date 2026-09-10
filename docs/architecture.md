# HerStop — Architecture

> **Intended design.** For what actually exists right now, read
> `docs/architecture/current-state.md` — it is audit-based and **it wins** wherever the two
> disagree.

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
    _layout.tsx       # Tab navigator — Explore, Safety, Journeys, Saved, Profile
    index.tsx         # Explore tab — search + filters + stop results
    safety.tsx        # Safety (placeholder)
    journeys.tsx      # Journeys (placeholder)
    saved.tsx         # Saved stops (persisted once signed in)
    profile.tsx       # Profile / email-OTP sign-in
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
| Backend | Supabase | Auth (email OTP) verified working; live `stops` reads confirmed |
| Maps | Google Maps APIs | Routes + Places — phase 2 |
| Analytics | PostHog | Phase 3 |
| Errors | Sentry | Phase 3 |

## Key Design Decisions

- **No map in v1 shell** — map view added when Google Maps is integrated
- **Browse without an account** — auth gates saving and reviewing, never browsing
- **Mock fallback stays** — `lib/api.ts` falls back to `data/mock-stops.ts` when Supabase is
  unreachable, so the app is always demoable. Removing it is a founder decision.
- **Scoring is a pure package** — `packages/scoring` has zero RN deps, testable in isolation
  (planned; the directory is still empty)
- **Shared types in `packages/types`** — shared between mobile and any future web surface
  (planned; the directory is still empty)

## Scoring model v1
community reviews **70%** · area safety context **20%** · confidence **10%**.
Low review count forces **Limited Data**. Weak lighting plus nighttime lowers recommendations.
Repeated loitering concerns lower them strongly. Output is a recommendation band
(Recommended Stop / Good Option / Use Caution / Limited Data) — never a safety verdict.

## Review model
Structured fields: overall feeling · lighting · restroom quality · cleanliness · staff kindness ·
loitering concern / strange vibe · would stop again alone · short optional note · time of visit.
Designed with moderation, reporting, abuse prevention, and privacy in mind.
