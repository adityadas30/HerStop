// HerStop crime-data proof of concept: FETCH step. RESEARCH ONLY, not production.
//
// Downloads a small, capped slice of the City of Chicago "Crimes - 2001 to Present" dataset
// (Socrata id ijzp-q8t2) through the portal's public, unauthenticated SODA API.
// No API key, no account, no database. Every response is cached under ./.cache/ (gitignored),
// so re-running is free and deterministic. Pass --refresh to download again.
//
// Usage (from the repo root):
//   node tools/crime-poc/fetch.mjs            # uses the cache when present
//   node tools/crime-poc/fetch.mjs --refresh  # re-download everything

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = join(HERE, '.cache');
const REFRESH = process.argv.includes('--refresh');

const RESOURCE_URL = 'https://data.cityofchicago.org/resource/ijzp-q8t2.json';
const METADATA_URL = 'https://data.cityofchicago.org/api/views/ijzp-q8t2.json';

// A fixed 12-month window keeps the run reproducible. The dataset lags about a week,
// so the window ends a week before the run date (2026-10-15).
const WINDOW_START = '2025-10-08T00:00:00';
const WINDOW_END = '2026-10-08T00:00:00'; // exclusive

// Study area for row-level analysis: a ~11 km x 13 km box on Chicago's Northwest Side.
// Its west edge deliberately reaches past Harlem Ave into suburbs that Chicago police do not
// cover, so the analysis can show what a coverage gap looks like. (Order: north, west, south, east.)
const STUDY_BOX = { north: 41.98, west: -87.84, south: 41.88, east: -87.68 };

// Politeness limits: small pages, a pause between requests, a hard cap on total rows.
const PAGE_SIZE = 10000;
const MAX_TOTAL_ROWS = 60000;
const PAUSE_MS = 1500;

// Only the columns the analysis needs. Block addresses and case numbers stay in the local cache.
const ROW_FIELDS = [
  'id', 'case_number', 'date', 'primary_type', 'description', 'location_description',
  'domestic', 'latitude', 'longitude', 'updated_on',
].join(',');

const windowClause = `date >= '${WINDOW_START}' AND date < '${WINDOW_END}'`;
const boxClause =
  `within_box(location, ${STUDY_BOX.north}, ${STUDY_BOX.west}, ${STUDY_BOX.south}, ${STUDY_BOX.east})`;

// Citywide questions answered by the server as small aggregate tables (no incident rows).
const AGGREGATE_QUERIES = {
  'agg-totals': {
    $select: 'count(*) as rows, count(distinct case_number) as cases, count(latitude) as with_coords, min(date) as min_date, max(date) as max_date, max(updated_on) as max_updated',
    $where: windowClause,
  },
  'agg-primary-type': {
    $select: 'primary_type, count(*) as n, count(latitude) as with_coords',
    $where: windowClause, $group: 'primary_type', $order: 'n DESC', $limit: '100',
  },
  'agg-location-description': {
    $select: 'location_description, count(*) as n',
    $where: windowClause, $group: 'location_description', $order: 'n DESC', $limit: '500',
  },
  'agg-gas-station-description': {
    $select: 'primary_type, description, domestic, count(*) as n, count(latitude) as with_coords',
    $where: `${windowClause} AND location_description = 'GAS STATION'`,
    $group: 'primary_type, description, domestic', $order: 'n DESC', $limit: '500',
  },
  // Daily counts for the last 45 days of the dataset show how recent days fill in late.
  'agg-recent-days': {
    $select: 'date_trunc_ymd(date) as day, count(*) as n',
    $where: "date >= '2026-08-25T00:00:00'", $group: 'day', $order: 'day', $limit: '100',
  },
};

// Row-level downloads (cached locally only).
const ROW_QUERIES = {
  'rows-study-box': { $where: `${windowClause} AND ${boxClause}` },
  'rows-gas-station-citywide': { $where: `${windowClause} AND location_description = 'GAS STATION'` },
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getJson(url) {
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}\n${await response.text()}`);
  }
  return response.json();
}

function buildUrl(params) {
  return `${RESOURCE_URL}?${new URLSearchParams(params).toString()}`;
}

// Returns cached JSON if present; otherwise downloads, saves and returns it.
async function cached(name, download) {
  const file = join(CACHE_DIR, `${name}.json`);
  if (!REFRESH && existsSync(file)) {
    console.log(`cache  ${name}`);
    return JSON.parse(await readFile(file, 'utf8'));
  }
  const data = await download();
  await writeFile(file, JSON.stringify(data));
  console.log(`fetch  ${name}`);
  await sleep(PAUSE_MS);
  return data;
}

// Pages through a row query, ordered by the stable row id so pages never overlap.
async function downloadRows(where, rowBudget) {
  const rows = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    if (rows.length >= rowBudget) {
      throw new Error(`Row cap reached (${MAX_TOTAL_ROWS}). Narrow the window or box.`);
    }
    const page = await getJson(buildUrl({
      $select: ROW_FIELDS, $where: where, $order: ':id', $limit: String(PAGE_SIZE), $offset: String(offset),
    }));
    rows.push(...page);
    console.log(`       page at offset ${offset}: ${page.length} rows`);
    if (page.length < PAGE_SIZE) return rows;
    await sleep(PAUSE_MS);
  }
}

async function main() {
  await mkdir(CACHE_DIR, { recursive: true });

  await cached('metadata', () => getJson(METADATA_URL));

  for (const [name, params] of Object.entries(AGGREGATE_QUERIES)) {
    await cached(name, () => getJson(buildUrl(params)));
  }

  let totalRows = 0;
  for (const [name, { $where }] of Object.entries(ROW_QUERIES)) {
    const rows = await cached(name, () => downloadRows($where, MAX_TOTAL_ROWS - totalRows));
    totalRows += rows.length;
    console.log(`       ${name}: ${rows.length} rows`);
  }

  await writeFile(join(CACHE_DIR, 'fetch-manifest.json'), JSON.stringify({
    fetchedAt: new Date().toISOString(),
    windowStart: WINDOW_START, windowEnd: WINDOW_END, studyBox: STUDY_BOX, totalRows,
  }, null, 2));
  console.log(`done   ${totalRows} rows total (cap ${MAX_TOTAL_ROWS})`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
