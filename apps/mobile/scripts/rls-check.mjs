#!/usr/bin/env node
// Read-only RLS verification for HerStop's auth-dependent tables
// (docs/migrations/002_auth_tables.sql: profiles, saved_stops, reviews;
// docs/migrations/003_reviews_privacy_and_moderation.sql: the reviews
// privacy/moderation follow-up — unique constraint, review_reports,
// blocked_users, get_stop_reviews, get_stop_review_stats, report_review,
// block_review_author).
//
// Uses only the anon key — the same client the app uses, never a privileged
// key. No secrets, tokens, or coordinates are ever printed.
//
// Every assertion here is a GET/POST probe that either reads nothing
// sensitive or is guaranteed to fail even if it somehow "succeeded":
// assertion "anonymous INSERT into saved_stops is denied" targets a
// stop_id/user_id that don't exist anywhere in the database (foreign keys
// would stop it even if RLS didn't), and the 003 write-RPC probes
// (report_review / block_review_author) use a fake review id, so nothing
// real is ever created.
//
// Safe to run before OR after either migration is applied:
//   - Before 002: profiles/saved_stops/reviews don't exist yet, so those
//     assertions FAIL with "table does not exist" — expected, not a crash.
//   - After 002, before 003: the reviews-table assertions reflect 002's
//     shape (public read still works); every 003 assertion (the RPCs,
//     review_reports, blocked_users) FAILs with a clear "not applied yet"
//     detail — expected, not a crash.
//   - After 003: all assertions should PASS.
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

// 3. Anonymous SELECT on the reviews base table returns 0 rows. Before 003,
//    this is only true because the table happens to be empty (002's public
//    policy would otherwise let anon see non-hidden rows). After 003, it's
//    true unconditionally — 003 drops that public policy, so the base table
//    is readable only by each review's own author, and all client reads go
//    through get_stop_reviews()/get_stop_review_stats() instead (assertions
//    5 and 6 below).
await assert('anonymous SELECT on reviews returns 0 rows', async () => {
  const res = await fetch(`${url}/rest/v1/reviews?select=id&limit=1`, { headers: H });
  if (res.status === 404) return { pass: false, detail: 'table does not exist yet — migration 002 not applied' };
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    return { pass: false, detail: `HTTP ${res.status}: ${body.slice(0, 150)}` };
  }
  const rows = await res.json();
  if (rows.length === 0) return { pass: true, detail: 'HTTP 200, 0 rows' };
  return { pass: false, detail: `HTTP 200 but returned ${rows.length} row(s) — either seed data exists or RLS is not restricting anon reads` };
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

// PostgREST's signature for "this function/relation doesn't exist" is a 404
// with error code PGRST202 (function) or PGRST205 (table) — that's the
// "migration 003 not applied yet" signal, distinct from an actual RLS/grant
// denial (401/403). Treated as its own FAIL reason below, never a crash.
function isMissingSchemaObject(status, body) {
  return status === 404 && /PGRST20[25]/.test(body);
}

// 5. Anonymous can call get_stop_reviews — it's meant to be the public read
//    path for reviews now that the base table's public policy is gone.
await assert('anonymous can call get_stop_reviews', async () => {
  const res = await fetch(`${url}/rest/v1/rpc/get_stop_reviews`, {
    method: 'POST',
    headers: { ...H, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_stop_id: '1' }),
  });
  const body = await res.text().catch(() => '');
  if (isMissingSchemaObject(res.status, body)) {
    return { pass: false, detail: 'function does not exist yet — migration 003 not applied' };
  }
  if (!res.ok) return { pass: false, detail: `HTTP ${res.status}: ${body.slice(0, 150)}` };
  return { pass: true, detail: `HTTP 200 — callable by anon` };
});

// 6. Anonymous can call get_stop_review_stats — same reasoning as above.
await assert('anonymous can call get_stop_review_stats', async () => {
  const res = await fetch(`${url}/rest/v1/rpc/get_stop_review_stats`, {
    method: 'POST',
    headers: { ...H, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_stop_ids: ['1'] }),
  });
  const body = await res.text().catch(() => '');
  if (isMissingSchemaObject(res.status, body)) {
    return { pass: false, detail: 'function does not exist yet — migration 003 not applied' };
  }
  if (!res.ok) return { pass: false, detail: `HTTP ${res.status}: ${body.slice(0, 150)}` };
  return { pass: true, detail: `HTTP 200 — callable by anon` };
});

// 7. Anonymous calling report_review is rejected. No grant exists for anon
//    (spec: authenticated only), so Postgres should refuse execute before
//    the function body ever runs — a fake review id keeps this side-effect-
//    free even if that ever regressed.
await assert('anonymous calling report_review is rejected', async () => {
  const fakeReviewId = '00000000-0000-0000-0000-000000000000';
  const res = await fetch(`${url}/rest/v1/rpc/report_review`, {
    method: 'POST',
    headers: { ...H, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_review_id: fakeReviewId, p_reason: 'spam' }),
  });
  const body = await res.text().catch(() => '');
  if (isMissingSchemaObject(res.status, body)) {
    return { pass: false, detail: 'function does not exist yet — migration 003 not applied' };
  }
  if (res.status === 401 || res.status === 403) {
    return { pass: true, detail: `HTTP ${res.status} — correctly denied (no execute grant for anon)` };
  }
  return { pass: false, detail: `HTTP ${res.status} — expected 401/403: ${body.slice(0, 150)}` };
});

// 8. Anonymous calling block_review_author is rejected — same shape as 7.
await assert('anonymous calling block_review_author is rejected', async () => {
  const fakeReviewId = '00000000-0000-0000-0000-000000000000';
  const res = await fetch(`${url}/rest/v1/rpc/block_review_author`, {
    method: 'POST',
    headers: { ...H, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_review_id: fakeReviewId }),
  });
  const body = await res.text().catch(() => '');
  if (isMissingSchemaObject(res.status, body)) {
    return { pass: false, detail: 'function does not exist yet — migration 003 not applied' };
  }
  if (res.status === 401 || res.status === 403) {
    return { pass: true, detail: `HTTP ${res.status} — correctly denied (no execute grant for anon)` };
  }
  return { pass: false, detail: `HTTP ${res.status} — expected 401/403: ${body.slice(0, 150)}` };
});

// 9. Anonymous SELECT on review_reports returns 0 rows — RLS is on with zero
//    policies, so every client role is denied at the row level (same shape
//    as saved_stops in assertion 2, not a table-level permission error).
await assert('anonymous SELECT on review_reports returns 0 rows', async () => {
  const res = await fetch(`${url}/rest/v1/review_reports?select=id&limit=1`, { headers: H });
  if (res.status === 404) return { pass: false, detail: 'table does not exist yet — migration 003 not applied' };
  if (res.status === 401 || res.status === 403) {
    const body = await res.text().catch(() => '');
    return { pass: true, detail: `HTTP ${res.status} — correctly denied: ${body.slice(0, 120)}` };
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    return { pass: false, detail: `HTTP ${res.status}: ${body.slice(0, 150)}` };
  }
  const rows = await res.json();
  if (rows.length === 0) return { pass: true, detail: 'HTTP 200, 0 rows — RLS correctly hides anon from review_reports' };
  return { pass: false, detail: `HTTP 200 but returned ${rows.length} row(s) — RLS is not restricting anon reads!` };
});

// 10. Anonymous SELECT on blocked_users returns 0 rows — the select policy
//     is `auth.uid() = blocker_id`, and anon has no auth.uid(), so it's
//     never true.
await assert('anonymous SELECT on blocked_users returns 0 rows', async () => {
  const res = await fetch(`${url}/rest/v1/blocked_users?select=blocker_id&limit=1`, { headers: H });
  if (res.status === 404) return { pass: false, detail: 'table does not exist yet — migration 003 not applied' };
  if (res.status === 401 || res.status === 403) {
    const body = await res.text().catch(() => '');
    return { pass: true, detail: `HTTP ${res.status} — correctly denied: ${body.slice(0, 120)}` };
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    return { pass: false, detail: `HTTP ${res.status}: ${body.slice(0, 150)}` };
  }
  const rows = await res.json();
  if (rows.length === 0) return { pass: true, detail: 'HTTP 200, 0 rows — RLS correctly hides anon from blocked_users' };
  return { pass: false, detail: `HTTP 200 but returned ${rows.length} row(s) — RLS is not restricting anon reads!` };
});

console.log(`→ RLS check against: ${url.replace(/^https?:\/\//, '')}\n`);
for (const r of results) {
  console.log(`${r.pass ? '✅ PASS' : '❌ FAIL'} — ${r.name}`);
  console.log(`   ${r.detail}`);
}

const failCount = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failCount}/${results.length} passed.`);
if (failCount > 0) {
  console.log(
    '(FAILs here are expected before docs/migrations/002_auth_tables.sql and/or ' +
      'docs/migrations/003_reviews_privacy_and_moderation.sql are applied.)',
  );
}
process.exit(failCount > 0 ? 1 : 0);
