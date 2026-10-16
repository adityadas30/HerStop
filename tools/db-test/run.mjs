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
// flags: true = every attestation on, false = all off, or a queries.sql name.
// path: run this SQL file instead of the version's down script.
async function guarded(version, fixture, flags, expectedMessage, path) {
  const before = await snapshot();
  await exec(typeof flags === 'string' ? flags : flags ? 'rollback_flags' : 'clear_flags');
  await exec('begin');
  if (fixture) await exec(fixture);
  let error;
  try { await (path ? file(path) : down(version)); } catch (caught) { error = caught; }
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

// Each `-- CASE:` runs in its own rolled-back transaction on top of fixtures.sql.
// phase 'with-008-009' skips [baseline-only] cases (they reproduce the old
// vulnerabilities; their fixed counterparts live in proposed-tests.sql) and marks
// fixture reviews as published-and-never-edited.
async function runCases(path, { phase }) {
  const post = phase === 'with-008-009';
  for (const part of (await read(path)).split('-- CASE: ').slice(1)) {
    const newline = part.indexOf('\n');
    const name = part.slice(0, newline).trim();
    if (post && name.startsWith('[baseline-only]')) continue;
    await check(post ? `[with 008/009] ${name}` : name, async () => {
      await exec('begin');
      await file('tools/db-test/fixtures.sql');
      if (post) await exec('fixture_published_edits');
      await db.exec(part.slice(newline + 1));
      await exec('rollback');
    });
  }
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
  await runCases('tools/db-test/isolation.sql', { phase: 'baseline' });
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
  await check('006 down rejects missing staging-only attestation', () => guarded('006', null, 'all_flags_but_staging', 'staging-only attestation'));
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
  await check('006 down requires both attestations even with zero OSM rows', async () => {
    await guarded('006', null, false, 'explicit OSM');
    await guarded('006', null, 'all_flags_but_staging', 'staging-only attestation');
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
  // ---- Second pass: re-apply 003-007, then the 008/009 final candidates. ----
  const again = new Map();
  for (const version of ['003', '005', '006', '007']) {
    await check(`Re-apply ${version} after rollback; pre-apply catalog matches first pass`, async () => {
      again.set(version, await snapshot());
      assert.deepEqual(again.get(version), snapshots.get(version));
      await file(ups[version]);
    });
  }
  const fix = { '008': 'docs/sprint-2/proposed-fixes/008_review_edit_delay.sql',
    '009': 'docs/sprint-2/proposed-fixes/009_caller_moderation_and_grants.sql' };
  await check('Apply 008 final candidate', async () => {
    again.set('008', await snapshot());
    await file(fix['008']);
  });
  await check('009 refuses without inspected object-creator attestation', async () => {
    await exec('clear_creator_flag');
    await guarded('009', null, false, 'object-creator role', fix['009']);
  });
  await check('Apply 009 final candidate (in-file effective-privilege check passes)', async () => {
    again.set('009', await snapshot());
    await exec('creator_flag');
    await file(fix['009']);
  });
  await runCases('tools/db-test/proposed-tests.sql', { phase: 'with-008-009' });
  await runCases('tools/db-test/isolation.sql', { phase: 'with-008-009' });

  // ---- Rollback 009 -> 008 -> 007 -> 006 -> 005 -> 003 from the fixed state. ----
  await check('003 down refuses while 008/009 are installed', () => guarded('003', null, true, 'refuses installed 008/009'));
  await check('008 down refuses while 009 is installed', () => guarded('008', null, true, 'requires 009_down first'));
  await check('009 down rejects absent attestations', () => guarded('009', null, false, 'staging-only and stopped-client'));
  await check('009 down rejects absent staging-only attestation', () => guarded('009', null, 'all_flags_but_staging', 'staging-only and stopped-client'));
  await check('009 down refuses populated review table', () => guarded('009', 'guard_review', true, 'populated user/moderation'));
  await check('009 down refuses populated saved_stops table', () => guarded('009', 'guard_save', true, 'populated user/moderation'));
  await check('009 down restores pre-009 catalog incl. ACLs/default ACLs; idempotent', async () => {
    await exec('rollback_flags'); await down('009');
    assert.deepEqual(await snapshot(), again.get('009'));
    await down('009');
    assert.deepEqual(await snapshot(), again.get('009'));
  });
  await check('003 down refuses while 008 (edited_at) is installed', () => guarded('003', null, true, 'refuses installed 008/009'));
  await check('008 down rejects absent attestations', () => guarded('008', null, false, 'staging-only and stopped-client'));
  await check('008 down rejects absent staging-only attestation', () => guarded('008', null, 'all_flags_but_staging', 'staging-only and stopped-client'));
  await check('008 down refuses review/edit data loss', () => guarded('008', 'guard_review', true, 'review/edit data loss'));
  await check('008 down restores pre-008 catalog (no edited_at, no herstop_rollback); idempotent', async () => {
    await exec('rollback_flags'); await down('008');
    assert.deepEqual(await snapshot(), again.get('008'));
    await down('008');
    assert.deepEqual(await snapshot(), again.get('008'));
  });
  await check('Full chain 007 -> 006 -> 005 -> 003 after 008/009 rollback restores each catalog', async () => {
    await exec('rollback_flags');
    for (const version of ['007', '006', '005', '003']) {
      await down(version);
      assert.deepEqual(await snapshot(), again.get(version), `${version} down`);
    }
    assert.deepEqual(await snapshot(), snapshots.get('003'));
  });
} catch (error) {
  failed = true;
  // Errors outside check() (e.g. a snapshot query) must not vanish silently.
  if (!results.length || results.at(-1).result !== 'FAIL') {
    console.error(`Harness error outside a check: ${error.code ?? error.name}: ${error.message.split('\n')[0]}`);
  }
}
finally { await db.close(); }
console.table(results);
console.log(`${results.filter(r => r.result === 'PASS').length}/${results.length} checks passed; ${failed ? 'FAIL' : 'PASS'}.`);
console.log('KNOWN RISK tests PASS when the documented vulnerability is reproduced; this is not production approval.');
console.log('No Supabase connection. Platform grants, auth/storage internals, PostgREST, OTP and iOS remain unverified.');
process.exitCode = failed ? 1 : 0;
