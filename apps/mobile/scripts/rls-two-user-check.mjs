// Founder-run, interactive, DISPOSABLE STAGING ACCOUNTS ONLY.
// Reads process.env only; never opens .env, logs credentials, or uses an admin key.
// Deletes both empty test accounts via 007, including on test failure.
import assert from 'node:assert/strict';
import { createInterface } from 'node:readline/promises';

const env = process.env;
const results = [];
const users = [];
let cleanupAuthorized = false;
let input;
let base;
let key;
let stage = 'configuration (required environment, staging origin, disposable-account acknowledgement and interactive terminal)';
const marker = 'HerStop staging RLS fixture';
const anon = { token: null };
function requireValue(name) {
  const value = env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}
async function request(actor, path, method = 'GET', body) {
  const response = await fetch(`${base}${path}`, {
    method,
    redirect: 'error',
    signal: AbortSignal.timeout(20000),
    headers: {
      apikey: key, Authorization: `Bearer ${actor.token ?? key}`,
      'Content-Type': 'application/json', Prefer: 'return=representation',
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  return { ok: response.ok, status: response.status, data };
}
function ok(response) {
  assert.ok(response.ok, `Unexpected HTTP ${response.status}`);
  return response.data;
}
function denied(response) {
  // A duplicate/FK failure does NOT prove RLS. Missing objects also fail.
  assert.ok([401,403].includes(response.status) && response.data?.code === '42501', 'Expected RLS/privilege denial');
}
function noMutation(response) {
  if ([401,403].includes(response.status)) denied(response);
  else assert.deepEqual(ok(response), []);
}
const rest = (actor, table, filter = '', method = 'GET', body) => request(actor, `/rest/v1/${table}${filter}`, method, body);
const rpc = (actor, name, body = {}) => request(actor, `/rest/v1/rpc/${name}`, 'POST', body);
async function checkpoint(name) {
  console.log(`MANUAL CHECKPOINT: ${name}. Follow staging-runbook.md; do not print query results here.`);
  if ((await input.question('Type verified after completing this checkpoint: ')).trim() !== 'verified') {
    throw new Error('Manual checkpoint not verified');
  }
  results.push({ result: 'MANUAL', test: name });
}
async function check(name, fn) {
  try { await fn(); results.push({ result: 'PASS', test: name }); }
  catch { results.push({ result: 'FAIL', test: name }); throw new Error(`Failed: ${name}`); }
}
const rowBody = (id, stop, label) => ({
  user_id: id, stop_id: stop, overall_feeling: 4, lighting: 4,
  restroom_quality: 4, cleanliness: 4, staff_kindness: 4,
  loitering_concern: 'low', would_stop_again: true, time_of_visit: 'day',
  note: `${marker} ${label}`, created_at: '2000-01-01T00:00:00Z', is_hidden: true,
});
let failed = false;
try {
  const raw = requireValue('EXPO_PUBLIC_SUPABASE_URL');
  assert.ok(!raw.toLowerCase().includes('xnkjqcygzjlspeagcoal'), 'Production project refused');
  const url = new URL(raw);
  assert.ok(url.protocol === 'https:' && url.hostname.endsWith('.supabase.co') &&
    !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash,
  'Expected a hosted staging Supabase HTTPS origin');
  base = url.origin;
  assert.equal(env.HERSTOP_TEST_DISPOSABLE_ACCOUNTS, 'YES', 'Set disposable-account acknowledgement; both accounts will be deleted');
  assert.equal(env.HERSTOP_STAGING_PROJECT_REF, url.hostname.split('.')[0], 'Explicit staging project ref must match');
  key = requireValue('EXPO_PUBLIC_SUPABASE_ANON_KEY');
  // Legacy anon JWT or public publishable key only; reject all other key formats.
  if (!key.startsWith('sb_publishable_')) {
    let claims;
    try { claims = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()); } catch { throw new Error('Expected an anon/public key'); }
    assert.equal(claims.role, 'anon', 'Only anon/public key is accepted');
  }
  assert.ok(process.stdin.isTTY, 'Run interactively for founder-only fixture checkpoints');
  input = createInterface({ input: process.stdin, output: process.stdout });
  stage = 'password sign-in and empty-account preflight';
  for (const label of ['A','B']) {
    const credentials = { email: requireValue(`HERSTOP_TEST_USER_${label}_EMAIL`), password: requireValue(`HERSTOP_TEST_USER_${label}_PASSWORD`) };
    const session = ok(await request(anon, '/auth/v1/token?grant_type=password', 'POST', credentials));
    assert.ok(session?.user?.id && session?.access_token, 'Password sign-in failed');
    users.push({ label, id: session.user.id, token: session.access_token, credentials, deleted: false });
  }
  const [a,b] = users;
  assert.notEqual(a.id,b.id,'Accounts must be distinct');
  // Never adopt or clean up pre-existing rows/accounts with app data.
  for (const user of users) for (const table of ['profiles','saved_stops','reviews']) {
    assert.deepEqual(ok(await rest(user,table,'?select=*&limit=1')),[], 'Test accounts must have no existing app data');
  }
  cleanupAuthorized = true;
  stage = 'fixture creation and isolation checks';
  const stops = ok(await rest(anon,'stops','?select=id&order=id&limit=2'));
  assert.equal(stops.length,2,'Need two migrated stops');
  const [stop, otherStop] = stops.map(row => row.id);
  const readReviews = actor => rpc(actor,'get_stop_reviews',{p_stop_id:stop});
  for (const user of users) {
    ok(await rest(user,'profiles','','POST',{id:user.id,display_name:`${marker} ${user.label}`}));
    ok(await rest(user,'saved_stops','','POST',{user_id:user.id,stop_id:stop}));
    user.review = ok(await rest(user,'reviews','','POST',rowBody(user.id,stop,user.label)))[0];
    assert.equal(user.review.is_hidden,false);
    assert.ok(new Date(user.review.created_at).getUTCFullYear()>2000,'Timestamp must be forced');
  }
  await check('A/B/anon cannot read, insert-as, update or delete another user rows', async () => {
    for (const actor of [a,b,anon]) {
      const target = actor===b ? a : b;
      for (const table of ['profiles','saved_stops','reviews']) {
        const column = table==='profiles' ? 'id' : 'user_id';
        const filter = `?${column}=eq.${target.id}`;
        assert.deepEqual(ok(await rest(actor,table,`${filter}&select=*`)),[]);
        const changes = table==='profiles' ? {display_name:'Unauthorized'} : table==='reviews' ? {note:'Unauthorized'} : {stop_id:otherStop};
        noMutation(await rest(actor,table,filter,'PATCH',changes));
        noMutation(await rest(actor,table,filter,'DELETE'));
      }
      denied(await rest(actor,'profiles','','POST',{id:target.id}));
      denied(await rest(actor,'saved_stops','','POST',{user_id:target.id,stop_id:otherStop}));
      denied(await rest(actor,'reviews','','POST',rowBody(target.id,otherStop,'forbidden')));
    }
    for (const user of users) for (const table of ['profiles','saved_stops','reviews']) {
      assert.equal(ok(await rest(user,table,'?select=*')).length,1);
    }
  });
  await check('Own operations and immutable review identity/timestamp/moderation', async () => {
    ok(await rest(a,'profiles',`?id=eq.${a.id}`,'PATCH',{display_name:`${marker} A edited`}));
    noMutation(await rest(a,'profiles',`?id=eq.${a.id}`,'DELETE'));
    noMutation(await rest(a,'saved_stops',`?user_id=eq.${a.id}`,'PATCH',{stop_id:otherStop}));
    assert.equal(ok(await rest(a,'saved_stops',`?user_id=eq.${a.id}`,'DELETE')).length,1);
    ok(await rest(a,'saved_stops','','POST',{user_id:a.id,stop_id:stop}));
    const edited = ok(await rest(a,'reviews',`?id=eq.${a.review.id}`,'PATCH',{
      user_id:b.id,stop_id:otherStop,is_hidden:true,created_at:'2000-01-01T00:00:00Z',note:`${marker} A`,
    }))[0];
    for (const column of ['user_id','stop_id','is_hidden','created_at']) assert.equal(edited[column],a.review[column]);
    const temp = ok(await rest(a,'reviews','','POST',rowBody(a.id,otherStop,'temporary')))[0];
    assert.equal(ok(await rest(a,'reviews',`?id=eq.${temp.id}`,'DELETE')).length,1);
  });
  await check('New-review delay, public projection and anonymous RPC denials', async () => {
    for (const actor of [anon,b]) assert.ok(!ok(await readReviews(actor)).some(row=>row.id===a.review.id));
    assert.ok(ok(await readReviews(a)).some(row=>row.id===a.review.id));
    for (const row of ok(await readReviews(a))) assert.ok(!('user_id' in row) && !('created_at' in row));
    for (const [name,args] of [['report_review',{p_review_id:a.review.id,p_reason:'spam'}],['hide_review',{p_review_id:a.review.id}],['is_banned',{p_user_id:a.id}],['delete_my_account',{}]]) {
      const response=await rpc(anon,name,args);
      assert.ok(([401,403].includes(response.status) && response.data?.code==='42501') || (response.status===404 && response.data?.code==='PGRST202'),'Expected RPC grant denial');
    }
    for (const name of ['report_review','hide_review']) {
      const response=await rpc(b,name,{p_review_id:a.review.id,...(name==='report_review'?{p_reason:'spam'}:{})});
      assert.equal(response.data?.code,'P0001');
    }
  });
  await checkpoint('AGE: age both fixture reviews by three days in staging SQL Editor');
  await check('Published projection, B1 immediate edits and viewer-scoped hide/report', async () => {
    assert.ok(ok(await readReviews(anon)).some(row=>row.id===a.review.id));
    ok(await rest(a,'reviews',`?id=eq.${a.review.id}`,'PATCH',{note:`${marker} A edited-public`}));
    assert.ok(ok(await readReviews(anon)).some(row=>row.id===a.review.id && row.note.endsWith('edited-public')),'B1 baseline reproduction (will fail once fixed)');
    for (let i=0;i<2;i++) {
      ok(await rpc(b,'report_review',{p_review_id:a.review.id,p_reason:'spam'}));
      ok(await rpc(b,'hide_review',{p_review_id:a.review.id}));
    }
    // Both directions are needed to prove deletion cascades for reports/hides
    // ABOUT the deleted author and those FILED BY the deleted user.
    ok(await rpc(a,'report_review',{p_review_id:b.review.id,p_reason:'spam'}));
    ok(await rpc(a,'hide_review',{p_review_id:b.review.id}));
    assert.ok(!ok(await readReviews(b)).some(row=>row.id===a.review.id));
    assert.ok(ok(await readReviews(a)).some(row=>row.id===a.review.id));
    const stats=ok(await rpc(anon,'get_stop_review_stats',{p_stop_ids:[stop]}));
    assert.ok(stats[0].review_count>=2);
  });
  await checkpoint('HIDE: globally hide A fixture review; verify report snapshot and one per-viewer hide');
  await check('Hidden review cannot be unhidden/deleted by author; hidden from anon', async () => {
    const edited=ok(await rest(a,'reviews',`?id=eq.${a.review.id}`,'PATCH',{is_hidden:false}))[0];
    assert.equal(edited.is_hidden,true);
    noMutation(await rest(a,'reviews',`?id=eq.${a.review.id}`,'DELETE'));
    assert.ok(!ok(await readReviews(anon)).some(row=>row.id===a.review.id));
    assert.ok(ok(await readReviews(a)).some(row=>row.id===a.review.id));
    for (const name of ['report_review','hide_review']) assert.equal((await rpc(b,name,{p_review_id:a.review.id,...(name==='report_review'?{p_reason:'spam'}:{})})).data?.code,'P0001');
  });
  await checkpoint('BAN: unhide A fixture review and ban B test account');
  await check('Ban oracle, banned writes/read suppression and banned-caller RPC gap', async () => {
    assert.equal(ok(await rpc(a,'is_banned',{p_user_id:b.id})),true,'Arbitrary UUID ban oracle reproduced');
    denied(await rest(b,'reviews',`?id=eq.${b.review.id}`,'PATCH',{note:'Forbidden banned edit'}));
    denied(await rest(b,'reviews','','POST',rowBody(b.id,otherStop,'forbidden')));
    assert.ok(!ok(await readReviews(b)).some(row=>row.id===b.review.id));
    assert.ok(!ok(await readReviews(anon)).some(row=>row.id===b.review.id));
    for (const name of ['report_review','hide_review']) assert.equal((await rpc(a,name,{p_review_id:b.review.id,...(name==='report_review'?{p_reason:'spam'}:{})})).data?.code,'P0001');
    // Existing idempotent report/hide still succeeds for banned B under original 003.
    ok(await rpc(b,'report_review',{p_review_id:a.review.id,p_reason:'spam'}));
    ok(await rpc(b,'hide_review',{p_review_id:a.review.id}));
  });
  await check('Actual 007 call deletes A, preserves B, and invalidates A password sign-in', async () => {
    ok(await rpc(a,'delete_my_account')); a.deleted=true;
    for (const table of ['profiles','saved_stops','reviews']) assert.equal(ok(await rest(b,table,'?select=*')).length,1);
    const login=await request(anon,'/auth/v1/token?grant_type=password','POST',a.credentials);
    assert.ok(!login.ok && login.status===400,'Deleted account must not sign in');
  });
  await checkpoint('DELETE: verify A auth.users and dependents absent, B intact, reports/hides about A gone');
} catch (error) {
  failed=true;
  // Fixed messages only: fetch/server error bodies and assertion payloads may hold secrets.
  console.error('Staging check stopped. Inspect the FAIL/checkpoint above and runbook; no credentials or server payloads are logged.');
  console.error(`Stopped during: ${stage}.`);
} finally {
  if (cleanupAuthorized) {
    for (const user of users) {
      if (user.deleted) continue;
      try {
        ok(await rpc(user,'delete_my_account')); user.deleted=true;
        results.push({result:'PASS',test:`Cleanup disposable account ${user.label} via 007`});
      } catch {
        failed=true;
        // Best effort for own ordinary rows if 007 is unavailable. Profile, hidden
        // review or moderation evidence may need founder cleanup; never claim all clean.
        for (const table of ['reviews','saved_stops']) {
          try { await rest(user,table,`?user_id=eq.${user.id}`,'DELETE'); } catch { /* recorded below */ }
        }
        results.push({result:'FAIL',test:`Cleanup ${user.label} incomplete: founder must inspect account/profile/moderation rows`});
      }
    }
  }
  input?.close();
  console.table(results);
  console.log('MANUAL rows are operator attestations, not API verification. Day-boundary and stop-removal tests are in the local harness; see runbook for staging SQL checks.');
  process.exitCode=failed?1:0;
}
