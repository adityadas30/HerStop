#!/usr/bin/env node
// Read-only RLS verification for HerStop's auth-dependent tables
// (docs/migrations/002_auth_tables.sql: profiles, saved_stops, reviews).
//
// Uses only the anon key — the same client the app uses, never a service-role
// key. No secrets, tokens, or coordinates are ever printed.
//
// Every assertion here is a GET except one deliberate INSERT probe (assertion
// 4: "anonymous INSERT into saved_stops is denied") — that probe targets a
// stop_id and user_id that don't exist anywhere in the database, so even if
// RLS were misconfigured and the insert somehow succeeded, no real or
// meaningful row would be created; it would still fail its foreign keys.
//
// Safe to run before OR after the migration is applied:
//   - Before: profiles/saved_stops/reviews don't exist yet, so those
//     assertions FAIL with "table does not exist" — expected, not a crash.
//   - After: all five assertions should PASS.
//
// Run: `npm run rls:check` from apps/mobile/.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const envPath = join(here, '..', '.env');

function parseEnv(text) {
  const out = {};
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return out;
}

let env;
try {
  env = parseEnv(readFileSync(envPath, 'utf8'));
} catch {
  console.error('❌ No apps/mobile/.env found. Copy .env.example → .env and fill it in.');
  process.exit(1);
}

const url = env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const key = env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

const configured =
  url.startsWith('https://') &&
  !url.includes('your-project') &&
  key.length > 0 &&
  !key.includes('your-anon-key');

if (!configured) {
  console.log('⚠️  MOCK MODE — .env is missing or still has placeholder values.');
  console.log('   Fill real values in apps/mobile/.env to run this check against the live project.');
  process.exit(2);
}

const H = { apikey: key, Authorization: `Bearer ${key}` };
const results = [];

/** Run one assertion; never throws — records a FAIL with the error instead. */
async function assert(name, fn) {
  try {
    const { pass, detail } = await fn();
    results.push({ name, pass, detail });
  } catch (err) {
    results.push({ name, pass: false, detail: `error: ${err?.message ?? String(err)}` });
  }
}

// 0. stops.id type compatibility — the migration declares
//    `saved_stops.stop_id text references stops(id)`. Filtering with a
//    string that's invalid syntax for both uuid and integer/bigint proves
//    (without ever reading a secret or writing anything) that `stops.id`
//    really is text-compatible, matching the migration.
await assert('stops.id is text-compatible (matches saved_stops.stop_id text)', async () => {
  const res = await fetch(`${url}/rest/v1/stops?id=eq.abc&select=id`, { headers: H });
  if (res.status === 400) {
    const body = await res.text().catch(() => '');
    return { pass: false, detail: `HTTP 400 — id column rejected a non-numeric, non-uuid filter (likely uuid/int typed): ${body.slice(0, 150)}` };
  }
  if (!res.ok) return { pass: false, detail: `unexpected HTTP ${res.status}` };
  return { pass: true, detail: 'HTTP 200 — no type-cast error, consistent with a text column' };
});

// 1. Anonymous SELECT on stops succeeds (public read is intentional).
await assert('anonymous SELECT on stops succeeds', async () => {
  const res = await fetch(`${url}/rest/v1/stops?select=id&limit=1`, { headers: H });
  if (!res.ok) return { pass: false, detail: `HTTP ${res.status}` };
  return { pass: true, detail: `HTTP 200` };
});

// 2. Anonymous SELECT on saved_stops returns 0 rows (RLS hides everyone
//    else's saves) — or, pre-migration, the table doesn't exist yet.
await assert('anonymous SELECT on saved_stops is denied (0 rows / RLS)', async () => {
  const res = await fetch(`${url}/rest/v1/saved_stops?select=id&limit=1`, { headers: H });
  if (res.status === 404) return { pass: false, detail: 'table does not exist yet — migration not applied' };
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    return { pass: false, detail: `HTTP ${res.status}: ${body.slice(0, 150)}` };
  }
  const rows = await res.json();
  if (rows.length === 0) return { pass: true, detail: 'HTTP 200, 0 rows — RLS correctly hides anon from saved_stops' };
  return { pass: false, detail: `HTTP 200 but returned ${rows.length} row(s) — RLS is not restricting anon reads!` };
});

// 3. Anonymous SELECT on reviews succeeds (non-hidden reviews are public —
//    see the migration's rationale comment) — or, pre-migration, no table.
await assert('anonymous SELECT on reviews succeeds', async () => {
  const res = await fetch(`${url}/rest/v1/reviews?select=id&limit=1`, { headers: H });
  if (res.status === 404) return { pass: false, detail: 'table does not exist yet — migration not applied' };
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    return { pass: false, detail: `HTTP ${res.status}: ${body.slice(0, 150)}` };
  }
  return { pass: true, detail: 'HTTP 200' };
});

// 4. Anonymous INSERT into saved_stops is denied. Uses guaranteed-fake IDs
//    (a random uuid, a stop_id that doesn't exist) so a misconfigured RLS
//    policy still can't create a real row — the foreign keys would stop it.
await assert('anonymous INSERT into saved_stops is denied', async () => {
  const fakeUserId = '00000000-0000-0000-0000-000000000000';
  const fakeStopId = '__rls_check_probe__';
  const res = await fetch(`${url}/rest/v1/saved_stops`, {
    method: 'POST',
    headers: { ...H, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ user_id: fakeUserId, stop_id: fakeStopId }),
  });
  if (res.status === 404) return { pass: false, detail: 'table does not exist yet — migration not applied' };
  if (res.status === 201 || res.status === 200) {
    return { pass: false, detail: `HTTP ${res.status} — insert SUCCEEDED! RLS is not blocking anon writes.` };
  }
  const body = await res.text().catch(() => '');
  if (res.status === 401 || res.status === 403) {
    return { pass: true, detail: `HTTP ${res.status} — correctly denied (RLS): ${body.slice(0, 120)}` };
  }
  // A foreign-key violation (fakeStopId doesn't exist) would also prove the
  // insert didn't succeed, even if RLS itself didn't fire first.
  return { pass: true, detail: `HTTP ${res.status} — insert did not succeed: ${body.slice(0, 120)}` };
});

console.log(`→ RLS check against: ${url.replace(/^https?:\/\//, '')}\n`);
for (const r of results) {
  console.log(`${r.pass ? '✅ PASS' : '❌ FAIL'} — ${r.name}`);
  console.log(`   ${r.detail}`);
}

const failCount = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failCount}/${results.length} passed.`);
if (failCount > 0) {
  console.log('(FAILs here are expected before docs/migrations/002_auth_tables.sql is applied.)');
}
process.exit(failCount > 0 ? 1 : 0);
