# Migrations

Schema changes are **migration-first**: write the SQL here, review it, then a human runs it in the
Supabase SQL Editor. Nothing in this folder is executed automatically by an agent.

## Numbering
- `001` = the `stops` table, already applied. Canonical copy stays at `docs/schema.sql` (unchanged,
  don't duplicate it here) so existing links keep working.
- `002` and up = one file per migration, applied in order, never edited after being applied to the
  live project (write a new migration to change something later).

## Applying a migration (founder action)
1. Read the file top to bottom — check for anything marked "requires approval".
2. Open the Supabase dashboard → SQL Editor.
3. Paste and run.
4. Confirm with `npm run supabase:check` (from `apps/mobile/`) and any table-specific check noted
   in the migration's own comments.
5. Note the run in `docs/agent-os/STATUS.md`.

## Status
| File | Tables | Applied? |
|------|--------|----------|
| `docs/schema.sql` (001) | `stops` | ✅ yes |
| `002_auth_tables.sql` | `profiles`, `saved_stops`, `reviews` | ✅ yes — founder, 2026-09-10 (`rls:check` 5/5). Do not edit; write `003` for changes. |
| `003_reviews_privacy_and_moderation.sql` | `reviews` (constraint + trigger + policy changes), `review_reports`, `hidden_reviews`, `banned_users`, functions `get_stop_reviews`, `get_stop_review_stats`, `report_review`, `hide_review`, `review_publish_delay` | ⏳ proposed — not applied. Revised 2026-09-15 after a security review (verdict BLOCK on the original `blocked_users` design — see the migration's revision-history comment). See `docs/features/community-reviews/db-verification.md` for apply steps, pre-flight check, and rollback SQL. |
| `004_seed_real_stops_i65.sql` | **not created.** Source data (`docs/data/osm-i65-west-lafayette-indianapolis/`) was expected in a scratch folder that no longer exists — see `docs/features/community-reviews/db-verification.md` §7. Do not fabricate stop data; re-run the OSM/Nominatim extraction and hand the files to db-engineer again. |
