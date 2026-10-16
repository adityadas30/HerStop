import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const root = new URL('../../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const db = new PGlite(); // In memory; no socket, remote URL, env loader or disk database.
const results = [];
const queries = new Map((await read('tools/db-test/queries.sql')).split('-- QUERY: ').slice(1).map(part => {
  const newline = part.indexOf('\n');
  return [part.slice(0, newline).trim(), part.slice(newline + 1)];
}));
const exec = name => db.exec(queries.get(name));
const query = async (name, params = []) => {
  const rows = (await db.query(queries.get(name), params)).rows;
  return name.startsWith('export_') ? rows.map(row => row.payload) : rows;
};
const file = async path => db.exec(await read(path));
const snapshot = () => query('snapshot');
const snapshots = new Map();
const ups = {
  '001': 'docs/schema.sql',
  '002': 'docs/migrations/002_auth_tables.sql',
  '003': 'docs/migrations/003_reviews_privacy_and_moderation.sql',
  '005': 'docs/migrations/005_stops_provider_fields.sql',
  '006': 'docs/migrations/006_ingest_real_stops.sql',
  '007': 'docs/migrations/007_delete_my_account.sql',
};
const down = version => file(`docs/migrations/rollback/${version}_down.sql`);
async function check(name, fn) {
  try { await fn(); results.push({ result: 'PASS', test: name }); }
  catch (error) {
    results.push({ result: 'FAIL', test: name });
    // Do not print SQL or row payloads (they may contain location data).
    console.error(`${name}: ${error.code ?? error.name}: ${error.message.split('\n')[0]}`);
    await exec('rollback');
    throw error;
  }
}
async function guarded(version, fixture, flags, expectedMessage) {
  const before = await snapshot();
  await exec(flags ? 'rollback_flags' : 'clear_flags');
  await exec('begin');
  if (fixture) await exec(fixture);
  let error;
  try { await down(version); } catch (caught) { error = caught; }
  await exec('rollback');
  assert.ok(error, 'rollback guard unexpectedly accepted');
  assert.equal(error.code, 'P0001');
  assert.ok(error.message.includes(expectedMessage));
  assert.deepEqual(await snapshot(), before);
}

// RFC 4180 quoted CSV cells contain JSON values, preserving types, NULL and arrays.
// This is a local backup transport test, not a claim about Dashboard CSV encoding.
function csvRoundTrip(rows) {
  const columns = Object.keys(rows[0]);
  const csv = [columns, ...rows.map(row => columns.map(c => JSON.stringify(row[c])))].map(
    cells => cells.map(cell => `"${cell.replaceAll('"', '""')}"`).join(',')
  ).join('\r\n');
  const records = []; let row = [], cell = '', quoted = false;
  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i];
    if (ch === '"') {
      if (quoted && csv[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted;
    } else if (!quoted && ch === ',') { row.push(cell); cell = ''; }
    else if (!quoted && ch === '\r' && csv[i + 1] === '\n') {
      row.push(cell); records.push(row); row = []; cell = ''; i++;
    } else cell += ch;
  }
  row.push(cell); records.push(row);
  const header = records.shift();
  return records.map(record => Object.fromEntries(header.map((c, i) => [c, JSON.parse(record[i])])));
}

let failed = false;
try {
  await check('Bootstrap real Postgres roles/auth/JWT helpers (simulated grants)', () => file('tools/db-test/bootstrap.sql'));
  let seedPayload;
  let backupStops;
  let backupSaves;
  for (const version of Object.keys(ups)) {
    snapshots.set(version, await snapshot());
    await check(`Apply ${version} from repository; expected row counts`, async () => {
      await file(ups[version]);
      if (version === '001') {
        assert.equal((await query('seed_count'))[0].n, 6);
        seedPayload = await query('seed_payload');
      } else {
        if (version === '002') await exec('live_fixture');
        assert.deepEqual((await query('counts'))[0], {
          stops: version < '006' ? 6 : 44,
          saves: version < '006' ? 2 : 0, reviews: 0, profiles: 0, users: 1,
        });
      }
      if (version === '005') {
        // Capture exact live-shape payload: TEST name, timestamps and both saves.
        backupStops = csvRoundTrip(await query('export_stops'));
        backupSaves = csvRoundTrip(await query('export_saves'));
      }
    });
  }
  const cases = (await read('tools/db-test/isolation.sql')).split('-- CASE: ').slice(1);
  for (const part of cases) {
    const newline = part.indexOf('\n');
    const name = part.slice(0, newline).trim();
    await check(name, async () => {
      await exec('begin');
      await file('tools/db-test/fixtures.sql');
      await db.exec(part.slice(newline + 1));
      await exec('rollback');
    });
  }
  await check('004 fails after 005 with NOT NULL; transaction restores catalog/data', async () => {
    const before = await query('export_stops');
    let error;
    try { await file('docs/migrations/004_seed_real_stops_i65.sql'); } catch (caught) { error = caught; }
    await exec('rollback');
    assert.equal(error?.code, '23502');
    assert.deepEqual(await query('export_stops'), before);
  });
  await check('001 is not safely re-runnable (duplicate policy)', async () => {
    let error;
    await exec('begin');
    try { await file(ups['001']); } catch (caught) { error = caught; }
    await exec('rollback');
    assert.equal(error?.code, '42710');
  });
  await check('007 down restores catalog; second down is idempotent', async () => {
    await down('007');
    assert.deepEqual(await snapshot(), snapshots.get('007'));
    await down('007');
    assert.deepEqual(await snapshot(), snapshots.get('007'));
  });
  await check('003 down refuses populated reviews/privacy downgrade', () => guarded('003', 'guard_review', true, 'review data/privacy'));
  await check('006 down rejects missing loss flag', () => guarded('006', null, false, 'explicit OSM'));
  await check('006 down rejects saved-stop cascade even with flag', () => guarded('006', 'guard_save', true, 'dependent user data'));
  await check('006 down rejects review cascade even with flag', () => guarded('006', 'guard_review', true, 'dependent user data'));
  await check('006 down rejects reserved legacy ID overwrite', () => guarded('006', 'guard_reserved', true, 'changed/reserved'));
  await check('006 down restores catalog and all explicit 001 seed values; idempotent', async () => {
    await exec('other_provider_fixture');
    await exec('rollback_flags');
    await down('006');
    assert.equal((await query('other_provider_check'))[0].n,1);
    await exec('other_provider_cleanup');
    assert.deepEqual(await snapshot(), snapshots.get('006'));
    assert.deepEqual(await query('seed_payload'), seedPayload);
    assert.equal((await query('counts'))[0].saves, 0); // Intentional non-recovery of cascaded rows.
    await down('006');
    assert.deepEqual(await query('seed_payload'), seedPayload);
  });
  await check('CSV backup restores TEST rename, timestamps and both legacy saves', async () => {
    await query('restore_stops', [JSON.stringify(backupStops)]);
    await query('restore_saves', [JSON.stringify(backupSaves)]);
    // UPDATE trigger deliberately refreshes updated_at; compare all other data.
    const withoutUpdatedAt = rows => rows.map(({ updated_at, ...row }) => row);
    assert.deepEqual(withoutUpdatedAt(await query('export_stops')), withoutUpdatedAt(backupStops));
    assert.deepEqual(await query('export_saves'), backupSaves);
  });
  await check('005 down rejects absent code-dependency attestation', () => guarded('005', null, false, 'columns-unused'));
  await check('005 down rejects non-default provider data', () => guarded('005', 'guard_provider', true, 'non-default provider'));
  await check('005 down restores catalog/data; idempotent', async () => {
    await exec('rollback_flags'); await down('005');
    assert.deepEqual(await snapshot(), snapshots.get('005'));
    await down('005');
    assert.deepEqual(await snapshot(), snapshots.get('005'));
    assert.equal((await query('counts'))[0].saves, 2);
  });
  await check('003 down rejects absent stopped-client attestation', () => guarded('003', null, false, 'stopped-client'));
  await check('003 down rejects ban/evidence loss', () => guarded('003', 'guard_ban', true, 'moderation data'));
  await check('003 down restores tables/columns/policies/functions/constraints/grants; idempotent', async () => {
    await exec('rollback_flags'); await down('003');
    assert.deepEqual(await snapshot(), snapshots.get('003'));
    await down('003');
    assert.deepEqual(await snapshot(), snapshots.get('003'));
  });
  await check('Separate proposed 008/009 apply in local rehearsal only', async () => {
    for (const version of ['003','005','006','007']) await file(ups[version]);
    await file('docs/sprint-2/proposed-fixes/008_review_edit_delay.sql');
    await file('docs/sprint-2/proposed-fixes/009_caller_moderation_and_grants.sql');
  });
  for (const part of (await read('tools/db-test/proposed-tests.sql')).split('-- CASE: ').slice(1)) {
    const newline = part.indexOf('\n');
    await check(part.slice(0,newline).trim(), async () => {
      await exec('begin'); await file('tools/db-test/fixtures.sql');
      await db.exec(part.slice(newline + 1)); await exec('rollback');
    });
  }
} catch { failed = true; }
finally { await db.close(); }
console.table(results);
console.log(`${results.filter(r => r.result === 'PASS').length}/${results.length} checks passed; ${failed ? 'FAIL' : 'PASS'}.`);
console.log('KNOWN RISK tests PASS when the documented vulnerability is reproduced; this is not production approval.');
console.log('No Supabase connection. Platform grants, auth/storage internals, PostgREST, OTP and iOS remain unverified.');
process.exitCode = failed ? 1 : 0;
