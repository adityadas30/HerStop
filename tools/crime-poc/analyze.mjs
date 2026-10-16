// HerStop crime-data proof of concept: ANALYZE step. RESEARCH ONLY, not production.
//
// Reads the responses cached by fetch.mjs and prints AGGREGATE statistics only.
// It never prints an individual incident, a block address, a case number or a coordinate.
// Output: a human-readable report on stdout, plus .cache/summary.json (also gitignored).
//
// Usage (from the repo root, after fetch.mjs):
//   node tools/crime-poc/analyze.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CACHE_DIR = join(dirname(fileURLToPath(import.meta.url)), '.cache');
const load = (name) => JSON.parse(readFileSync(join(CACHE_DIR, `${name}.json`), 'utf8'));

const RADII_M = [150, 400, 800];
const WINDOWS_DAYS = [90, 365];
const CLUSTER_M = 50; // gas-station-tagged block points closer than this are treated as one place
const GRID_M = 500; // cell size for the coverage check
const SMALL_COUNT = 3; // counts below this are shown as "fewer than 3"
const DAY_MS = 24 * 60 * 60 * 1000;

// ---------- Offense categories ----------
// A HerStop-proposed grouping (not an official one) of Chicago's primary_type values by how
// relevant they are to a traveller deciding where to stop. Domestic incidents are set aside first.
const PERSON_TYPES = new Set([
  'ROBBERY', 'BATTERY', 'ASSAULT', 'HOMICIDE', 'CRIMINAL SEXUAL ASSAULT', 'SEX OFFENSE',
  'KIDNAPPING', 'STALKING', 'INTIMIDATION', 'HUMAN TRAFFICKING',
]);
const PROPERTY_TYPES = new Set(['THEFT', 'CRIMINAL DAMAGE', 'BURGLARY', 'ARSON', 'CRIMINAL TRESPASS']);
// These mostly count police activity (arrests, stops), not things that happened to someone.
const ENFORCEMENT_TYPES = new Set([
  'NARCOTICS', 'OTHER NARCOTIC VIOLATION', 'WEAPONS VIOLATION', 'CONCEALED CARRY LICENSE VIOLATION',
  'PROSTITUTION', 'LIQUOR LAW VIOLATION', 'GAMBLING', 'INTERFERENCE WITH PUBLIC OFFICER',
  'PUBLIC PEACE VIOLATION', 'PUBLIC INDECENCY', 'OBSCENITY',
]);
const VEHICLE_DESCRIPTIONS = new Set(['THEFT FROM MOTOR VEHICLE', 'TO VEHICLE', 'BURGLARY FROM MOTOR VEHICLE']);

function categorize(row) {
  if (row.domestic === true || row.domestic === 'true') return 'domestic';
  if (row.primary_type === 'MOTOR VEHICLE THEFT' || VEHICLE_DESCRIPTIONS.has(row.description)) return 'vehicle';
  if (PERSON_TYPES.has(row.primary_type)) return 'person';
  if (PROPERTY_TYPES.has(row.primary_type)) return 'property_other';
  if (ENFORCEMENT_TYPES.has(row.primary_type)) return 'enforcement';
  return 'not_location_relevant'; // e.g. DECEPTIVE PRACTICE (fraud), OTHER OFFENSE
}
const TRAVELLER_RELEVANT = new Set(['person', 'vehicle']);

// ---------- Small helpers ----------
// Socrata dates are Chicago local time without a zone. We only compare them with each other,
// so treating them as UTC is consistent and deterministic.
const toMs = (isoLocal) => Date.parse(`${isoLocal.slice(0, 19)}Z`);
const pct = (part, whole) => (whole === 0 ? 0 : Math.round((1000 * part) / whole) / 10);

function percentile(sortedValues, p) {
  if (sortedValues.length === 0) return null;
  const rank = Math.ceil((p / 100) * sortedValues.length);
  return sortedValues[Math.min(sortedValues.length - 1, Math.max(0, rank - 1))];
}

function describe(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    n: sorted.length, min: sorted[0], p10: percentile(sorted, 10), median: percentile(sorted, 50),
    p90: percentile(sorted, 90), max: sorted[sorted.length - 1],
  };
}

function countBy(items, keyOf) {
  const counts = {};
  for (const item of items) {
    const key = keyOf(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

// Flat-earth distance in metres; accurate enough at city scale (< 1 km).
const M_PER_DEG_LAT = 111_320;
function metresBetween(a, b) {
  const mPerDegLon = M_PER_DEG_LAT * Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180);
  const dy = (a.lat - b.lat) * M_PER_DEG_LAT;
  const dx = (a.lon - b.lon) * mPerDegLon;
  return Math.sqrt(dx * dx + dy * dy);
}

// Spearman rank correlation (average ranks for ties).
function ranks(values) {
  const order = values.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
  const result = new Array(values.length);
  for (let i = 0; i < order.length;) {
    let j = i;
    while (j + 1 < order.length && order[j + 1][0] === order[i][0]) j++;
    for (let k = i; k <= j; k++) result[order[k][1]] = (i + j) / 2 + 1;
    i = j + 1;
  }
  return result;
}
function spearman(xs, ys) {
  const rx = ranks(xs), ry = ranks(ys);
  const mean = (rx.length + 1) / 2;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < rx.length; i++) {
    num += (rx[i] - mean) * (ry[i] - mean);
    dx += (rx[i] - mean) ** 2;
    dy += (ry[i] - mean) ** 2;
  }
  return Math.round((1000 * num) / Math.sqrt(dx * dy)) / 1000;
}

function topSet(values, k) {
  return new Set(values.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]).slice(0, k).map((x) => x[1]));
}

// ---------- Load ----------
const manifest = load('fetch-manifest');
const metadata = load('metadata');
const totals = load('agg-totals')[0];
const byPrimaryType = load('agg-primary-type');
const byLocation = load('agg-location-description');
const gasByDescription = load('agg-gas-station-description');
const recentDays = load('agg-recent-days');
const boxRows = load('rows-study-box');
const gasRowsCity = load('rows-gas-station-citywide');

const box = manifest.studyBox;
const withPoint = (row) => ({
  ...row, lat: Number(row.latitude), lon: Number(row.longitude), ms: toMs(row.date), category: categorize(row),
});
const incidents = boxRows.filter((r) => r.latitude && r.longitude).map(withPoint);

// ---------- 1. Citywide aggregates ----------
const cityRows = Number(totals.rows);
const citywide = {
  rows: cityRows,
  distinctCaseNumbers: Number(totals.cases),
  missingCoords: cityRows - Number(totals.with_coords),
  missingCoordsPct: pct(cityRows - Number(totals.with_coords), cityRows),
  minDate: totals.min_date, maxDate: totals.max_date, maxUpdatedOn: totals.max_updated,
  rowsUpdatedAt: new Date(metadata.rowsUpdatedAt * 1000).toISOString(),
  distinctLocationDescriptions: byLocation.length,
  primaryTypes: byPrimaryType.map((r) => ({
    type: r.primary_type, n: Number(r.n), missingCoordsPct: pct(Number(r.n) - Number(r.with_coords), Number(r.n)),
  })),
  topLocationDescriptions: byLocation.slice(0, 15).map((r) => ({ value: r.location_description ?? '(blank)', n: Number(r.n) })),
  travelRelatedPremises: byLocation
    .filter((r) => /GAS|CONVENIENCE|HIGHWAY|PARKING LOT|AIRPORT PARKING/.test(r.location_description ?? ''))
    .map((r) => ({ value: r.location_description, n: Number(r.n) })),
  blankLocationDescription: Number(byLocation.find((r) => r.location_description == null)?.n ?? 0),
  recentDays: recentDays.slice(-14).map((r) => ({ day: r.day.slice(0, 10), n: Number(r.n) })),
};

// Average daily volume across the 45-day series, excluding the last 8 days, as a baseline for lag.
const baselineDays = recentDays.slice(0, -8).map((r) => Number(r.n));
citywide.dailyBaselineMean = Math.round(baselineDays.reduce((s, n) => s + n, 0) / baselineDays.length);

// ---------- 2. Gas-station-tagged incidents citywide ----------
const gasCity = gasRowsCity.map((r) => ({ ...r, category: categorize(r) }));
const gasCategoryCounts = countBy(gasCity, (r) => r.category);
const gasTypeCounts = {};
for (const r of gasByDescription) gasTypeCounts[r.primary_type] = (gasTypeCounts[r.primary_type] ?? 0) + Number(r.n);
const gasHours = countBy(gasCity, (r) => Number(r.date.slice(11, 13)));
const nightGas = gasCity.filter((r) => { const h = Number(r.date.slice(11, 13)); return h >= 21 || h < 6; }).length;
const gasStation = {
  rows: gasCity.length,
  shareOfAllRowsPct: pct(gasCity.length, cityRows),
  missingCoords: gasCity.filter((r) => !r.latitude).length,
  domestic: gasCity.filter((r) => r.category === 'domestic').length,
  byCategory: gasCategoryCounts,
  byPrimaryType: gasTypeCounts,
  topDescriptions: gasByDescription.slice(0, 12).map((r) => ({
    type: r.primary_type, description: r.description, domestic: r.domestic, n: Number(r.n),
  })),
  nightShare9pmTo6amPct: pct(nightGas, gasCity.length),
  hourCounts: gasHours,
};

// ---------- 3. Study-box data quality ----------
const idCounts = countBy(boxRows, (r) => r.id);
const caseCounts = countBy(boxRows, (r) => r.case_number);
const pointCounts = countBy(incidents, (r) => `${r.latitude},${r.longitude}`);
const rowsPerPoint = Object.values(pointCounts);
// updated_on looks like a revision date, but most rows share one bulk re-stamp date,
// so it cannot tell us which records were reclassified.
const updatedOnDays = Object.entries(countBy(boxRows, (r) => (r.updated_on ?? 'none').slice(0, 10)))
  .sort((a, b) => b[1] - a[1]);
const multiRowCaseTypes = countBy(
  boxRows.filter((r) => caseCounts[r.case_number] > 1), (r) => r.primary_type);
const atMidnight = boxRows.filter((r) => r.date.slice(11, 19) === '00:00:00').length;
const quality = {
  rows: boxRows.length,
  duplicateIds: Object.values(idCounts).filter((n) => n > 1).length,
  caseNumbersWithMultipleRows: Object.values(caseCounts).filter((n) => n > 1).length,
  distinctCoordinatePoints: rowsPerPoint.length,
  rowsPerPoint: describe(rowsPerPoint),
  shareOfRowsAtPointsWith10PlusPct: pct(rowsPerPoint.filter((n) => n >= 10).reduce((s, n) => s + n, 0), incidents.length),
  multiRowCaseTypes,
  gasStationTaggedRows: boxRows.filter((r) => r.location_description === 'GAS STATION').length,
  updatedOnDistinctDays: updatedOnDays.length,
  updatedOnMostCommonDay: updatedOnDays[0][0],
  updatedOnMostCommonDayPct: pct(updatedOnDays[0][1], boxRows.length),
  timeExactlyMidnightPct: pct(atMidnight, boxRows.length),
};

// ---------- 4. Coverage grid over the study box ----------
const midLat = (box.north + box.south) / 2;
const mPerDegLon = M_PER_DEG_LAT * Math.cos((midLat * Math.PI) / 180);
const cols = Math.ceil(((box.east - box.west) * mPerDegLon) / GRID_M);
const rowsN = Math.ceil(((box.north - box.south) * M_PER_DEG_LAT) / GRID_M);
const cellOf = (p) => {
  const c = Math.min(cols - 1, Math.floor(((p.lon - box.west) * mPerDegLon) / GRID_M));
  const r = Math.min(rowsN - 1, Math.floor(((box.north - p.lat) * M_PER_DEG_LAT) / GRID_M));
  return r * cols + c;
};
const cellCounts = new Array(cols * rowsN).fill(0);
for (const p of incidents) cellCounts[cellOf(p)]++;
const emptyCells = new Set(cellCounts.map((n, i) => (n === 0 ? i : -1)).filter((i) => i >= 0));
const westOfHarlemCol = Math.floor(((-87.8067 - box.west) * mPerDegLon) / GRID_M); // Harlem Ave ≈ -87.8067
const coverage = {
  gridCells: cellCounts.length, cellSizeM: GRID_M,
  emptyCells: emptyCells.size,
  emptyCellsWestOfHarlemAve: [...emptyCells].filter((i) => i % cols < westOfHarlemCol).length,
  cellsWestOfHarlemAve: rowsN * westOfHarlemCol,
  cellsWithFewerThan10Rows: cellCounts.filter((n) => n > 0 && n < 10).length,
  rowsPerCell: describe(cellCounts),
};

// ---------- 5. Stop-level feasibility test ----------
// Candidate places = block-level points where at least one incident was tagged GAS STATION.
// They are NOT verified station locations: a block point can hold two stations, or a mis-tag.
const gasPoints = countBy(incidents.filter((r) => r.location_description === 'GAS STATION'), (r) => `${r.latitude},${r.longitude}`);
const rawPoints = Object.entries(gasPoints)
  .map(([key, n]) => { const [lat, lon] = key.split(',').map(Number); return { lat, lon, n }; })
  .sort((a, b) => b.n - a.n || a.lat - b.lat || a.lon - b.lon);

// Greedy clustering: the busiest point absorbs any tagged point within CLUSTER_M.
const clusters = [];
for (const p of rawPoints) {
  const home = clusters.find((c) => metresBetween(c, p) <= CLUSTER_M);
  if (home) home.members.push(p);
  else clusters.push({ lat: p.lat, lon: p.lon, members: [p] });
}

// Keep only places whose largest radius fits entirely inside the downloaded box.
const maxRadius = Math.max(...RADII_M);
const insideBox = (c) =>
  (box.north - c.lat) * M_PER_DEG_LAT >= maxRadius && (c.lat - box.south) * M_PER_DEG_LAT >= maxRadius &&
  (c.lon - box.west) * mPerDegLon >= maxRadius && (box.east - c.lon) * mPerDegLon >= maxRadius;
const places = clusters.filter(insideBox);

const dataEndMs = toMs(totals.max_date) + DAY_MS; // the end of the newest day present
const windowStartMs = Object.fromEntries(WINDOWS_DAYS.map((d) => [d, dataEndMs - d * DAY_MS]));

// Does a circle of this radius touch a coverage-grid cell with zero records?
function touchesEmptyCell(place, radius) {
  for (const i of emptyCells) {
    const cellCenter = {
      lat: box.north - ((Math.floor(i / cols) + 0.5) * GRID_M) / M_PER_DEG_LAT,
      lon: box.west + (((i % cols) + 0.5) * GRID_M) / mPerDegLon,
    };
    if (metresBetween(place, cellCenter) <= radius + GRID_M / 2) return true;
  }
  return false;
}

for (const place of places) {
  place.counts = {};
  const memberKeys = new Set(place.members.map((m) => `${m.lat},${m.lon}`));
  for (const r of incidents) {
    const d = metresBetween(place, r);
    if (d > maxRadius) continue;
    const atPremise = r.location_description === 'GAS STATION' && memberKeys.has(`${r.lat},${r.lon}`);
    for (const radius of RADII_M) {
      if (d > radius) continue;
      for (const days of WINDOWS_DAYS) {
        if (r.ms < windowStartMs[days]) continue;
        const key = `${radius}m_${days}d`;
        const c = (place.counts[key] ??= { all: 0, travellerRelevant: 0, atPremise: 0, byCategory: {} });
        c.all++;
        if (TRAVELLER_RELEVANT.has(r.category)) c.travellerRelevant++;
        if (atPremise) c.atPremise++;
        c.byCategory[r.category] = (c.byCategory[r.category] ?? 0) + 1;
      }
    }
  }
  place.partialCoverage800 = touchesEmptyCell(place, 800);
}

const countOf = (place, key, field = 'all') => place.counts[key]?.[field] ?? 0;
const feasibility = {
  rawTaggedPoints: rawPoints.length,
  clusteredPlaces: clusters.length,
  placesFullyInsideBox: places.length,
  distributions: {},
  premiseShareOfCountPct: {},
  radiusRatio800to150_365d: null,
  rankStability: {},
  smallCounts: {},
};
for (const radius of RADII_M) {
  for (const days of WINDOWS_DAYS) {
    const key = `${radius}m_${days}d`;
    const all = places.map((p) => countOf(p, key));
    const relevant = places.map((p) => countOf(p, key, 'travellerRelevant'));
    const premise = places.map((p) => countOf(p, key, 'atPremise'));
    feasibility.distributions[key] = { all: describe(all), travellerRelevant: describe(relevant), atPremise: describe(premise) };
    feasibility.premiseShareOfCountPct[key] = pct(premise.reduce((s, n) => s + n, 0), all.reduce((s, n) => s + n, 0));
    feasibility.smallCounts[key] = {
      placesWithRelevantFewerThan3: relevant.filter((n) => n < SMALL_COUNT).length,
      placesWithZeroRelevant: relevant.filter((n) => n === 0).length,
    };
  }
}
const ratios = places.filter((p) => countOf(p, '150m_365d') > 0).map((p) => countOf(p, '800m_365d') / countOf(p, '150m_365d'));
feasibility.radiusRatio800to150_365d = describe(ratios.map((r) => Math.round(r * 10) / 10));

// How much does the ranking of places change when only the radius or window changes?
const series = (key, field = 'all') => places.map((p) => countOf(p, key, field));
const top10Overlap = (a, b) => { const A = topSet(a, 10); return [...topSet(b, 10)].filter((i) => A.has(i)).length; };
const neighbourhood400 = places.map((p) => countOf(p, '400m_365d') - countOf(p, '400m_365d', 'atPremise'));
feasibility.rankStability = {
  spearman_150m_vs_800m_365d: spearman(series('150m_365d'), series('800m_365d')),
  spearman_150m_90d_vs_150m_365d: spearman(series('150m_90d'), series('150m_365d')),
  spearman_150m_90d_vs_800m_365d: spearman(series('150m_90d'), series('800m_365d')),
  spearman_atPremise365d_vs_neighbourhood400m365d: spearman(series('150m_365d', 'atPremise'), neighbourhood400),
  top10Overlap_150m_vs_800m_365d: top10Overlap(series('150m_365d'), series('800m_365d')),
  top10Overlap_150m_90d_vs_800m_365d: top10Overlap(series('150m_90d'), series('800m_365d')),
  top10Overlap_relevant150m90d_vs_relevant800m365d:
    top10Overlap(series('150m_90d', 'travellerRelevant'), series('800m_365d', 'travellerRelevant')),
};
feasibility.placesWhose800mCircleTouchesAnEmptyCell = places.filter((p) => p.partialCoverage800).length;

// One illustrative record: the place with the median 400 m / 90-day count. No coordinates printed.
const byMedian = [...places].sort((a, b) => countOf(a, '400m_90d') - countOf(b, '400m_90d') || a.lat - b.lat);
const example = byMedian[Math.floor(byMedian.length / 2)];
const suppress = (n) => (n < SMALL_COUNT ? `fewer than ${SMALL_COUNT}` : n);
const exampleRecord = {};
for (const key of ['400m_90d', '800m_365d', '150m_90d']) {
  const c = example.counts[key] ?? { all: 0, byCategory: {} };
  exampleRecord[key] = {
    person: suppress(c.byCategory.person ?? 0), vehicle: suppress(c.byCategory.vehicle ?? 0),
    property_other: suppress(c.byCategory.property_other ?? 0),
    excluded: { enforcement: c.byCategory.enforcement ?? 0, domestic: c.byCategory.domestic ?? 0, not_location_relevant: c.byCategory.not_location_relevant ?? 0 },
    atPremiseTagged: c.atPremise ?? 0, all: c.all,
  };
}

// ---------- Output ----------
const summary = { manifest, citywide, gasStation, quality, coverage, feasibility, exampleRecord };
writeFileSync(join(CACHE_DIR, 'summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
