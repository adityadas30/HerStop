# Migration inventory — local audit, 2026-10-15

Scope: base `5062c31`, branch `paseo/db-staging-prep`; 008/009 rows added 2026-10-16 after the security re-review. No remote inspection by this engineer. Live facts below are the Lead's supplied 2026-10-15 inspection, not historical migration comments. SQL files 001–007 are unchanged. “001” means `docs/schema.sql`.

## Actual starting state

`herstop`: six stops, IDs `1`–`6`; ID `1` is **Willow Creek Plaza TEST**. Columns, in order: `id,name,address,latitude,longitude,badge,categories,tags,rating,review_count,image_url,image_color,created_at`. `saved_stops=2`, `reviews=0`, `profiles=0`, `auth.users=1`. No public functions/triggers; policies exactly 002's set plus the stops read policy. Saves have `(user_id,stop_id)` uniqueness; reviews do not. Migration history is empty despite the manually applied 001/002 schema. Security advisor reported only leaked-password protection disabled. This is not evidence that the application has no security risks.

## Objects and effects

| Version | Exact schema/security/data effects |
|---|---|
| 001 | Creates `stops`: text PK `id`; required name/address; float8 latitude/longitude default 0; badge default `good`, CHECK in `recommended,good`; text[] categories default `{}`; jsonb tags default `[]`; float4 rating and int review_count default 0; nullable image_url; image_color default `#C9B8A8`; created_at default now(). RLS on, `Public read access` SELECT USING true for PUBLIC. Inserts six **fictional** seeds with nonzero fictional ratings/counts. No FK, function, trigger or explicit GRANT. Not transaction-wrapped; not re-runnable because CREATE POLICY has no preceding DROP, and seeds are plain INSERTs. Evidence: `docs/schema.sql:8–32`, seeds `34–111`. |
| 002 | Creates `profiles` (id UUID PK/FK auth.users CASCADE, nullable display_name, created_at/updated_at default now()); `saved_stops` (UUID PK default gen_random_uuid, required user_id FK auth.users CASCADE, required stop_id text FK stops CASCADE, created_at default now, UNIQUE user_id/stop_id, user_id index); `reviews` (UUID PK/default gen_random_uuid, required stop_id/user_id FKs CASCADE, five required smallint ratings CHECK 1–5, loitering CHECK low/medium/high, required boolean would_stop_again, time CHECK day/night/unknown, nullable note CHECK length ≤280, is_hidden false, created_at now, stop_id/user_id indexes). Enables RLS on all three. Creates 11 policies listed below. No rows inserted, functions/triggers/grants absent. Not transaction-wrapped. Evidence: `002_auth_tables.sql:35–167`. |
| 003 | Transaction/5s lock timeout. Adds UNIQUE `reviews_user_id_stop_id_key`; removes public reviews policy; replaces insert/update predicates with caller ownership AND not is_banned(auth.uid()); replaces delete predicate with ownership AND not hidden. Creates `banned_users` (user UUID PK/FK CASCADE, reason, created_at), `hidden_reviews` (composite user/review PK, both FKs CASCADE, created_at), `review_reports` (UUID PK/default, review/reporter FKs CASCADE, reason enum CHECK, nullable note length CHECK ≤280, note snapshot, created_at, UNIQUE review/reporter, review_id index). All three have RLS and **zero policies**. Adds seven functions and one trigger, detailed below. No seed/data insertion; duplicate existing reviews would abort unique creation. Evidence: `003_reviews_privacy_and_moderation.sql:39–220,264–650`. |
| 004 — SKIP | Historical transaction deletes six legacy IDs without a source filter, cascading to saves/reviews, then inserts/upserts 18 curated real stops using ID conflict handling. No new schema/policies/grants/functions. On an isolated 001/002 starting state it would replace six with 18 and remove the two saves. **Never include in the staging sequence.** |
| 005 | Transaction/5s timeout. Adds source text NOT NULL DEFAULT manual; source_id text backfilled from id then NOT NULL with **no default**; nullable stop_type; updated_at timestamptz NOT NULL DEFAULT now(); nullable safety_context jsonb. Creates unique **index**, not named table constraint, `stops_source_source_id_key(source,source_id)`. Adds invoker trigger function `set_stops_updated_at()` and BEFORE UPDATE row trigger `stops_set_updated_at` forcing now(). No RLS/grant changes; inherited function EXECUTE defaults remain. Does not delete rows. Evidence: `005_stops_provider_fields.sql:21–62`. |
| 006 | Transaction/5s timeout. Deletes only IDs `1`–`6` with source manual; inserts 44 OpenStreetMap rows. INSERT explicitly sets id/source/source_id/name/address/coordinates/categories/stop_type/tags=[]/rating=0/review_count=0; badge/image fields/timestamps get defaults. Conflict target `(source,source_id)` updates **only** name,address,latitude,longitude,categories,stop_type; trigger refreshes updated_at. Does not reset existing rating/tags/review_count or change ID. No schema/policy/function/grant additions. Not a sync deletion of all old OSM rows: extra pre-existing OSM rows remain, so 44 assumes the documented starting state. Evidence: `006_ingest_real_stops.sql:21–82`. |
| 008 (final candidate, `docs/sprint-2/proposed-fixes/`) | Transaction/5s timeout. Creates owner-only schema `herstop_rollback` + table `state` and stores the five pre-008 function definitions (no user content). Adds `reviews.edited_at timestamptz NOT NULL DEFAULT now()`, backfilled to created_at. Replaces `reviews_enforce_invariants()`: client inserts force edited_at=now(); client updates pin edited_at and set it to now() **only if some other column actually changed**, so a no-op upsert is not an edit. Guarded text substitutions make get_stop_reviews/get_stop_review_stats/report_review/hide_review use `greatest(created_at, edited_at)` for the daily cutoff; they abort on source drift. Not re-runnable (ADD COLUMN). |
| 009 (final candidate) | Transaction/5s timeout. Requires `herstop.object_creator_role` = current_user, a single owner for all public tables/functions, and 008 metadata. Stores pre-009 policies/functions/grants/default ACLs (for PUBLIC/anon/authenticated) in `herstop_rollback.state`. Adds `is_caller_banned()` (definer, empty search_path). Recreates the reviews INSERT/UPDATE/DELETE policies `TO authenticated`, with insert/update checking `not public.is_caller_banned()`. Rewrites report_review/hide_review with empty search_path and fully qualified names, refusing banned callers with 42501. Revokes TRUNCATE/REFERENCES/TRIGGER on all public tables, everything on the three moderation tables, and CREATE on schema public. Revokes default TRUNCATE/REFERENCES/TRIGGER (tables) and EXECUTE (functions), global and in-schema, **for current_user's default ACLs only**. Revokes EXECUTE on all public functions, then grants an explicit allowlist. Ends with an effective-privilege check that aborts on any leftover client grant. |
| 007 | Creates/replaces `public.delete_my_account()` void SECURITY DEFINER, empty search_path, uses qualified auth.uid()/auth.users, no arguments. Raises 28000 without a caller; removes only caller's auth.users row, with cascading effects below. Revokes EXECUTE from PUBLIC/anon, grants authenticated. No immediate data change until called. No enclosing transaction/lock timeout in the original file: founder should wrap the **whole file** in a transaction. Evidence: `007_delete_my_account.sql:71–93`. |

All evidence paths without a directory prefix above are under `docs/migrations/`.

## Policy inventory

002 policy names (all default `TO PUBLIC`; predicates constrain identities):

| Table | Policies and command/predicate |
|---|---|
| profiles | `Users can read own profile` SELECT uid=id; `Users can insert own profile` INSERT CHECK uid=id; `Users can update own profile` UPDATE USING/CHECK uid=id. No DELETE. |
| saved_stops | `Users can read own saved stops` SELECT uid=user_id; `Users can save stops for themselves` INSERT CHECK uid=user_id; `Users can unsave their own stops` DELETE uid=user_id. No UPDATE. |
| reviews | `Anyone can read visible reviews` SELECT not is_hidden; `Authors can read their own review even if hidden` SELECT uid=user_id; `Authenticated users can write their own review` INSERT CHECK uid=user_id; `Authors can edit their own review` UPDATE USING/CHECK uid=user_id; `Authors can delete their own review` DELETE uid=user_id. |

003 leaves the own-author SELECT unchanged and replaces only the three write policies as described above. It leaves stops/profiles/saved_stops policies unchanged. **Never reapply 002 after 003:** it restores author-ID public exposure and weakens moderation. Counts after 002: 12 public policies total (including stops); after 003: 11.

## Function/trigger inventory

| Function introduced in 003 | Behavior / execution privileges |
|---|---|
| review_publish_delay() → interval | Immutable SQL, returns 24 hours; invoker, search_path public,pg_temp; EXECUTE revoked from PUBLIC, no client grant. |
| is_banned(uuid) → boolean | Stable SECURITY DEFINER, public,pg_temp; queries arbitrary UUID. PUBLIC/anon revoked; authenticated granted. **Actual ban oracle**, despite private table. |
| reviews_enforce_invariants() → trigger | Invoker, search_path public; for actual current_user anon/authenticated inserts force now()/not hidden; updates pin created_at,is_hidden,stop_id,user_id. BEFORE INSERT OR UPDATE `reviews_enforce_invariants_trigger`. Removes prior `reviews_enforce_is_hidden_trigger` if present. No explicit EXECUTE revoke on trigger function. |
| get_stop_reviews(text) → table | Stable SECURITY DEFINER, public,pg_temp; max 50, descending creation time. Output: id,stop_id,overall_feeling,lighting,restroom_quality,cleanliness,staff_kindness,loitering_concern,would_stop_again,time_of_visit,note,created_month,is_mine,is_hidden. **No user_id or exact timestamp.** New/hidden own reviews allowed; others require not hidden and created_at before daily delay boundary; per-viewer hides and banned authors excluded. PUBLIC revoked; anon/authenticated granted. |
| get_stop_review_stats(text[]) → table | Stable SECURITY DEFINER, public,pg_temp; first 200 supplied stop IDs. Output: stop_id,review_count,avg_overall,avg_lighting,avg_restroom,avg_cleanliness,avg_staff,would_stop_again_count,loitering_high_count,night_count,night_low_lighting_count,last_review_month. Always excludes new/hidden/banned; does not filter personal hides or special-case author. PUBLIC revoked; anon/authenticated granted. |
| report_review(uuid,text,text default null) → void | SECURITY DEFINER, public,pg_temp; caller required; validates other-author visibility; inserts caller-scoped report and note snapshot, conflict no-op. Own author bypasses visibility check; **caller ban not checked**. PUBLIC/anon revoked; authenticated granted. |
| hide_review(uuid) → void | SECURITY DEFINER, public,pg_temp; caller required; own review is no-op; otherwise validates visibility, inserts caller-scoped preference, conflict no-op. **Caller ban not checked**. PUBLIC/anon revoked; authenticated granted. |

After 009: `is_banned`, `review_publish_delay` and both trigger functions are owner-only. Triggers still fire, since EXECUTE is checked only when the trigger is created. Execute allowlist: anon → get_stop_reviews, get_stop_review_stats. authenticated → those plus is_caller_banned, report_review, hide_review, delete_my_account. 008 changes the read cutoff for all four review functions to `greatest(created_at, edited_at)`, so an edited review leaves other viewers' results immediately and returns 24–48h later.

Table DML/TRUNCATE grants are **not established by 001–007**. Inventory them right after 002 on a fresh project (runbook §4a, both outcomes documented there). Inspect actual platform ACLs and default ACLs; RLS does not constrain TRUNCATE. The harness supplies explicit simulated grants and demonstrates this conditional failure. Later PUBLIC grants can confer privileges despite an earlier role-specific REVOKE; SQL grants are additive, not explicit deny rules.

## Dependency graph and row counts

```text
auth.users + auth.uid()/roles
          │
001 ────> 002 ────> 003 ─────┐
 │           └───────────────┼────> 007 (technical dependency: 002)
 └──────> 005 ───────────────┴────> 006
004: excluded, superseded
Fresh staging order: schema.sql (001) → 002 → [grant pre-check] → 003 → 005 → 006 → 007 → 008 → 009
Existing audited 001/002 shape: 003 → 005 → 006 → 007 → 008 → 009
Rollback order: 009 → 008 → 007 → 006 → 005 → 003
```

005 technically only needs stops/001; 006 operationally requires 002+003+005. 007 can technically work without 003, but the verified sequence includes it. 008 needs 003's functions. 009 needs 008's metadata and 007's function, because it grants delete_my_account explicitly. Each down refuses if a later layer is still installed (003_down checks for 008/009; 008_down checks for 009). 008/009 are for **fresh disposable staging only**, not production.

| Step from supplied live-shaped state | stops | saved_stops | reviews | profiles | auth.users | moderation tables |
|---|---:|---:|---:|---:|---:|---|
| Existing 001+002, no replay | 6 | **2** | 0 | 0 | 1 | absent |
| 003 | 6 | 2 | 0 | 0 | 1 | three tables, 0 each |
| 004 skipped | 6 | 2 | 0 | 0 | 1 | 0 each |
| 005 | 6 | 2 | 0 | 0 | 1 | 0 each |
| 006 | 44 | **0** | 0 | 0 | 1 | 0 each |
| 007 installed, not called | 44 | 0 | 0 | 0 | 1 | 0 each |
| 008, 009 | 44 | 0 | 0 | 0 | 1 | 0 each (schema/grant changes only) |

Fresh staging: 001 creates six fictional stops; 002 creates three empty tables. Without test users/imported data, auth.users and saved_stops stay 0 throughout, stops become 44 at 006. Do not import production identity data merely to get the table above: the harness uses a synthetic user and two synthetic saves to reproduce its shape.

## Why 004 must be skipped

The DO-NOT-RUN banner is `004_seed_real_stops_i65.sql:1–9`: superseded by 006, fails after 005, and is the hand-curated 18-row predecessor. 005 makes source_id NOT NULL with no default (`005:26,36–39`); 004's INSERT omits it. The harness actually attempts 004 after 005 and gets SQLSTATE **23502**, then confirms the transaction left stops unchanged. 006's own supersession statement is `006:13–16`. Historical advice later in 004 to apply 003→004 is obsolete.

## Cascades and recovery consequences

001 defines the stops parent, **no FK itself**. The child FK clauses are `002:70–71,114–115`: both saved_stops.stop_id and reviews.stop_id are `ON DELETE CASCADE`. With the inspected six parent IDs and enforced FKs, the two saves **must** reference IDs 1–6; 005 labels these manual; 006 deletes them, so **both saves will be deleted**. Export them before apply. Pre-flight confirms exactly which rows:

```sql
select s.id, s.user_id, s.stop_id, s.created_at, t.name
from public.saved_stops s join public.stops t on t.id=s.stop_id
where t.id in ('1','2','3','4','5','6') order by s.id;
select r.id, r.user_id, r.stop_id from public.reviews r
where r.stop_id in ('1','2','3','4','5','6');
```

Expect two saves and zero reviews. After 005 additionally require source='manual' for all six. Any mismatch stops the run for re-inventory. Public reviews deleted by stop/user cascades also remove reports and hides (`003:182–185,209–215`). Account deletion removes the caller's profile, saves, reviews, ban, hides and reports **filed by** them; it also removes other users' hides/reports **about** the departing author's reviews. Other users' unrelated data remains. A ban does not physically delete reviews, but filters them from all public counts; deletion and bans can cause correlated count drops across stops.

006_down reconstructs explicit 001 seed literals, with fresh default timestamps. It cannot reconstruct the live TEST rename, original timestamps or two saves. Backup restore is a separate required step. 003_down is a privacy downgrade and refuses populated reviews or moderation tables. See the runbook and risk register for stop conditions.
