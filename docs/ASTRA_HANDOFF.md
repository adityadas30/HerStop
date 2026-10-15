# HerStop — Astra Development Handoff

_Last verified against the repository: 2026-09-22, commit `6100f01` on `astra/full-development`._

## Product Mission

HerStop is an iOS-first app that helps women driving alone on medium and long trips find
better places to stop for gas and restrooms — by combining route-aware discovery, area
safety context, and structured community reviews.

**HerStop helps users make better stop decisions with better context. It does not guarantee
safety.** This is a hard product boundary, not a copy nitpick: the app must never claim a
place is "safe," "verified safe," "guaranteed safe," or "crime-free." Approved language
instead: **Recommended Stop · Good Option · Use Caution · Limited Data · better-reviewed ·
higher-confidence · recent traveler feedback · area safety context.** A pre-commit-style
hook (`.claude/hooks/check-product-language.py`) blocks the banned phrases in `apps/mobile`
copy — it's a real, enforced gate, not just a style guide.

Product philosophy, in order of priority:
1. **Real data over fake data.** Nothing user-facing may be fabricated — no invented ratings,
   reviews, users, crime stats, or "safe" verdicts. Where real data doesn't exist yet, the UI
   must say so honestly (e.g. "Limited Data", "Coming Soon") rather than fill the gap with
   something that looks real.
2. **Confidence, not false precision.** Recommendation labels come from real review volume and
   content, with an explicit confidence band (low/medium/high) — a stop with 2 reviews is never
   presented with the same certainty as one with 20.
3. **Browse without an account; act with one.** Guest browsing works for Explore/search/stop
   detail. Saving a stop or writing a review requires sign-in.
4. **Mock data is a development fallback only**, and it's visibly wired as one (see "Real vs
   Mock Data" below) — it must never silently masquerade as live data.

## Current Stack

- **Expo** ~54.0.33 (React Native 0.81.5, React 19.1.0), **Expo Router** ~6.0.23 (file-based
  routing, typed routes on), **TypeScript** ~5.9.2 (strict mode, `tsc --noEmit` must pass clean).
- **Supabase** (`@supabase/supabase-js` ^2.104.0) — Postgres + RLS + Auth (email OTP) + RPC
  functions. This is v1 backend; **do not migrate off it** without a founder decision.
- **expo-location** ~19.0.8 — foreground-only device location (added 2026-09-22, this session).
- State/data: no Redux/Zustand — plain React context (`contexts/auth.tsx`,
  `contexts/saved-stops.tsx`) + a thin Supabase data-access layer (`lib/api.ts`).
- No test framework (no Jest). No Maestro E2E either, historically — flows exist at
  `apps/mobile/.maestro/` but Maestro's actual install/run status should be re-verified by
  Astra, not assumed from old logs.
- **Not yet integrated, despite being named in some docs/CLAUDE.md as intended stack:** Google
  Maps APIs (no `react-native-maps`, no Maps SDK, no map view — the map icon button in the
  Explore header does nothing), Sentry, PostHog (cut), `expo-dev-client` (still Expo Go only).
- Monorepo shape: `apps/mobile` (the real app, has its own `package.json`), `packages/{ui,types,
  scoring}` (all **completely empty directories** — not stubbed, not wired into any build,
  despite CLAUDE.md listing them as part of the stack), `docs/`.

## Repository Starting Point

- **Astra branch:** `astra/full-development`
- **Base commit:** `6100f01` (branched directly from `agent/agent-os-v0.2` at the same commit —
  no rebase, no squash, full history preserved)
- **Remote:** `origin` = `https://github.com/adityadas30/HerStop`
- **Monorepo root:** `/Users/adityadas/herstop` (this repo's root — no other path on this
  machine is "the project"). The real app lives at `apps/mobile/`; run all app commands from
  there.
- This branch is a superset of every other branch in the repository — see "Branch Consolidation"
  below for the exact verification.

## How To Run

All commands verified working in this session, from `apps/mobile/` unless noted:

```bash
npm install                # install deps (apps/mobile/ has its own package.json + lockfile)
npx tsc --noEmit            # typecheck — verified clean, must stay clean
npm run lint                 # eslint (expo lint) — verified clean
npm run ios                  # Simulator — see "Known blocker" below, currently broken on this Mac
npm run supabase:check       # read-only anon-key live read of `stops` — verified: LIVE, 6 rows
npm run rls:check            # read-only anon-key RLS assertions across all tables — verified: 5/12
                              # (7 failures are 100% expected: migration 003 not applied yet, see DB section)
node scripts/ingest-osm-stops.mjs [corridor-slug]   # re-run the real-stop ingestion pipeline
npx expo export --platform ios   # bundle-export smoke test (works even when Simulator doesn't) — verified clean, 1366 modules
python3 ../../.claude/hooks/tests/test_guards.py    # from apps/mobile/, or from repo root:
                                                      # python3 .claude/hooks/tests/test_guards.py — verified 29/29
```

No `npm test` / Jest — there is no test suite to run. No Supabase CLI / local Postgres setup in
this repo; all schema work is migration-first SQL files a human runs in the Supabase Dashboard
SQL Editor (see "Database" below) — there is no `supabase/` CLI directory.

**Never run `npm run reset-project`** — it destroys the app's starter scaffold, not a reset in
the "clean state" sense.

## Architecture

- **Routes** (`apps/mobile/app/`, Expo Router file-based):
  - `app/(tabs)/index.tsx` — Explore/Discover (main screen: search, filter chips, stop cards,
    now real-distance-sorted)
  - `app/(tabs)/saved.tsx` — Saved stops
  - `app/(tabs)/journeys.tsx` — **honest "Coming Soon" placeholder**, no logic
  - `app/(tabs)/safety.tsx` — **honest "In Development" placeholder**, no logic, no fake
    monitoring status
  - `app/(tabs)/profile.tsx` — sign-in (OTP) / account
  - `app/stop/[id].tsx` — stop detail (reviews, score, save, distance, OSM attribution)
  - `app/review/[stopId].tsx` — review form
  - `app/onboarding.tsx` — first-run
- **Data-access layer:** `lib/api.ts` — every Supabase read/write goes through here. Pattern
  throughout: try a live Supabase call, fall back to `MOCK_STOPS` (`data/mock-stops.ts`) only
  when Supabase is unconfigured, errors, or (for `getStops`) returns zero rows. `getSavedStops`
  is the one exception — an empty list is a real answer, so it never mock-falls-back to invented
  saved stops.
- **Supabase client:** `lib/supabase.ts` — anon key only, `supabaseConfigured` flag gates mock
  fallback vs. live calls project-wide.
- **Auth:** `lib/auth.ts` (thin Supabase Auth wrapper, email OTP) + `contexts/auth.tsx` (session
  restore from AsyncStorage, `onAuthStateChange` subscription, guest-by-default).
- **Saved stops:** `contexts/saved-stops.tsx` — optimistic toggle with rollback, derives the
  saved list from the live stop catalog (not a separately-cached copy), clears on sign-out.
- **Reviews:** `lib/scoring.ts` (pure `scoreStop()` function — no I/O, no fabrication, "Limited
  Data" below 3 reviews), `components/ReviewCard.tsx`, `app/review/[stopId].tsx`. Reads go
  through Postgres RPCs (`get_stop_reviews`, `get_stop_review_stats`) that exist only after
  migration `003` is applied (currently is not — see Database).
- **Location + distance (new, 2026-09-22):** `lib/location.ts` — `getCurrentCoords()`
  (foreground permission, one-shot, never persisted/logged), `distanceMiles()` (haversine),
  `formatDistance()`. Wired into Explore (sorts by real distance once granted; no permission =
  no fake sort, original catalog order instead) and stop detail (real distance appended to the
  address line).
- **Real-stop ingestion (new, 2026-09-22):** `scripts/ingest-osm-stops.mjs` — OSM Overpass API →
  normalize → dedupe → Nominatim reverse-geocode fallback for missing addresses → generates an
  idempotent SQL migration. Re-run it to refresh; it does **not** touch the live database itself
  (no Supabase credentials in the script at all) — it only writes local files.
- **Shared types:** `lib/types.ts` (DB row shapes: `Stop`, `Review`, `ReviewStats`, etc.),
  `data/mock-stops.ts` (`StopData` — the UI-facing shape, now carries `latitude`/`longitude`).
  Two parallel "stop" shapes (`Stop` = DB row, `StopData` = UI shape) are bridged by
  `dbToStopData()` in `lib/api.ts` — a real seam Astra will touch often; keep both in sync when
  adding fields.

## Environment Variables

| Variable | Required? | Used where | Currently configured locally? |
|---|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Required for live mode (else mock fallback) | `lib/supabase.ts`, both check scripts | Yes — `apps/mobile/.env` exists and is a real (non-placeholder) value, confirmed via `supabase:check` returning LIVE |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Required for live mode | same | Yes, same as above |

`apps/mobile/.env` is gitignored, per-machine — Astra (or a fresh clone/worktree) needs its own
copy from `apps/mobile/.env.example`. **Only the anon/public key is ever used** — a service-role
or other privileged Supabase key must never appear in app code, env files, or commands
(a guard hook, `.claude/hooks/guard-write.py`/`guard-bash.py`, blocks this — verified via the
guard test suite). No other env vars are read anywhere in `apps/mobile/`.

## Current Reality

| Capability | Status | Evidence / Code Path | Next Work |
|---|---|---|---|
| Real stops (gas/rest area) | **Partial** | `apps/mobile/scripts/ingest-osm-stops.mjs` (real, re-runnable OSM pipeline, obtained 44 real stops this session); generated migration `docs/migrations/006_ingest_real_stops.sql` **not yet applied** — live `stops` table currently still has the 6 fictional dev-seed rows (`npm run supabase:check` confirms) | Founder runs `005` then `006` in Supabase SQL Editor |
| Gas station source | **Working (pipeline), Blocked (live data)** | Same as above — OSM `amenity=fuel` via Overpass | Apply migration; consider adding a second corridor |
| Rest area source | **Working (pipeline), Blocked (live data)** | Same script, OSM `highway=rest_area`/`services`/`amenity=truck_stop` | Same |
| Device location | **Working** | `apps/mobile/lib/location.ts`, `expo-location` ~19.0.8, foreground permission | None blocking; consider a persistent "location denied" banner |
| Distance calc | **Working** | `lib/location.ts` `distanceMiles()` (haversine), wired into Explore sort + stop detail | None blocking |
| Map view | **Missing** | No `react-native-maps`, no Maps SDK anywhere; the map icon button in Explore header (`app/(tabs)/index.tsx`) has no `onPress` | Real gap — CLAUDE.md/STATUS call this "SHOULD SHIP" but zero code exists |
| Supabase (core) | **Working** | `lib/supabase.ts`, live reads confirmed repeatedly | None |
| Auth (OTP) | **Working** | `lib/auth.ts`, `contexts/auth.tsx`; verified end-to-end against the live API per `docs/features/auth-otp/verification.md` (real email, real code, real session) | None blocking |
| Saved stops | **Working** | `contexts/saved-stops.tsx`, `lib/api.ts` `toggleSaveStop`/`getSavedStops`; RLS-scoped to `auth.uid()`; `rls:check` confirms anon cannot read/write another user's `saved_stops` | Signed-in interactive Simulator verification still notionally open per old docs — re-verify if in doubt |
| Reviews | **Blocked (schema not live)** | `lib/api.ts` review functions call RPCs (`get_stop_reviews` etc.) defined in `docs/migrations/003_reviews_privacy_and_moderation.sql`, which is **not applied** (`rls:check` confirms: "function does not exist yet" x4, "table does not exist yet" x3) | Founder applies `003` |
| Crime data | **Missing — zero code, zero schema, zero API** | `lib/scoring.ts`'s own comment says so explicitly; confirmed by repo-wide search this session | No provider chosen yet. `safety_context jsonb` column added (migration `005`) as a **reserved, unpopulated** boundary only |
| Safety scoring | **Partial (real inputs, incomplete model)** | `lib/scoring.ts` `scoreStop()` — pure function, real review data in, real labels out (Recommended/Good/Use Caution/Limited Data), confidence-banded. The product brief's "area safety context = 20% of score" has **no data source**, so the function renormalizes to reviews (87.5%) + confidence (12.5%) only — documented in the code's own comment | Depends entirely on crime data landing first |
| Recommendation badges | **Real** (once 003 is live) | Computed only from real `reviews` rows via `scoreStop()` — `stop.rating`/`stop.badge`/`stop.reviewCount` columns exist in the DB schema but are **not read anywhere in the app** (grep-confirmed, see STATUS 2026-09-17 entry) | None — this is correctly implemented, just blocked on 003 being live |
| Search/filtering | **Partial** | Explore does client-side substring search (name/address) + category-chip filtering over the already-fetched full catalog — no server-side/radius query | Fine at current scale (tens of stops); revisit if catalog grows past a few hundred |
| Journeys tab | **Missing (honest placeholder)** | `app/(tabs)/journeys.tsx` — static "Coming Soon" card, no logic | Real feature, not started |
| Safety tab | **Missing (honest placeholder)** | `app/(tabs)/safety.tsx` — static "In Development" card, explicitly no fake monitoring status | Real feature, not started; depends on crime data |
| Analytics (PostHog) | **Missing, deliberately cut** | Not in `package.json`; STATUS 2026-09-10 records the cut | Founder decision if/when to re-add |
| Error tracking (Sentry) | **Missing** | Not in `package.json` despite being "late in sprint" per old STATUS — never landed | Not started |
| Dev build (`expo-dev-client`) | **Missing** | Not in `package.json`; app runs under plain Expo Go | Needed before any native module Expo Go can't support |
| TestFlight readiness | **Blocked on founder account actions** | `docs/release/testflight.md` — `eas init` never run (no EAS project ID in `app.json`), no EAS env vars set, Apple Developer membership status last noted as "still to be confirmed" | All founder-gated (Apple/EAS logins) |
| Bundle export smoke test | **Working** | `npx expo export --platform ios` — verified clean this session, 1366 modules | None |
| Simulator verification | **Currently broken on this machine** | `xcrun`/`simctl` refuse to run: "You have not agreed to the Xcode license agreements. Please run `sudo xcodebuild -license`." Needs an interactive password prompt no agent session can supply | Founder (or whoever has the machine password) runs that command once |

**Do not call something "Working" merely because `tsc` compiled** — every row above is graded on
whether real, verified behavior exists, not on type-checking.

## Real vs Mock Data

- **Real, live (once its migration is applied):** `stops` rows from
  `docs/migrations/006_ingest_real_stops.sql` (OpenStreetMap, ODbL-licensed, 44 stops as of
  2026-09-22 — ingested by `scripts/ingest-osm-stops.mjs`, ODbL attribution rendered in-app),
  `reviews` (once written by a real signed-in user, once `003` is applied), `saved_stops`,
  `profiles`/`auth.users` (real Supabase Auth).
- **Currently live but fictional — will be replaced when `006` is applied:** the 6 dev-seed
  `stops` rows from `docs/schema.sql` (`Willow Creek Plaza TEST`, `The Atlas Point`, `Meridian
  Transit Hub`, `Cedar Falls Rest Area`, `Sunrise Travel Center`, `Harbor View Stop`) — these are
  what a live app connection actually shows a user **right now**, today, until a founder runs the
  migration.
- **Mock/dev-fallback only, visibly gated:** `apps/mobile/data/mock-stops.ts` `MOCK_STOPS` — 6
  hand-written fictional stops, used **only** when `supabaseConfigured` is false or a live query
  errors/returns zero rows (`lib/api.ts` `getStops()`/`getStopById()`). Every `console.log`
  around this is tagged `MOCK` vs `LIVE` in `__DEV__` builds — there is no code path that could
  present mock data as if it were live without that log trail. Mock stops now also carry
  `latitude`/`longitude` (added this session) so distance sorting still demonstrates correctly in
  mock mode.
- **Never fabricated, by design:** ratings/badges/review counts are computed only from real
  `reviews` rows (`scoreStop()`), never invented; crime/safety data does not exist anywhere so
  there is nothing to fabricate there (the risk is a future contributor inventing some — the
  reserved-but-empty `safety_context` column exists specifically so that temptation has a correct
  home instead of a UI hardcode).
- **`badge`/`rating`/`review_count` columns still exist in the `stops` table schema** (legacy,
  from `docs/schema.sql`) but are confirmed **not read anywhere in current app code** — dead
  schema, not dead-but-secretly-used. Safe to ignore; not worth a migration to drop them yet.

## Database

- **Workflow: migration-first.** Every schema change is a `.sql` file in `docs/migrations/`,
  reviewed, then **run by a human** in the Supabase Dashboard SQL Editor. No agent (Claude or
  Astra) has write access to the live database — the anon key is the only credential present
  anywhere in this repo, and RLS + `rls:check` confirm anon cannot write to `stops`,
  `saved_stops`, or `reviews`.
- **Apply order for a from-scratch live database:** `docs/schema.sql` (001) → `002` → `003` →
  `005` → `006`. **Do not run `004`** — it's superseded by `006` (same intent — real OSM stops —
  but `006` is generated by code against the richer schema `005` adds, and was verified against
  live OSM data this session; `004` was a one-time hand-curated 18-row set with no ingestion
  code).
- **Migration status, verified this session (not assumed from old docs):**
  - `001` (`docs/schema.sql`, `stops` table + 6 fictional seed rows) — ✅ **applied** (confirmed
    live via `supabase:check`)
  - `002` (`profiles`, `saved_stops`, `reviews` + RLS) — ✅ **applied** (confirmed via `rls:check`:
    the `saved_stops`/`reviews` anon-read/write assertions all pass as expected for an applied
    schema)
  - `003` (reviews privacy/moderation: `review_reports`, `hidden_reviews`, `banned_users`, RPCs)
    — ⏳ **not applied** (confirmed via `rls:check`: 7 failures, all "function/table does not
    exist yet")
  - `004` — ⏳ not applied, **and should be skipped** (see above)
  - `005` (adds `source`/`source_id`/`stop_type`/`updated_at`/`safety_context` to `stops`) — ⏳
    not applied (written this session, not yet run against the live DB by anyone)
  - `006` (real OSM stop upsert, generated) — ⏳ not applied
- **RLS:** confirmed correct and current via `apps/mobile/scripts/rls-check.mjs` (anon-key,
  read-only assertions) — run it any time to re-verify rather than trusting this document.
  `guard-write.py`/`guard-bash.py` hooks additionally block RLS-weakening edits and any
  privileged-key usage at write time.
- **No hosted-schema diffing was done beyond what `supabase:check`/`rls:check` can infer** — no
  direct Postgres/service-role access exists in this environment, by design.

## Known Problems / Technical Debt

Meaningful, product-impacting items only:

1. **The live database does not yet match the code's expectations.** The app's review feature
   (`app/review/[stopId].tsx`, `lib/api.ts` review functions) calls RPCs that don't exist in the
   live DB yet (`003` unapplied) — that's surfaced as a real error state in the UI, not hidden,
   but it means reviews are non-functional in production today.
2. **Live stop data is fictional today.** Until `005`+`006` are applied, every real user sees
   the 6 dev-seed stops, not the 44 real OSM ones sitting ready in this repo.
3. **No map view exists**, despite being called "SHOULD SHIP" in prior planning docs. This is a
   real, unstarted feature, not a near-miss.
4. **`packages/{ui,types,scoring}` are empty directories** — the "monorepo" framing in CLAUDE.md
   is aspirational; there is exactly one real package (`apps/mobile`). Don't assume shared code
   exists there.
5. **Simulator verification is broken on this development machine** (`sudo xcodebuild -license`
   needed, interactively, by whoever has the password) — Astra should not claim a UI change is
   "verified" via Simulator without confirming this is fixed, and should fall back to
   `npx expo export --platform ios` (bundle-clean check) plus careful code reading otherwise.
6. **`agent/db-auth-tables-verify` and similar narrowly-scoped agent branches still exist locally**
   with their work already merged into this branch — safe to ignore, not cleaned up (branch
   history preserved per instruction).
7. **No EAS project is linked** (`app.json` has no `extra.eas.projectId`) — `eas build`/`eas
   submit` will not work until a founder runs `eas init` interactively.

## Critical Path to Finished Development

1. **Founder applies `005` then `006`** — turns the real stop pipeline built this session into
   what users actually see. This is not Astra's task (Astra has no DB credentials) but it is the
   single highest-leverage unblock in the repository right now; flag it prominently.
2. **Founder applies `003`** — unblocks reviews end-to-end (currently the write path exists and
   is correct, just aimed at RPCs that don't exist yet).
3. **Map view** — real, unstarted, high product value, no blocking dependency on other work.
4. **Crime/safety data foundation** — the biggest real gap. Requires a founder-level product
   decision (which provider/dataset, which jurisdictions) before any code — do not pick one
   unilaterally without flagging it; see "External dependencies" below.
5. **Explainable safety scoring** — once crime data exists, `lib/scoring.ts`'s renormalized
   weights (currently 87.5/12.5 reviews/confidence because area-safety has no input) need
   revisiting — the code comment marks exactly where.
6. **Journeys tab** (route-aware discovery) — real, unstarted, second product pillar per the
   product brief's core use case.
7. **Production hardening** — Sentry, `expo-dev-client`, EAS project linking.
8. **TestFlight readiness** — entirely founder-account-gated (Apple Developer, EAS login);
   Astra's job here is limited to making sure `eas.json`/`app.json` are ready for those founder
   steps, not performing them.

This is a re-derivation from current repository state, not a copy of an old roadmap — items 1–2
are founder actions Astra should flag, not attempt; items 3–8 are where Astra's code contribution
actually starts.

## Recommended First Astra Objective

**Ship the map view on Explore.** It's the single largest named-but-unbuilt feature with no
upstream blocker (unlike reviews/crime data, which need a founder DB action or a product
decision first), it has real data to render immediately once `006` is applied (44 real
lat/lng-bearing stops, already flowing through `StopData`), and it directly extends work already
merged this session (`lib/location.ts` already provides the user's real position). Concretely:
add `react-native-maps` (or Expo's maps wrapper, whichever fits the Expo 54 / New Architecture
constraints — verify compatibility before adding), render a map on Explore with the user's
position and stop pins using the real `latitude`/`longitude` already on every `StopData`, tap a
pin to navigate to `/stop/[id]` (existing route). Ship it working against mock data first (mock
stops already carry lat/lng) so it's demonstrable even before `006` is applied.

## Important Constraints

- Expo / React Native / Expo Router remains the architecture — do not propose a Swift/native
  rewrite.
- Never fabricate user-facing data (reviews, ratings, crime stats, "safe" claims) — see Product
  Mission.
- Never expose credentials — anon key only, ever, in app code. A guard hook enforces this at
  write time; don't try to work around it.
- Schema changes are migration-first SQL files in `docs/migrations/`, reviewed, founder-run.
  Astra has no path to mutate the live database directly and should not look for one.
- Preserve RLS on every table — verify with `npm run rls:check` after any schema-adjacent change.
- **Verify before claiming completion.** `tsc` passing is not verification. Run the app (once
  Simulator works) or at minimum `expo export` and a careful read of the actual code path.
- Production functionality is the priority over documentation polish — this document exists so
  Astra doesn't have to write more like it as busywork.

## Claude Agent System

`.claude/` contains an orchestration harness (a "HerStop Lead" Claude session dispatching
worktree-isolated sub-agents, plus deterministic guard hooks that block secrets, destructive DB
ops, RLS weakening, and banned safety-claim language). **Astra does not need to use, maintain, or
improve this system.** If Astra's tooling doesn't invoke Claude Code hooks, the guard checks
simply won't run for Astra's own commits — in that case, hold yourself to the same rules by
reading `.claude/rules/product-boundaries.md` and `.claude/rules/supabase-rules.md` directly
before touching product-language copy or database code, since nothing will stop you mechanically.
`CLAUDE.md` at the repo root is that system's entrypoint and is somewhat stale/aspirational in
places (see "Known Problems" above); this handoff document supersedes it as the source of truth
on current reality.
