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

## Planned tables (not created — proposed in `docs/migrations/002_auth_tables.sql`, needs auth first)
Full column lists, constraints, and RLS policies live in the migration file — this is a summary.

- **`profiles`** — `id` (PK, = `auth.users.id`), `display_name`, timestamps. Fully private: only
  the owner can read/write their own row (no public SELECT). No signup trigger — the app upserts a
  profile row on first sign-in instead, to avoid an auth-schema change.
- **`saved_stops`** — `(id, user_id → auth.uid(), stop_id → stops.id, created_at)`, unique on
  `(user_id, stop_id)`. Fully private; every read/write scoped to `auth.uid()`. Unblocks
  saved-stops persistence.
- **`reviews`** — structured fields matching `CLAUDE.md`'s review model: `overall_feeling`,
  `lighting`, `restroom_quality`, `cleanliness`, `staff_kindness` (1–5 each), `loitering_concern`
  (`low`/`medium`/`high`), `would_stop_again` (bool), `time_of_visit` (`day`/`night`/`unknown`),
  optional `note` (≤280 chars), plus `is_hidden` for moderation takedowns. **Writes** are scoped to
  `auth.uid()` (author-only insert/update/delete); **reads of non-hidden rows are public**,
  intentionally — "browse without account" needs community reviews to inform anonymous users too.
  See the migration file for the full rationale and a documented known limitation (an author can
  currently un-hide their own moderated review; acceptable for v1, revisit with real moderation).

Note: `apps/mobile/lib/types.ts`'s current `Review` interface (`rating`/`body`) is an older
placeholder and doesn't match the structured fields above yet — update it when these tables are
actually wired up (tracked in `docs/features/db-foundation/spec.md`).

## Data-layer functions (`lib/api.ts`)
Live: `getStops()`, `getStopById(id)`. Stubs pending auth/DB: `getSavedStops(userId)`,
`toggleSaveStop(stopId)`, `getReviews(stopId)`. All keep the mock fallback for development.
