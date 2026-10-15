#!/usr/bin/env node
// ============================================================
// HerStop — real stop ingestion from OpenStreetMap
//
// REAL SOURCE (OSM Overpass API) -> normalization -> dedup -> idempotent
// SQL upsert migration, ready for a human to review and run in the
// Supabase SQL Editor (this repo's migration-first workflow — see
// docs/migrations/README.md). This script never touches the live database
// itself: it has no Supabase credentials and makes no Supabase calls.
//
// Usage (from apps/mobile/):
//   node scripts/ingest-osm-stops.mjs [corridor-slug]
// With no argument, ingests every corridor in CORRIDORS below.
//
// Requires the schema fields added by docs/migrations/005_stops_provider_fields.sql
// (source, source_id, stop_type) — run that migration before running the
// migration this script generates.
//
// Data source: OpenStreetMap, via the public Overpass API + Nominatim
// reverse geocoding. ODbL-licensed — any product surface showing this data
// must carry "© OpenStreetMap contributors" (already on Explore + stop
// detail, see docs/data/*/README.md).
// ============================================================

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');

// Primary + fallback mirrors — the main instance (overpass-api.de) is
// sometimes too busy (HTTP 504) to answer a corridor-sized query. Both are
// official/community Overpass API mirrors, same query semantics.
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.osm.ch/api/interpreter',
];
const NOMINATIM_ENDPOINT = 'https://nominatim.openstreetmap.org/reverse';
const USER_AGENT = 'HerStop-ingest/0.1 (+https://github.com/adityadas0309/herstop)';
const NOMINATIM_RATE_LIMIT_MS = 1100; // Nominatim usage policy: max 1 req/sec.
const DEDUP_RADIUS_METERS = 300;

// ------------------------------------------------------------
// Corridors — the founder-approved geography for the beta stop set
// (docs/agent-os/STATUS.md, 2026-09-10 decision). Add a new corridor here
// to extend coverage; nothing else in this script is corridor-specific.
// ------------------------------------------------------------
const CORRIDORS = [
  {
    slug: 'osm-i65-west-lafayette-indianapolis',
    description: 'West Lafayette, Indiana -> Indianapolis, Indiana along I-65',
    highwayRef: 'I 65',
    bbox: { south: 39.8, west: -87.0, north: 40.47, east: -86.1 },
  },
];

// OSM tag -> the app's existing display category vocabulary
// (apps/mobile/data/mock-stops.ts FILTERS). Anything with no mapping is
// left out of `categories` rather than guessing — that's real, complete
// data, not a placeholder.
function categoriesFromTags(tags) {
  const categories = [];
  if (tags.amenity === 'fuel') categories.push('Gas');
  if (tags.toilets === 'yes') categories.push('Restroom');
  return categories;
}

function stopTypeFromTags(tags) {
  if (tags.amenity === 'fuel') return 'fuel';
  if (tags.amenity === 'truck_stop') return 'truck_stop';
  if (tags.highway === 'rest_area') return 'rest_area';
  if (tags.highway === 'services') return 'services';
  return 'unknown';
}

function isLifecycleTagged(tags) {
  return Object.keys(tags).some(
    (k) => k.startsWith('disused:') || k.startsWith('abandoned:') || k.startsWith('was:'),
  );
}

// Not open/operational per OSM's own tags — e.g. a rest area still under
// construction. Distinct from isLifecycleTagged (disused/abandoned/was:*
// prefixes): this catches a feature that's tagged as never having opened yet.
function isNonOperational(tags) {
  return tags.landuse === 'construction' || tags.construction !== undefined;
}

function nameFromTags(tags) {
  return tags.name ?? tags.brand ?? null;
}

async function overpassQuery(bbox, highwayRef) {
  const { south, west, north, east } = bbox;
  const query = `[out:json][timeout:120];
way["highway"="motorway"]["ref"~"${highwayRef}"](${south},${west},${north},${east})->.corridor;
(
  node(around.corridor:1500)["amenity"="fuel"];
  way(around.corridor:1500)["amenity"="fuel"];
  node(around.corridor:1500)["highway"="rest_area"];
  way(around.corridor:1500)["highway"="rest_area"];
  node(around.corridor:1500)["highway"="services"];
  way(around.corridor:1500)["highway"="services"];
  node(around.corridor:1500)["amenity"="truck_stop"];
  way(around.corridor:1500)["amenity"="truck_stop"];
);
out center tags;`;

  let lastError;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'User-Agent': USER_AGENT,
          Accept: '*/*',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `data=${encodeURIComponent(query)}`,
      });
      if (!res.ok) {
        lastError = new Error(`Overpass request failed: HTTP ${res.status} ${await res.text()}`);
        console.warn(`  ${endpoint} -> HTTP ${res.status}, trying next endpoint if any`);
        continue;
      }
      return await res.json();
    } catch (e) {
      lastError = e;
      console.warn(`  ${endpoint} -> ${e.message}, trying next endpoint if any`);
    }
  }
  throw lastError;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function reverseGeocode(lat, lon) {
  await sleep(NOMINATIM_RATE_LIMIT_MS);
  const url = `${NOMINATIM_ENDPOINT}?format=jsonv2&lat=${lat}&lon=${lon}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.address ?? null;
}

function addressFromOsmTags(tags) {
  const houseNumber = tags['addr:housenumber'];
  const street = tags['addr:street'];
  const city = tags['addr:city'];
  const state = tags['addr:state'];
  const postcode = tags['addr:postcode'];
  if (!street && !city) return null;
  const line1 = [houseNumber, street].filter(Boolean).join(' ');
  const line2 = [city, state].filter(Boolean).join(', ');
  return [line1, line2, postcode].filter(Boolean).join(', ');
}

function addressFromNominatim(addr) {
  if (!addr) return null;
  const houseNumber = addr.house_number;
  const road = addr.road;
  const city = addr.city ?? addr.town ?? addr.village;
  const state = addr.state;
  const postcode = addr.postcode;
  if (!road && !city) return null;
  const line1 = [houseNumber, road].filter(Boolean).join(' ');
  const line2 = [city, state].filter(Boolean).join(', ');
  return [line1, line2, postcode].filter(Boolean).join(', ');
}

function haversineMeters(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function tagCompleteness(tags) {
  return Object.keys(tags).length;
}

/** Cluster same-name features within DEDUP_RADIUS_METERS, keep the most complete tag set. */
function dedupe(elements) {
  const clusters = [];
  for (const el of elements) {
    const name = nameFromTags(el.tags);
    const point = { lat: el.lat, lon: el.lon };
    const existing = clusters.find(
      (c) => c.name === name && haversineMeters(c.point, point) <= DEDUP_RADIUS_METERS,
    );
    if (!existing) {
      clusters.push({ name, point, el });
    } else if (tagCompleteness(el.tags) > tagCompleteness(existing.el.tags)) {
      existing.el = el;
      existing.point = point;
    }
  }
  return clusters.map((c) => c.el);
}

async function ingestCorridor(corridor) {
  console.log(`\n[${corridor.slug}] querying Overpass...`);
  const raw = await overpassQuery(corridor.bbox, corridor.highwayRef);
  const rawElements = raw.elements ?? [];
  console.log(`[${corridor.slug}] ${rawElements.length} raw elements`);

  const withCenter = rawElements.map((el) => ({
    type: el.type,
    id: el.id,
    tags: el.tags ?? {},
    lat: el.type === 'node' ? el.lat : el.center?.lat,
    lon: el.type === 'node' ? el.lon : el.center?.lon,
  }));

  const named = withCenter.filter(
    (el) =>
      nameFromTags(el.tags) &&
      !isLifecycleTagged(el.tags) &&
      !isNonOperational(el.tags) &&
      el.lat &&
      el.lon,
  );
  console.log(`[${corridor.slug}] ${named.length} named, non-lifecycle candidates`);

  const deduped = dedupe(named);
  console.log(`[${corridor.slug}] ${deduped.length} after dedup (~${DEDUP_RADIUS_METERS}m radius)`);

  const stops = [];
  let reverseGeocodeCount = 0;
  for (const el of deduped) {
    let address = addressFromOsmTags(el.tags);
    let addressSource = 'osm_tags';
    if (!address) {
      const nominatimAddr = await reverseGeocode(el.lat, el.lon);
      address = addressFromNominatim(nominatimAddr);
      addressSource = 'nominatim_reverse_geocode';
      reverseGeocodeCount += 1;
    }
    if (!address) continue; // No usable address from either source — skip rather than invent one.

    stops.push({
      id: `osm-${el.type}-${el.id}`,
      source: 'openstreetmap',
      source_id: `${el.type}/${el.id}`,
      name: nameFromTags(el.tags),
      address,
      address_source: addressSource,
      latitude: el.lat,
      longitude: el.lon,
      categories: categoriesFromTags(el.tags),
      stop_type: stopTypeFromTags(el.tags),
    });
  }
  console.log(`[${corridor.slug}] ${stops.length} final stops (${reverseGeocodeCount} reverse-geocoded)`);

  return {
    stops,
    provenance: {
      retrieved_at: new Date().toISOString(),
      retrieved_at_source: 'script run time (client clock)',
      corridor: {
        slug: corridor.slug,
        description: corridor.description,
        bbox_south_west_north_east: [
          corridor.bbox.south,
          corridor.bbox.west,
          corridor.bbox.north,
          corridor.bbox.east,
        ],
      },
      overpass_endpoints: OVERPASS_ENDPOINTS,
      nominatim_endpoint: NOMINATIM_ENDPOINT,
      nominatim_rate_limit: 'max 1 request/sec, enforced with a 1.1s sleep between calls',
      raw_overpass_element_count: rawElements.length,
      named_non_lifecycle_count: named.length,
      deduplicated_count: deduped.length,
      final_stop_count: stops.length,
      nominatim_reverse_geocode_count: reverseGeocodeCount,
      note:
        'Unlike the original hand-curated docs/data/osm-i65-west-lafayette-indianapolis dataset ' +
        '(18 of 42 clusters, manually selected for corridor spread), this automated run keeps ' +
        'every deduplicated, named, addressable stop found in the corridor rather than making a ' +
        'subjective selection — that keeps the pipeline repeatable with no manual step.',
    },
  };
}

function sqlQuote(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlArray(values) {
  if (values.length === 0) return 'ARRAY[]::text[]';
  return `ARRAY[${values.map(sqlQuote).join(', ')}]`;
}

function generateMigration(allStops) {
  const values = allStops
    .map(
      (s) =>
        `  (${sqlQuote(s.id)}, ${sqlQuote(s.source)}, ${sqlQuote(s.source_id)}, ${sqlQuote(s.name)}, ` +
        `${sqlQuote(s.address)}, ${s.latitude}, ${s.longitude}, ${sqlArray(s.categories)}, ` +
        `${sqlQuote(s.stop_type)}, '[]'::jsonb, 0, 0)`,
    )
    .join(',\n');

  return `-- ============================================================
-- HerStop — real stops from OpenStreetMap (generated)
--
-- GENERATED by apps/mobile/scripts/ingest-osm-stops.mjs — do not hand-edit;
-- re-run the script and regenerate instead. PROPOSED — NOT YET APPLIED.
-- Requires: 002, 003, 005 applied first (005 adds the source/source_id/
-- stop_type columns this migration writes to).
--
-- Generated at: ${new Date().toISOString()}
-- Source: OpenStreetMap via Overpass API + Nominatim, ODbL-licensed — any
-- product surface showing this data must carry "© OpenStreetMap contributors".
--
-- Also removes the six fictional dev-seed rows (ids '1'-'6' from
-- docs/schema.sql) if still present, same cleanup docs/migrations/
-- 004_seed_real_stops_i65.sql proposed — this migration supersedes 004
-- (see docs/migrations/README.md).
--
-- Idempotent: on conflict (source, source_id) do update — safe to re-run.
-- ============================================================

begin;
set local lock_timeout = '5s';

delete from stops
where id in ('1', '2', '3', '4', '5', '6') and source = 'manual';

insert into stops
  (id, source, source_id, name, address, latitude, longitude, categories, stop_type, tags, rating, review_count)
values
${values}
on conflict (source, source_id) do update set
  name       = excluded.name,
  address    = excluded.address,
  latitude   = excluded.latitude,
  longitude  = excluded.longitude,
  categories = excluded.categories,
  stop_type  = excluded.stop_type;

commit;

-- ------------------------------------------------------------
-- Rollback (development only):
-- delete from stops where source = 'openstreetmap';
-- ------------------------------------------------------------
`;
}

async function main() {
  const requestedSlug = process.argv[2];
  const corridors = requestedSlug
    ? CORRIDORS.filter((c) => c.slug === requestedSlug)
    : CORRIDORS;
  if (corridors.length === 0) {
    console.error(`No corridor matches "${requestedSlug}". Known: ${CORRIDORS.map((c) => c.slug).join(', ')}`);
    process.exit(1);
  }

  const allStops = [];
  for (const corridor of corridors) {
    const { stops, provenance } = await ingestCorridor(corridor);
    allStops.push(...stops);

    const outDir = join(repoRoot, 'docs', 'data', corridor.slug);
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, 'beta-stops.json'), JSON.stringify(stops, null, 2) + '\n');
    writeFileSync(join(outDir, 'provenance.json'), JSON.stringify(provenance, null, 2) + '\n');
    console.log(`[${corridor.slug}] wrote docs/data/${corridor.slug}/{beta-stops,provenance}.json`);
  }

  if (allStops.length === 0) {
    console.error('\nNo stops obtained from any corridor — not writing a migration.');
    process.exit(1);
  }

  const migrationPath = join(repoRoot, 'docs', 'migrations', '006_ingest_real_stops.sql');
  writeFileSync(migrationPath, generateMigration(allStops));
  console.log(`\nWrote ${migrationPath} (${allStops.length} stops total, not yet applied).`);
}

main().catch((e) => {
  console.error('Ingestion failed:', e);
  process.exit(1);
});
