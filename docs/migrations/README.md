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
| `003_reviews_privacy_and_moderation.sql` | `reviews` (constraint + trigger + policy changes), `review_reports`, `hidden_reviews`, `banned_users`, functions `get_stop_reviews`, `get_stop_review_stats`, `report_review`, `hide_review`, `review_publish_delay`, `is_banned` | ⏳ proposed — not applied. Went through two security reviews before ever touching the live DB: 2026-09-10 (verdict BLOCK, on the original `blocked_users` design) and 2026-09-15 (verdict RUN AFTER FIXES, four fail-open findings — banned-user check never fired, minute-precision publish-delay oracle, deprecated `auth.role()` trigger gate, broken rollback ordering). All fixed in place — see the migration's revision-history comment and `docs/features/community-reviews/db-verification.md` §5/§5b for apply steps, pre-flight check, and rollback SQL. |
| `004_seed_real_stops_i65.sql` | `stops` (delete 6 fictional test rows, insert 18 real OpenStreetMap-sourced rows) | ⏳ proposed — not applied. Depends on 003 being applied first. Source: `docs/data/osm-i65-west-lafayette-indianapolis/` (OpenStreetMap + Nominatim, ODbL, retrieved 2026-09-15). See `docs/features/community-reviews/db-verification.md` §7 for apply steps and rollback (development-only). |
