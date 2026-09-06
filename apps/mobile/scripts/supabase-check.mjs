#!/usr/bin/env node
// Read-only Supabase connectivity check for HerStop.
// Reads apps/mobile/.env, does a GET on the `stops` table with the anon key, and prints
// either the row count (LIVE) or the exact reason it failed (so the blocker is unambiguous).
// No writes, no secrets printed. Run: `npm run supabase:check` from apps/mobile/.

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

// Mirror the app's `supabaseConfigured` check.
const configured =
  url.startsWith('https://') &&
  !url.includes('your-project') &&
  key.length > 0 &&
  !key.includes('your-anon-key');

if (!configured) {
  console.log('⚠️  MOCK MODE — .env is missing or still has placeholder values.');
  console.log('   The app will serve mock data. Fill real values in apps/mobile/.env to go live.');
  process.exit(2);
}

const host = url.replace(/^https?:\/\//, '');
console.log(`→ Checking Supabase project host: ${host}`);

const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 15000);

try {
  const res = await fetch(`${url}/rest/v1/stops?select=id,name&limit=1000`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    signal: controller.signal,
  });
  clearTimeout(timeout);

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error(`❌ HTTP ${res.status} ${res.statusText}. ${body.slice(0, 300)}`);
    if (res.status === 401 || res.status === 403) {
      console.error('   → Auth/RLS issue: check the anon key and the "Public read access" policy on stops.');
    } else if (res.status === 404) {
      console.error('   → The `stops` table may not exist. Run docs/schema.sql in the SQL editor.');
    }
    process.exit(1);
  }

  const rows = await res.json();
  console.log(`✅ LIVE — Supabase returned ${rows.length} row(s) from "stops".`);
  const test = rows.find((r) => typeof r.name === 'string' && r.name.includes('TEST'));
  if (test) console.log(`   Found live marker row: "${test.name}" (id=${test.id}).`);
  console.log('   Row names:', rows.map((r) => r.name).join(', '));
  process.exit(0);
} catch (err) {
  clearTimeout(timeout);
  const msg = String(err?.cause?.code || err?.name || err?.message || err);
  if (msg.includes('ENOTFOUND') || msg.includes('NXDOMAIN') || err?.cause?.code === 'ENOTFOUND') {
    console.error(`❌ Cannot resolve host "${host}" (ENOTFOUND / NXDOMAIN).`);
    console.error('   → The Supabase project is deleted, paused, or the URL is wrong.');
    console.error('   → Create/restore the project, then put its real URL + anon key in .env.');
  } else if (err?.name === 'AbortError') {
    console.error(`❌ Timed out after 15s reaching ${host}.`);
  } else {
    console.error(`❌ Network error: ${msg}`);
  }
  process.exit(1);
}
