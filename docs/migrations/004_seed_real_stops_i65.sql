-- ############################################################
-- # DO NOT RUN — SUPERSEDED BY 006_ingest_real_stops.sql
-- # (marked 2026-10-12). Kept for history only.
-- #
-- # Running this after 005 FAILS: it inserts into `stops` without
-- # `source_id`, which 005 makes NOT NULL with no default. Running it
-- # before 005 would work but leaves a hand-curated 18-row set that
-- # 006 then has to reconcile. Apply 003 -> 005 -> 006 instead.
-- ############################################################

-- ============================================================
-- HerStop — seed real I-65 stops (West Lafayette -> Indianapolis),
-- replacing the fictional `stops` rows used for early UI development
--
-- PROPOSED — NOT YET APPLIED. Requires founder review + manual run
-- in the Supabase SQL Editor. No agent should execute this against
-- the live project (see .claude/rules/supabase-rules.md).
--
-- Depends on 003_reviews_privacy_and_moderation.sql being applied
-- FIRST. Not because this file touches reviews at all (it only
-- touches `stops`) — but 003 is what makes reviews behave sanely
-- (publish delay, hiding, banned authors) once real reviews start
-- landing on these real stops, so there's no reason to seed real
-- stops before 003 is live. Apply order: 003, then 004.
--
-- Source: docs/data/osm-i65-west-lafayette-indianapolis/beta-stops.json
-- + provenance.json — built from OpenStreetMap (Overpass API) +
-- Nominatim reverse geocoding, retrieved 2026-09-15. 18 real stops,
-- ODbL-licensed — any product surface showing this data must carry
-- "© OpenStreetMap contributors" (see that folder's README.md).
-- osm-way-229125508 (Lebanon Rest Area) is already excluded from the
-- source JSON per founder direction (tagged landuse=construction,
-- toilets=no in OSM).
--
-- Every id/name/address/latitude/longitude/categories value below is
-- copied EXACTLY from beta-stops.json — nothing invented, nothing
-- inferred, nothing rounded further than the source already was. Four
-- travel-centre stops (OSM highway=rest_area/services — no equivalent
-- category in the app's vocabulary of Gas/Restroom/Open Now/Well Lit)
-- have an empty `categories` array, exactly as retrieved — that is
-- the real, complete data, not a placeholder.
--
-- Idempotent: the delete below targets an explicit, fixed id list
-- (the six fictional test rows), and the insert uses
-- `on conflict (id) do update set ...` — safe to re-run this whole
-- file more than once.
-- ============================================================

begin;
set local lock_timeout = '5s';

-- ------------------------------------------------------------
-- Remove the six fictional stops used for early UI development.
--
-- Probed read-only via the anon key on 2026-09-15 (see
-- docs/features/community-reviews/db-verification.md §7) — the live
-- `stops` table contains exactly these six ids, id '1' currently
-- named "Willow Creek Plaza TEST" (renamed from the original
-- docs/schema.sql seed's "Willow Creek Plaza" at some point after
-- that file was first applied — a comment in a migration can't
-- re-verify that at apply time, so the founder should glance at the
-- pre-flight query in db-verification.md §7 before running this).
--
-- `on delete cascade` (declared on saved_stops.stop_id and
-- reviews.stop_id in docs/migrations/002_auth_tables.sql) also
-- removes any saved_stops/reviews rows pointing at these ids. That's
-- expected and fine: anything referencing these fictional seed stops
-- is itself test data (Maestro flows, manual QA taps), never a real
-- traveler's saved stop or review.
-- ------------------------------------------------------------
delete from stops
where id in ('1', '2', '3', '4', '5', '6');

-- ------------------------------------------------------------
-- Insert the 18 real I-65 corridor stops.
--
-- `tags = '[]'`, `rating = 0`, `review_count = 0` — these columns
-- exist for the old mock/seed data's display (structured amenity
-- chips, a pre-computed rating) but the app no longer reads any of
-- them for scoring or display (see docs/features/community-reviews/
-- spec.md §3: ratings/review counts now come from
-- get_stop_review_stats(), not these columns; a brand-new real stop
-- with zero reviews correctly shows "Limited Data", not a 0-star
-- rating). `badge` and `image_color` are left at their schema
-- defaults for the same reason — nothing displays them.
-- ------------------------------------------------------------
insert into stops (id, name, address, latitude, longitude, categories, tags, rating, review_count)
values
  ('osm-way-1365688111',   'Love''s Travel Stop',      '2400 East 200 North, Lafayette, IN 47905',             40.451915, -86.850101, ARRAY[]::text[], '[]', 0, 0),
  ('osm-way-571837327',    'BP',                        '2888 Old State Road 25, Fairfield Township, IN 47905', 40.457984, -86.846210, ARRAY['Gas'],     '[]', 0, 0),
  ('osm-way-283289437',    'Speedway',                  '4325 South Street, Lafayette, IN 47905',               40.416983, -86.824681, ARRAY['Gas'],     '[]', 0, 0),
  ('osm-node-12688099567', 'Meijer',                    'SR 26, Lafayette, Indiana 47905',                      40.416973, -86.813098, ARRAY['Gas'],     '[]', 0, 0),
  ('osm-way-1195033424',   'Circle K',                  '6533 State Rd 38 E, Lafayette, IN 47905',              40.373709, -86.780225, ARRAY['Gas'],     '[]', 0, 0),
  ('osm-way-1196146349',   'BP',                        'Yost Drive, Dayton, Indiana 47905',                    40.374797, -86.777605, ARRAY['Gas'],     '[]', 0, 0),
  ('osm-node-7759210731',  'BP',                        'SR 28, Frankfort, Indiana',                            40.261926, -86.650734, ARRAY['Gas'],     '[]', 0, 0),
  ('osm-way-230775623',    'Flying J Travel Center',    'West Cox Avenue, Lebanon, Indiana 46052',              40.033082, -86.473193, ARRAY[]::text[], '[]', 0, 0),
  ('osm-node-11182191149', 'Country Mark Gas Station',  '817 West South Street, Lebanon, IN 46052',             40.046409, -86.476222, ARRAY['Gas'],     '[]', 0, 0),
  ('osm-way-1545554017',   'Wally''s',                  '4155 Albert S. White Drive, Whitestown, IN 46075',     39.981809, -86.391202, ARRAY['Gas'],     '[]', 0, 0),
  ('osm-way-225347315',    'Love''s Travel Stop',      '4155 South Indianapolis Road, Whitestown, 46075',      39.979003, -86.395118, ARRAY[]::text[], '[]', 0, 0),
  ('osm-way-223165641',    'TA',                        '5930 Whitestown Parkway, Whitestown, IN 46075-9801',   39.947865, -86.357541, ARRAY[]::text[], '[]', 0, 0),
  ('osm-way-766083124',    'GetGo',                     '7011 Whitestown Parkway, Zionsville, IN 46077',        39.948949, -86.335764, ARRAY['Gas'],     '[]', 0, 0),
  ('osm-way-1026315492',   'Speedway',                  '6315 West 56th Street, Indianapolis, IN 46254',        39.852486, -86.271486, ARRAY['Gas'],     '[]', 0, 0),
  ('osm-node-12687832610', 'Meijer',                    '5347 Pike Plaza Road, Indianapolis, Indiana 46254',    39.828969, -86.253705, ARRAY['Gas'],     '[]', 0, 0),
  ('osm-way-220710454',    'Admiral Petroleum',         '3406 Lafayette Road, Indianapolis, IN 46222',          39.817079, -86.228673, ARRAY['Gas'],     '[]', 0, 0),
  ('osm-way-951355881',    'Phillips 66',               '3406 North Capitol Avenue, Indianapolis, IN 46208',    39.817583, -86.161915, ARRAY['Gas'],     '[]', 0, 0),
  ('osm-way-432174373',    'Phillips 66',               '2202 North Delaware Street, Indianapolis, IN 46205',   39.797618, -86.153768, ARRAY['Gas'],     '[]', 0, 0)
on conflict (id) do update set
  name       = excluded.name,
  address    = excluded.address,
  latitude   = excluded.latitude,
  longitude  = excluded.longitude,
  categories = excluded.categories;

commit;

-- ------------------------------------------------------------
-- Rollback: see docs/features/community-reviews/db-verification.md §7.
-- ------------------------------------------------------------
