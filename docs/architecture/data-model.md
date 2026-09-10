# Data Model

Canonical SQL: `docs/schema.sql`. App-side types: `apps/mobile/lib/types.ts`.
UI shape: `StopData` in `apps/mobile/data/mock-stops.ts`. Mapping: `dbToStopData()` in `lib/api.ts`.

## `stops` (exists)
| Column | Type | Notes |
|--------|------|-------|
| `id` | text PK | matches route `stop/[id]` and mock ids "1"–"6" |
| `name`, `address` | text | |
| `latitude`, `longitude` | float8 | default 0 |
| `badge` | text | `'recommended' \| 'good'` (check constraint) |
| `categories` | text[] | e.g. Gas, Restroom, Well Lit, Open Now |
| `tags` | jsonb | `[{label, icon}]` (SF Symbol name) |
| `rating` | float4 | |
| `review_count` | int | drives "Limited Data" when low |
| `image_url` | text null | |
| `image_color` | text | placeholder hero color |
| `created_at` | timestamptz | |

RLS: `enable row level security` + `Public read access` (`for select using (true)`). No write policies.

## Planned tables (not created — need auth first)
- **`saved_stops`** — `(user_id → auth.uid(), stop_id → stops.id, created_at)`. Writes scoped to
  `auth.uid()`. Unblocks saved-stops persistence.
- **`reviews`** — structured fields (feeling, lighting, restroom, cleanliness, staff, loitering,
  time_of_visit, would_stop_again, note). Tied to authenticated user; moderation/reporting in mind.
- **`profiles`** — minimal, protected per user.

## Data-layer functions (`lib/api.ts`)
Live: `getStops()`, `getStopById(id)`. Stubs pending auth/DB: `getSavedStops(userId)`,
`toggleSaveStop(stopId)`, `getReviews(stopId)`. All keep the mock fallback for development.
