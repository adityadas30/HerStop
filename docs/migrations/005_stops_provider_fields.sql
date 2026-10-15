-- ============================================================
-- HerStop — add provider/source fields to `stops`
--
-- PROPOSED — NOT YET APPLIED. Requires founder review + manual run
-- in the Supabase SQL Editor (migration-first, see this folder's README).
--
-- Why: `stops` (docs/schema.sql, 001) has no way to say where a row came
-- from, what kind of place it is beyond the app's four display categories,
-- or when it was last refreshed from that source. That's needed for a real,
-- repeatable ingestion pipeline (apps/mobile/scripts/ingest-osm-stops.mjs)
-- to upsert idempotently instead of relying on a hand-picked `id` string
-- never colliding by accident.
--
-- All new columns are nullable or defaulted, so this is safe to run against
-- the live table as-is (six fictional rows or real rows, doesn't matter) —
-- nothing here deletes or renames existing data. `source`/`source_id` are
-- backfilled from the existing `id` for any row that predates this column
-- (source='manual') so the unique constraint below never fails on old rows.
-- ============================================================

begin;
set local lock_timeout = '5s';

alter table stops
  add column if not exists source text not null default 'manual',
  add column if not exists source_id text,
  add column if not exists stop_type text,
  add column if not exists updated_at timestamptz not null default now(),
  -- Reserved for a future real safety/crime-context provider. Must stay
  -- null until a real integration writes to it — never populate with
  -- invented or estimated data (see CLAUDE.md "Never fabricate").
  add column if not exists safety_context jsonb;

-- Backfill source_id for any row inserted before this column existed
-- (the six fictional dev-seed rows use their own numeric-string `id`).
update stops set source_id = id where source_id is null;

alter table stops
  alter column source_id set not null;

-- One row per (provider, provider's own id) — this is what makes a
-- re-run of the ingestion pipeline an upsert instead of a duplicate insert.
create unique index if not exists stops_source_source_id_key
  on stops (source, source_id);

-- Keep `updated_at` honest on every future write, including the ingestion
-- pipeline's upserts — the founder's or an agent's manual edits included.
create or replace function set_stops_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists stops_set_updated_at on stops;
create trigger stops_set_updated_at
  before update on stops
  for each row
  execute function set_stops_updated_at();

commit;

-- ------------------------------------------------------------
-- Rollback (development only — do not run against real traveler data
-- without checking nothing downstream reads these columns yet):
--
-- begin;
-- drop trigger if exists stops_set_updated_at on stops;
-- drop function if exists set_stops_updated_at();
-- drop index if exists stops_source_source_id_key;
-- alter table stops
--   drop column if exists source,
--   drop column if exists source_id,
--   drop column if exists stop_type,
--   drop column if exists updated_at,
--   drop column if exists safety_context;
-- commit;
-- ------------------------------------------------------------
