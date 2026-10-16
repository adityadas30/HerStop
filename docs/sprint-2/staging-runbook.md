# HerStop separate staging rehearsal

Prepared locally on 2026-10-15 at base `5062c31`. **No remote action has been performed.** Use a separate project named **herstop-staging**. Production ref `xnkjqcygzjlspeagcoal` is prohibited for this procedure. Check the dashboard project name AND URL/ref before every SQL/import/auth action. Never treat a place as guaranteed safe; the app provides decision context.

The independent review verdict is **APPROVE WITH CHANGES for staging; fix before production**. B1 (published-review edits bypass the reporting window) blocks production. Other privacy/moderation risks and platform checks are in [risk-register.md](risk-register.md). A passing local test does not approve production. Proposed 008/009 are separate files, not part of the 001–007 apply plan.

## 1. Local evidence and prerequisites

```sh
PATH=/Users/adityadas/.nvm/versions/node/v24.14.1/bin:$PATH node tools/db-test/run.mjs
```

Local result: 37/37 checks passed. Known-risk tests PASS when they reproduce the documented vulnerability. Exact migrations run in in-process PGlite, with synthetic identities, simulated grants, catalog rollback comparisons and CSV backup round trip. No extension substitution was needed. See [tooling README](../../tools/db-test/README.md) for limits. No `.env` file was read; only PGlite installation used network. Mobile package/lockfiles and original migrations are unchanged.

Founder prerequisites: separate project, dashboard access, two **new disposable** accounts with no existing app data, a secure local backup folder, and a quiet maintenance window. Pause app clients, test automation and ingestion during apply/rollback/restore. Do not copy real users' data into staging just to match production counts. Enable Email + Password for the test accounts and disable confirm-email **only in staging**, or explicitly pre-confirm those disposable users. These settings are for password tests; separately configure OTP templates with `{{ .Token }}` in both signup and magic-link templates. Password-test settings do not prove OTP works. Record the security advisor's leaked-password protection setting; the supplied live report says it is disabled. Do not assume staging inherits anything.

## 2. Read-only pre-flight and manifest

These queries are for the founder to run in the selected dashboard. The production-shaped expected results are supplied inspection facts, not permission to run migrations on production. A **fresh** staging database should have no public app tables; then start with 001. If staging is partially initialized, stop and compare its catalog to the inventory before choosing a resume point. Do not blindly replay 001/002.

```sql
select current_database(), current_user, current_setting('TimeZone');
select table_name from information_schema.tables
where table_schema='public' order by table_name;
select to_regclass('supabase_migrations.schema_migrations');
```

If app tables are absent, record the fresh baseline and proceed to backups/001; do not run the app-table queries below yet. If all four 001/002 tables exist, run the following. A partial set is a stop condition requiring catalog reconciliation.

```sql
select ordinal_position,column_name,data_type,is_nullable,column_default
from information_schema.columns where table_schema='public' and table_name='stops'
order by ordinal_position;
select count(*) as stops from public.stops;
select id,name from public.stops order by id;
select 'saved_stops' as table_name,count(*) from public.saved_stops
union all select 'reviews',count(*) from public.reviews
union all select 'profiles',count(*) from public.profiles
union all select 'auth.users',count(*) from auth.users;
select s.id,s.user_id,s.stop_id,s.created_at from public.saved_stops s
join public.stops t on t.id=s.stop_id
where t.id in ('1','2','3','4','5','6') order by s.id;
select conrelid::regclass,conname,pg_get_constraintdef(oid)
from pg_constraint where connamespace='public'::regnamespace order by 1,2;
select tablename,policyname,roles,cmd,qual,with_check from pg_policies
where schemaname='public' order by tablename,policyname;
select p.proname,pg_get_userbyid(p.proowner),p.prosecdef,p.proconfig,p.proacl
from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public';
select event_object_table,trigger_name from information_schema.triggers
where trigger_schema='public';
select user_id,stop_id,count(*) from public.reviews
group by user_id,stop_id having count(*)>1;
```

Only if the history existence probe returned a relation, run this separate query (absence is also an empty-history situation, not evidence that app schema is absent):

```sql
select * from supabase_migrations.schema_migrations order by version;
```

Expected supplied live shape: 6 stops IDs 1–6; ID 1 `Willow Creek Plaza TEST`; exactly 13 columns listed in [inventory](migration-inventory.md), no 005 columns. **Two saves**, both referencing those IDs, zero reviews/profiles, one auth user. Twelve policies including `Anyone can read visible reviews`; zero public functions/triggers; unique saves but no unique reviews; zero duplicate reviews. Migration history is **empty**. This contradicts old zero-save assumptions. **006 will delete both saves via FK cascades. Export them first.** Do not assume zero reviews merely because an anon API response is empty.

Save a dated manifest privately: project name/ref, time, DB version/timezone, exact applied files/checksums, table counts, ordered IDs, columns, constraints, policies, function definitions/owners/ACLs, triggers, default ACLs, history rows. Never attach private exports or credentials to git. Additional read-only manifest queries:

```sql
select version();
select grantee,table_name,privilege_type from information_schema.role_table_grants
where table_schema='public' order by table_name,grantee,privilege_type;
select n.nspname,pg_get_userbyid(d.defaclrole) as owner,d.defaclobjtype,d.defaclacl
from pg_default_acl d left join pg_namespace n on n.oid=d.defaclnamespace;
select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.prokind='f';
select pg_get_triggerdef(t.oid) from pg_trigger t join pg_class c on c.oid=t.tgrelid
where c.relnamespace='public'::regnamespace and not t.tgisinternal;
```

## 3. Backup BEFORE any destructive step

1. Quiesce writers. Record the manifest and counts in the same maintenance window as exports; independent dashboard CSV exports are not a transactionally consistent backup if writers continue.
2. Dashboard SQL Editor: run `select * from public.stops order by id;`, export the **complete result** as CSV. Repeat for saved_stops, profiles and reviews ordered by id. After 003 exists, also export banned_users ordered by user_id, hidden_reviews ordered by user_id/review_id, review_reports ordered by id. Export empty tables with headers too. Inspect export pagination/row limits and verify CSV data-row counts equal SQL counts; do not export a visible page accidentally. These tables are small here.
3. Save the exact column list/schema with each CSV. Preserve UUIDs, timestamp precision/timezones, NULL versus empty strings, PostgreSQL array syntax and JSON quoting. Keep the originals immutable, plus a checksummed copy. Store them encrypted with restricted founder access; they contain user identifiers, saves and moderation notes. Do not email or commit them. Keep at least the pre-003 and immediately-pre-006 bundles; the latter includes new columns.
4. For auth, record only the ID mapping/count required to validate FK parents in a private manifest. A public-table CSV backup **cannot recreate authentication accounts, identities, sessions, password hashes, audit logs, database roles, grants, functions, storage files or provider settings**. Do not manually reconstruct auth.users from a hand-written row. Same-project public-data restoration assumes original auth UUIDs still exist. If they do not, stop and use the full recovery path below. A new signup gets a different UUID and is not an identity-preserving restore.
5. Test restoration into an isolated disposable target before relying on backups. The local harness proves the specific seed/save CSV round trip; Dashboard CSV import, hosted auth recovery and point-in-time recovery are **UNVERIFIED** here.

Dashboard backup/PITR availability, retention, exact restore UI and plan-tier eligibility: **UNVERIFIED** (no network research or platform access was permitted). Founder must check the selected plan and record the backup ID/time, retention and restoration scope before relying on it. Database backups may not include storage object bytes, SMTP configuration or external logs. Preserve those separately if used. Never infer backup coverage from a green local test.

A full logical `pg_dump` requires the **database password**, which is never given to agents. Founder runs it from a trusted terminal using a verified connection host/port/user and compatible PostgreSQL client; use an interactive password prompt, never a password embedded in a URL, command, log or repository. Example shape (replace only non-secret connection placeholders locally):

```sh
pg_dump --host STAGING_DB_HOST --port STAGING_DB_PORT --username STAGING_DB_USER --dbname postgres --format=custom --file herstop-staging-before.dump --password
pg_restore --list herstop-staging-before.dump
```

Record successful exit, archive size/checksum and object list (including auth schemas if permitted). Ordinary pg_dump is read-only to the source but contains sensitive material. It does not include cluster roles; capture role/ownership/grant metadata separately. Managed Supabase auth/storage permissions may limit dump/restore: verify scope, do not label a partial dump “full.” Test the archive using a founder-controlled disposable database with the matching roles/extensions. `pg_restore --single-transaction --exit-on-error --dbname DISPOSABLE_TARGET herstop-staging-before.dump` is the restore shape, **not** an instruction to overwrite a managed project blindly. Pre-create required roles/extensions from the manifest in the disposable environment; any missing role, ownership, schema conflict or auth permission is a stop condition. For a hosted recovery, use the platform's confirmed restoration workflow/support for the selected plan, preserving managed auth ownership and re-checking every ACL/definer owner. That hosted path is **UNVERIFIED**, so account-deletion recovery is not promised by the public-table procedure.

## 4. Apply exact migration files, one checkpoint at a time

**Fresh staging:** `docs/schema.sql` → `002_auth_tables.sql` → `003_reviews_privacy_and_moderation.sql` → `005_stops_provider_fields.sql` → `006_ingest_real_stops.sql` → `007_delete_my_account.sql`. **Skip 004.** It is marked DO NOT RUN, superseded by 006, is only 18 curated rows, and fails after 005 because source_id is required. Do not run the ingestion generator: the reviewed SQL already contains 44 rows and generation would make external requests.

001 is **not safely re-runnable**: unguarded CREATE POLICY and fictional seed INSERTs. 002 is not safe to replay after 003 because it restores public author IDs. For an audited, already-applied 001/002 staging schema, start at 003. Empty migration history is not proof of an empty schema.

Founder pastes each complete file into the staging SQL Editor. 003/005/006 already include BEGIN/COMMIT and a five-second lock timeout. For 001,002,007, put `begin; set local lock_timeout='5s';` before and `commit;` after the entire file in one execution so grants/policies cannot be partly applied. On any error, issue ROLLBACK and investigate; do not continue from a partially highlighted selection. Compare post-state, then record the step.

| Applied step | Fresh stops / saves / auth users | Live-shaped rehearsal stops / saves / auth users | Other expectations |
|---|---|---|---|
| 001 | 6 / table absent / 0 | Already present, do not replay | fictional seeds only |
| 002 | 6 / 0 / 0 | 6 / **2** / 1, already applied | profiles/reviews 0, 12 policies |
| 003 | 6 / 0 / 0 | 6 / 2 / 1 | moderation tables 0, 11 policies, seven functions, one trigger |
| 005 | 6 / 0 / 0 | 6 / 2 / 1 | 18 stop columns, source manual/source_id=id, eight functions/two triggers |
| 006 | 44 / 0 / 0 | 44 / **0** / 1 | no IDs 1–6; 44 OSM rows; tags empty, ratings/counts 0, safety_context NULL |
| 007, before any call | 44 / 0 / 0 | 44 / 0 / 1 | nine functions/two triggers; account deletion now callable by authenticated only |

No test accounts should be counted until explicitly created; then adjust auth/users counts accordingly. All review/profile/moderation counts remain zero until tests write fixtures.

Post-005/006 SQL:

```sql
select source,count(*) from public.stops group by source;
select count(*) from public.stops where source_id is null;
select source,source_id,count(*) from public.stops group by source,source_id having count(*)>1;
select count(*) from public.stops where id in ('1','2','3','4','5','6');
select count(*) from public.stops where rating<>0 or review_count<>0 or tags<>'[]'::jsonb or safety_context is not null;
select count(*) from public.saved_stops;
select count(*) from public.reviews;
```

After 006 expect openstreetmap=44 and all other counts zero on this pristine dataset. Source data is a historical OSM snapshot, not verification of current facilities or conditions; attribution must appear in the app.

## 5. Verify 007 with SQL AND an actual caller

First `select to_regprocedure('public.delete_my_account()');` must be non-null. Only then run:

```sql
select has_function_privilege('authenticated','public.delete_my_account()','execute') as authenticated_can_execute,
       has_function_privilege('anon','public.delete_my_account()','execute') as anon_can_execute;
select p.prosecdef,p.proconfig,pg_get_userbyid(p.proowner) as owner,
       has_table_privilege(p.proowner,'auth.users','DELETE') as owner_can_delete_auth_users
from pg_proc p where p.oid='public.delete_my_account()'::regprocedure;
select has_table_privilege('anon','public.banned_users','TRUNCATE') as anon_ban_truncate,
       has_table_privilege('authenticated','public.banned_users','TRUNCATE') as auth_ban_truncate;
```

Expected execute true/false, prosecdef true, proconfig empty search_path; record proowner and **owner_can_delete_auth_users=true**. Repeat TRUNCATE checks for every public app table, especially review_reports/hidden_reviews. Any client TRUNCATE grant is a staging exposure: restrict access to disposable testing and review proposed 009 before opening staging to other users. Actual platform grants are **UNVERIFIED**, not supplied by PGlite. Permission checks alone do not prove the call can satisfy all managed auth/storage constraints; the throwaway account test below is mandatory. If 007 lacks owner DELETE privilege or a platform dependency blocks it, it should fail atomically; record the actual error privately, stop account-deletion signoff, and treat Apple's in-app deletion requirement as unmet.

Legacy scripts, founder only: `npm run supabase:check` from apps/mobile should report **44 rows** after 006. `npm run rls:check` should report **13/13**, but can report **13/13 even before 007**. The old **12/13 before 007 → 13/13 after** claim is incorrect: `apps/mobile/scripts/rls-check.mjs:373–380` treats missing-function PGRST202 as a PASS. It proves anon cannot call the endpoint, not that it exists. Those old scripts read a local `.env`; they were not run here. Founder must separately ensure their configuration is staging, since those scripts lack the new production guard.

## 6. Two-account public API staging test

The new script has not been run remotely. It uses password sign-in with the anon/public key only, refuses the production ref, requires the explicitly matching staging ref, and never logs keys/tokens/server payloads. It destroys **both test accounts** through 007 during cleanup. Use newly created empty disposable accounts; never your founder account. Provide credentials privately through terminal environment/secure session tooling, without committing them or putting passwords in shell history:

```text
EXPO_PUBLIC_SUPABASE_URL=https://<staging-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<staging public key>
HERSTOP_STAGING_PROJECT_REF=<staging-ref>
HERSTOP_TEST_DISPOSABLE_ACCOUNTS=YES
HERSTOP_TEST_USER_A_EMAIL=<disposable A>
HERSTOP_TEST_USER_A_PASSWORD=<private>
HERSTOP_TEST_USER_B_EMAIL=<disposable B>
HERSTOP_TEST_USER_B_PASSWORD=<private>
```

```sh
PATH=/Users/adityadas/.nvm/versions/node/v24.14.1/bin:$PATH node apps/mobile/scripts/rls-two-user-check.mjs
```

It checks A/B/anon isolation for profiles/saves/reviews, strict insert-as denials, own CRUD and invariants, public projection/delay, report/hide permissions, published edit exposure, hidden/banned handling, the arbitrary-UUID ban oracle, actual account deletion and B's surviving data. Risk assertions intentionally match unchanged 003; after proposed fixes are adopted, revise expected outcomes. This is interactive because public API clients cannot age reviews, set bans or inspect auth.users. At each checkpoint, use **only staging SQL Editor**; inspect the two fixture rows and their matching disposable account emails before mutating. If there are extra marker rows, stop. The marker is `HerStop staging RLS fixture` and A/B suffixes. Do not log these IDs publicly.

**AGE checkpoint:** verify exactly the two test reviews; age them to exercise existing public reviews without waiting up to 48 hours:

```sql
select id,user_id,note from public.reviews where note like 'HerStop staging RLS fixture %';
-- Only after verifying both user IDs belong to the disposable accounts:
update public.reviews set created_at=now()-interval '3 days'
where note in ('HerStop staging RLS fixture A','HerStop staging RLS fixture B');
```

**HIDE checkpoint:** after API report/hide, inspect one B→A report with review_note_snapshot=`HerStop staging RLS fixture A edited-public` and one B→A hide. Also verify one A→B report/hide (B snapshot is `HerStop staging RLS fixture B`) so later deletion checks cover data **filed by A**, not just data about A. Then globally hide A:

```sql
select count(*) from public.review_reports rr join public.reviews r on r.id=rr.review_id
where r.note='HerStop staging RLS fixture A edited-public';
select rr.review_note_snapshot from public.review_reports rr join public.reviews r on r.id=rr.review_id
where r.note='HerStop staging RLS fixture A edited-public';
select count(*) from public.hidden_reviews h join public.reviews r on r.id=h.review_id
where r.note='HerStop staging RLS fixture A edited-public';
select rr.reporter_id,r.user_id,rr.review_note_snapshot from public.review_reports rr
join public.reviews r on r.id=rr.review_id where r.note='HerStop staging RLS fixture B';
select h.user_id as viewer,r.user_id as author from public.hidden_reviews h
join public.reviews r on r.id=h.review_id where r.note='HerStop staging RLS fixture B';
update public.reviews set is_hidden=true where note='HerStop staging RLS fixture A edited-public';
```

**BAN checkpoint:** unhide A; insert B's ban. Public A was personally hidden only from B, which does not prevent later reporting/hiding. Inspect return rows before continuing.

```sql
update public.reviews set is_hidden=false where note='HerStop staging RLS fixture A edited-public';
insert into public.banned_users(user_id,reason)
select user_id,'Disposable staging RLS fixture' from public.reviews
where note='HerStop staging RLS fixture B';
```

**DELETE checkpoint:** the script has actually called delete_my_account as A. Use A/B UUIDs recorded privately before the call, replacing placeholders below. Require A auth/profile/save/review/ban/reporter/hider rows absent; B auth/profile/save/review/ban intact; reports/hides referencing A's deleted reviews gone. A's password sign-in should fail; an old JWT may remain valid until expiry, so token validity alone is not proof of continued account existence. This manual query is essential because the public API cannot inspect auth.users:

```sql
select id from auth.users where id in ('<A-UUID>'::uuid,'<B-UUID>'::uuid);
select id from public.profiles where id in ('<A-UUID>'::uuid,'<B-UUID>'::uuid);
select user_id,count(*) from public.saved_stops where user_id in ('<A-UUID>'::uuid,'<B-UUID>'::uuid) group by user_id;
select user_id,count(*) from public.reviews where user_id in ('<A-UUID>'::uuid,'<B-UUID>'::uuid) group by user_id;
select user_id from public.banned_users where user_id in ('<A-UUID>'::uuid,'<B-UUID>'::uuid);
select count(*) from public.review_reports where reporter_id='<A-UUID>'::uuid or review_id='<A-REVIEW-UUID>'::uuid;
select count(*) from public.hidden_reviews where user_id='<A-UUID>'::uuid or review_id='<A-REVIEW-UUID>'::uuid;
```

After typing verified, cleanup deletes B too. Repeat these queries: both users and all their dependent rows should now be absent, stops still 44. If cleanup reports failure or the process is interrupted, inspect both accounts and all fixture rows immediately; remove only those disposable fixtures through the dashboard after recording the failure. A failed 007 can leave profiles/moderated reviews/evidence that ordinary RLS deletes cannot remove. Never mark cleanup complete without the post-count check. `MANUAL` output means founder attestation, not automated API proof.

The exact daily cutoff and destructive stop cascade are automated locally. To independently repeat timing on staging, use a disposable review at `date_trunc('day',now()-interval '24 hours')`: anon stats must exclude it; set it one microsecond earlier: include it. Restore the timestamp afterward. Set the database/session timezone UTC and record it; SQL uses session timezone, not a hard-coded UTC conversion. A review in this 24-hour bucket is revealed by daily publication, so month-only display does **not** imply month-only timing privacy. Do not delete one of the 44 staging stops to test cascades; the harness already proves the actual FK graph. Rehearse a separate disposable stop only if a founder needs hosted FK evidence, then compare saves/reviews/reports/hides before/after.

## 7. History consistency — choose explicitly, never blindly push/repair

The live history is empty because SQL Editor was used, not because migrations are unapplied. Do not run blind `supabase db push` or `migration repair` to make that warning disappear.

| Option | Benefit | Risk / required proof |
|---|---|---|
| Continue manual apply and record verified versions in `supabase_migrations.schema_migrations` | Minimal change for this rehearsal; aligns ledger after actual successful SQL | Directly edits a CLI-owned metadata table. Inspect its current columns/tool version first; record only audited applied versions, names and exact SQL/checksums. Never record 004. A ledger row is not schema verification. |
| Adopt CLI migrations from an audited baseline | Repeatable future fresh projects and consistent history | Requires a deliberately reviewed schema baseline, matching timestamped migration filenames and fresh rebuild test; accidental baselining of live drift or fictional seed replays is dangerous. No CLI adoption/push is authorized in this local task. |

**Recommendation for this staging rehearsal:** manual files + manifest first, then founder-reviewed history registration only after every catalog/post-check passes. Establish a stable version-to-file mapping before recording anything (001/002/003/005/006/007, 004 explicitly skipped); keep that same mapping if timestamped CLI copies are introduced later. Inspect `information_schema.columns` for the history table and compare the installed CLI's expected format before preparing an INSERT. Export existing history first; if a version already exists with conflicting SQL/name, stop, do not overwrite it. Register no failed, skipped, or hypothetical migration. Do not mutate production history as part of staging preparation. For ongoing development, plan a separate audited CLI-baseline adoption and rebuild an empty disposable project before trusting push. This document intentionally supplies no blind history INSERT or repair command.

## 8. Rollback and restore

Stop writers; make a second backup of the current state so post-migration user data is not silently lost. Inspect guards before doing anything. Rollback order is **007 → 006 → 005 → 003**. No 001/002 rollback is supplied; never remove auth/user tables to reset staging casually.

| Down file | Stop condition / loss |
|---|---|
| 007_down | Removes endpoint only; deploy/disable dependent client first. Does not restore deleted users/data. If 008/009 or other later changes exist, do not use this baseline rollback plan without revising dependencies. |
| 006_down | Deletes **all** source=openstreetmap rows, including later ingestion/edits; default is refusal until explicit flag. Refuses any saves/reviews referencing those rows even with flag. Refuses existing changed/reserved legacy IDs. Reconstructs explicit 001 values, not TEST name/timestamps/lost saves. Other sources are retained. Extra non-OSM rows require re-inventory before 005_down. |
| 005_down | Refuses until operator attests **no code path needs columns**. Stop ingestion (`ingest-osm-stops.mjs` uses them), roll back/disable dependent app/jobs. PostgreSQL cannot inspect deployed code. Also refuses non-default provider data, stop_type/safety_context. Loses updated_at history and provider fields; no CASCADE drop. |
| 003_down | **Export bans/reasons, reports/snapshots and hides first**, plus reviews. Requires stopped-client attestation and refuses any reviews or moderation rows. Restores 002 public author-ID reads and weaker moderation; never expose that state to real users. Do not delete evidence just to satisfy a guard. |

Each file has BEGIN/COMMIT, 5s lock timeout, locks where data inspection precedes deletion, and idempotent object drops where possible. Apply flags in the **same SQL Editor execution/session** immediately before the relevant complete file, only after the checks are true:

```sql
set herstop.rollback_006_allow_osm_loss='on';
-- paste complete 006_down.sql here; never set this flag without exports
```

Equivalent attestation settings: `herstop.rollback_005_columns_unused='on'` and `herstop.rollback_003_clients_ready='on'`. Do not enable all flags reflexively. If a guard fails, ROLLBACK and stop. A populated staging database may need restoration into a new isolated project instead of down-migrations. Never discard data to make a test green.

**CSV restoration of the actual six stops and two saves** (same project, original auth users still present):

1. Finish the approved downs to the matching backup schema; for the pre-apply 13-column stops CSV, finish 005_down first. Preserve 003 if it has real review/moderation data; do not downgrade privacy merely to restore stops. Confirm all exported saved_stops.user_id values still exist in auth.users. Missing parent → stop; public CSV cannot repair auth.
2. Create typed import tables using the transaction below. LIKE copies types and NOT NULL but does not copy FKs, unique indexes or CHECK constraints unless requested. RLS and revoked grants keep these operational import tables inaccessible to API clients before any CSV upload. Use Dashboard Table Editor Import CSV to load the original files; match column headers/types. The matching-schema approach avoids source_id NOT NULL failures. Do not import into the live stops table over conflicting IDs.

```sql
begin;
set local lock_timeout='5s';
create table public.herstop_restore_stops (like public.stops including defaults);
create table public.herstop_restore_saved_stops (like public.saved_stops including defaults);
alter table public.herstop_restore_stops enable row level security;
alter table public.herstop_restore_saved_stops enable row level security;
revoke all on public.herstop_restore_stops,public.herstop_restore_saved_stops from public,anon,authenticated;
commit;
```

3. Validate import counts (6/2), all IDs, arrays/tags JSON, NULLs, names including TEST, timestamps; check duplicate primary IDs and user/stop pairs, and left-join saves to import stops/auth.users for orphan checks. An empty-string/NULL or parser mismatch → stop and fix the import mapping, not the original backup.
4. In one transaction with 5s lock timeout, lock stops/saved_stops; upsert **every exported stop field** by ID, then insert the saved rows with their **original IDs and timestamps**. For the pre-005 schema, the merge is:

```sql
begin;
set local lock_timeout='5s';
lock table public.stops,public.saved_stops in access exclusive mode;
insert into public.stops
select * from public.herstop_restore_stops
on conflict(id) do update set
 name=excluded.name,address=excluded.address,latitude=excluded.latitude,longitude=excluded.longitude,
 badge=excluded.badge,categories=excluded.categories,tags=excluded.tags,rating=excluded.rating,
 review_count=excluded.review_count,image_url=excluded.image_url,image_color=excluded.image_color,
 created_at=excluded.created_at;
insert into public.saved_stops select * from public.herstop_restore_saved_stops;
-- Fail atomically if the imported backup and restored rows differ.
do $$
begin
  if (select count(*) from public.herstop_restore_stops)<>6
     or (select count(*) from public.herstop_restore_saved_stops)<>2
     or exists (select * from public.herstop_restore_stops except select * from public.stops)
     or exists (select * from public.herstop_restore_saved_stops except select * from public.saved_stops)
     or exists (select * from public.stops where id in (select id from public.herstop_restore_stops)
                except select * from public.herstop_restore_stops)
     or exists (select * from public.saved_stops where id in (select id from public.herstop_restore_saved_stops)
                except select * from public.herstop_restore_saved_stops) then
    raise exception 'Restore manifest/data mismatch; rollback required';
  end if;
end $$;
commit;
```

Run that entire merge/validation transaction in one execution; assertions abort on differences before COMMIT, avoiding assumptions about SQL Editor connection persistence. The 6/2 assertions apply to the supplied live backup; fresh-staging backups require the manifest's actual counts. A duplicate saved row is deliberately an error, not an ignored conflict: ROLLBACK and compare it to the backup before retrying. Extra unrelated current rows must not be removed just to match a manifest. For post-005 backups, import the 18-column schema instead, include all five provider fields in the merge, and either accept/record updated_at being refreshed by the trigger (compare other columns explicitly) or plan a founder-reviewed exact-timestamp restore with the trigger temporarily disabled inside the locked transaction and re-enabled before commit. The harness verifies every field except this intentional updated_at refresh.

5. If other public tables need restoration, use the same protected typed-import/validation pattern in FK order: profiles (auth parent must exist), stops, saved_stops/reviews, banned_users, then review_reports/hidden_reviews. For reviews ensure author/stop parents exist, uniqueness holds and moderation flags/timestamps are preserved by the owner-run restore. Import all columns, including note snapshots. Reject unexpected existing rows rather than overwriting post-backup user edits silently. No RLS disable is necessary for owner-run imports. Export restore differences privately for audit.
6. Re-run manifest/ACL/policy/function checks, counts and A/B isolation before reopening clients. Keep imports inaccessible until accepted, then remove only these two restore tables as an explicit founder cleanup; retain the encrypted backup bundle under the retention policy. Source backups and DB snapshots may retain data after account deletion. Privacy wording must not promise complete erasure from audit logs or backups.

## 9. Nine live acceptance requirements — founder checklist

| Requirement | Staging evidence to record |
|---|---|
| 1. 44 real stops and Apple Maps directions | SQL count 44, live catalog without fallback/TEST rows, OSM attribution, several stop-detail directions open correct Apple Maps destinations on iPhone. No claim that any place is safe. |
| 2. Email OTP | New and returning account receive a numeric code, verification succeeds, wrong/expired codes fail; record delivery/provider setup without tokens. |
| 3. Session restore | Relaunch app signed in, refresh works, sign-out clears session/user UI and private state. |
| 4. Persisted saves | Save, relaunch, observe same account's save; second account cannot see it. |
| 5. Save failure rollback | Simulate offline/request rejection during optimistic save; UI rolls back, error is understandable, no ghost save after reconnect. |
| 6. Write/edit/delete review | Own form persists; duplicate per stop prevented; ordinary own deletion works, moderated deletion blocked. Record B1 reproduction now and require proposed fix/retest before production. |
| 7. Report/hide | Visible review reports idempotently with snapshot; personal hide only affects caller; global hide/bans respected; record banned-caller gap until fixed. |
| 8. Delete account | SQL owner/grant checks plus actual throwaway RPC; auth.users/profile/saves/reviews/reports/hides/ban checks, B retained, local sign-out. Inspect storage ownership and platform auth dependencies. Failure blocks account-deletion signoff. |
| 9. Cross-user isolation | New two-user script and local harness results; direct base-table UUIDs hidden from other users/anon, own operations work, public RPC projection contains no author UUID. |

Record PASS/FAIL/UNVERIFIED with date, target ref, app build and tester. None of these nine live requirements has been verified by this local-only task. Stop before production until B1 and agreed security changes are reviewed, platform grants/007 deletion are proven, and this checklist is complete.
