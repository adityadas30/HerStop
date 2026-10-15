# Verification — QA Baseline (fresh-context)

> Filled by the fresh-context QA verifier, 2026-09-06, on `agent/qa-baseline`
> (worktree: `herstop-worktrees/qa-baseline`). Scope: establish a current, reproducible
> baseline of app health — not a feature implementation.

## Commands run (with results)
```
$ npm install
✅ ok (no lockfile changes; installed clean into a fresh node_modules)

$ npx tsc --noEmit
✅ PASS — no errors

$ npm run lint
❌ 2 pre-existing problems (both in files untouched by this session):
  app/(tabs)/profile.tsx:19:70
    error  `'` can be escaped with `&apos;` …  react/no-unescaped-entities
    (culprit: "You're browsing as a guest" — raw apostrophe in JSX text)
  components/ui/JourneyShield.tsx:4:10
    warning  'IconSymbol' is defined but never used  @typescript-eslint/no-unused-vars
Matches what STATUS.md already logged on 2026-09-06. Not fixed here (out of scope — see
"Known remaining issues"; both are trivial and safe to fix in a follow-up).

$ npm run supabase:check
✅ LIVE — Supabase returned 6 row(s) from "stops".
   Found live marker row: "Willow Creek Plaza TEST" (id=1).
   Row names: The Atlas Point, Meridian Transit Hub, Cedar Falls Rest Area,
              Sunrise Travel Center, Harbor View Stop, Willow Creek Plaza TEST
```
Note: `apps/mobile/.env` doesn't exist in this worktree by default (it's gitignored and worktrees
don't share it). Copied it from the primary checkout (`~/herstop/apps/mobile/.env`, anon key only,
no secrets) to make `supabase:check` and live-data verification possible. This **contradicts**
`STATUS.md`'s "live reads BLOCKED — NXDOMAIN" note — the Supabase project now resolves and serves
data. STATUS.md is updated below to reflect this.

## Simulator / manual checks
No screen-tap tool is available in this session (no iOS Simulator control/MCP tool attached) —
Level 2 (tap-through) verification could not be performed interactively. What was verified instead:

- [x] **Level 1 — Bundle:** `npx expo export --platform ios` — ✅ bundled cleanly, 1349 modules,
      no errors (`entry-*.hbc`, 4.12 MB). `npm run ios` (non-interactive) failed only on an
      Expo-Go-version-mismatch prompt requiring interactive input — an environment limitation,
      not an app bug.
- [x] **Onboarding → Explore route:** `app/index.tsx` redirects to `/onboarding`;
      `onboarding.tsx`'s "Get Started" calls `router.replace('/(tabs)')`. Copy includes the
      required disclaimer ("decision support — not safety guarantees"). Code path is correct.
- [x] **Explore/Discover loads + live marker:** `(tabs)/index.tsx` calls `getStops()` on mount
      (`useEffect`), replacing the initial `MOCK_STOPS` state. `getStops()` (`lib/api.ts`) queries
      Supabase first, falls back to mock on error/empty/misconfig, and dev-logs which path was
      taken. Confirmed live query returns the marker row "Willow Creek Plaza TEST" — this **would**
      render in the Explore list, distinguishable from the mock-only "Willow Creek Plaza" name.
- [x] **Filters work (logic-verified):** `FILTERS` labels (`Gas`, `Restroom`, `Open Now`,
      `Well Lit`) match `categories` values on both mock rows and the live `stops` table exactly;
      `toggleFilter` + `filteredStops` OR-matches by category. Search-by-name/address filters
      client-side over whatever `stops` state holds (mock or live).
- [x] **Stop card → detail:** `StopCard`'s `onPress` and Explore's `router.push('/stop/'+id)` wire
      correctly to `app/stop/[id].tsx`, which calls `getStopById(id)` (same live/mock fallback
      pattern) and renders loading/not-found/loaded states.
- [x] **Save/unsave (logic-verified):** `useSavedStops()` (`contexts/saved-stops.tsx`) is a single
      root-level `Set<string>` context; `StopCard` and the detail screen both call the same
      `toggleSaved(id)` / `isSaved(id)`, so bookmark state is consistent app-wide in-memory.
      Confirmed **not persisted** (by design — `getSavedStops`/`toggleSaveStop` in `lib/api.ts`
      are stubs awaiting auth, per `docs/features/db-live-reads/` dependency chain).
- [x] **Saved tab updates (logic-verified, with a caveat — see findings):** `saved.tsx` reads
      `savedStops` from the same context and re-renders on toggle. Confirmed a real bug in the
      data source it reads from (below).

Because there's no simulator-automation tool in this environment, none of the above were
confirmed by literally tapping through the running app — they're confirmed by tracing the actual
code paths and by exercising the live Supabase query directly. Flagging this gap explicitly rather
than claiming an E2E pass; see "Known remaining issues."

## Findings

### 1. Product-language violation — FIXED (small, obvious, safe)
`app/(tabs)/index.tsx` rendered **"Verified safe stops within 5 miles"** as the Explore section
subtitle — the literal banned phrase "verified safe" from `.claude/rules/product-boundaries.md`
(non-negotiable) and `docs/product/trust-and-safety-language.md`. Changed to
**"Better-reviewed stops within 5 miles"** (using the doc's own preferred vocabulary). One-line
copy change only; `tsc`/`lint` re-verified clean after the edit. This is the only in-scope fix
made during this QA pass.

### 2. Saved tab reads from `MOCK_STOPS`, not the live/current `stops` list — NOT FIXED (real bug, needs a decision)
`contexts/saved-stops.tsx`:
```ts
const savedStops = useMemo(
  () => MOCK_STOPS.filter((s) => savedIds.has(s.id)),
  [savedIds],
);
```
`savedIds` is populated from whatever stop the user actually saved (mock **or** live), but
`savedStops` is always derived by filtering the hardcoded `MOCK_STOPS` array. Today mock and live
IDs happen to overlap (`1`–`6`), so the Saved tab doesn't crash — but it silently shows the
**mock** row's data. Concretely: saving the live "Willow Creek Plaza TEST" row shows up in Saved
as "Willow Creek Plaza" (no "TEST"), and if a live-only ID were added (or an ID diverged), it
would either show wrong data or vanish. Not a regression from this session — pre-existing, and
consistent with saved-stops persistence already being tracked as blocked-on-auth work. Flagging
because it's an actual correctness bug in the "Saved tab updates" flow, not just a data-persistence
gap. Left unfixed here (fixing correctly likely means caching the full `StopData` — from whichever
source — in the context, not just the ID; that's a small-but-not-trivial call for the team since
it touches the shape of the soon-to-be-auth-backed `saved_stops` design).

### 3. Adjacent copy worth a second look (not a rule violation)
`app/stop/[id].tsx`: "Reviews from verified women travelers will appear here." This isn't an
absolute safety claim about a *place* (the banned category), it's about reviewer identity — so it
doesn't violate the letter of `product-boundaries.md`. Noting it only because "verified" is close
to the flagged vocabulary; product may want to confirm the intended meaning is unambiguous once
reviews ship.

### 4. STATUS.md's "live reads BLOCKED" note is stale
Supabase now resolves and returns 6 live rows (see `supabase:check` output above), including the
`... TEST` marker row. Recommend the founder confirm this is intentional data (not a leftover
seed) and re-run `supabase:check` from their own machine before fully closing out
`docs/features/db-live-reads/`. Updated `STATUS.md` below to reflect the current state without
asserting the underlying `docs/features/db-live-reads/verification.md` is done — that's a separate
artifact for that feature's owner to close out.

### 5. Pre-existing lint issues (unchanged from STATUS.md's 2026-09-06 entry)
See the `npm run lint` output above — 2 issues, both in files untouched this session. Small,
obvious, safe to fix (escape the apostrophe; drop the unused import) but left alone per this
task's scope (baseline QA, not cleanup) and because they belong to whoever owns those files.

## Acceptance criteria
- [x] Install/typecheck/lint/supabase:check run and results recorded — PASS (lint has 2
      pre-existing issues, documented above)
- [x] Expo app startability verified — PASS at Level 1 (bundle); Level 2 blocked by missing
      simulator-automation tooling in this session (documented, not silently skipped)
- [x] Core flow (onboarding → Explore → live marker → filters → detail → save → Saved tab)
      traced end-to-end in code — PASS, with one real bug found (Saved tab data source, #2 above)
- [x] Pre-existing lint issues identified — PASS (2, matches STATUS.md)
- [x] Unsafe product language identified — PASS (1 found and fixed: #1; 1 adjacent note: #3)
- [x] No large fixes implemented — PASS (only the 1-line copy fix)
- [x] `docs/features/qa-baseline/verification.md` created — this file
- [x] `docs/agent-os/STATUS.md` updated — see below
- [x] No push to `main` — not done; work is local to `agent/qa-baseline`

## Product-language scan
Repo-wide grep for `safe|crime|guarantee|verified|secure` (excluding `SafeAreaView`/safe-area
noise) found one violation ("Verified safe stops…", fixed — see Finding #1) and one adjacent,
non-violating mention ("verified women travelers", Finding #3). No other matches.

## Known remaining issues
- No iOS Simulator tap-through was performed (no simulator-control tool in this session). If a
  true Level 2 pass is wanted, either attach simulator-automation tooling or have a
  human/`expo-builder` run it manually (steps: launch → onboarding → Explore loads with live
  marker row visible → toggle a filter chip → tap a stop card → toggle bookmark → open Saved tab
  → confirm it reflects the change).
- `npm run ios` cannot run fully non-interactively as-is; it stops on an Expo-Go version-mismatch
  prompt. Not an app defect — worth a one-line note in `COMMANDS.md` if this trips up future agent
  runs (e.g. `EXPO_NO_INTERACTIVITY=1` or accepting the recommended Expo Go version ahead of time).
- Saved-tab/`MOCK_STOPS` bug (Finding #2) — real, pre-existing, not fixed; needs a design decision,
  best addressed alongside the already-planned auth-backed `saved_stops` persistence work.
- 2 pre-existing lint issues (Finding #5) — trivial, not fixed, scope call for their file owners.
- `apps/mobile/.env` now exists in this worktree (copied from the primary checkout, gitignored,
  anon key only — no service-role key, no secrets committed).

## Reviewer notes
- No security/RLS/privacy issues found in this pass. `lib/supabase.ts` correctly uses only the
  anon key, never logs it, and only logs the host. `lib/api.ts` correctly no-ops on
  saved/toggle/reviews until auth exists — consistent with `.claude/rules/supabase-rules.md`.
- No new dependencies added, no refactors performed, no schema/DB writes attempted.
- The one code change (product-language copy fix) is minimal and scoped; diff is `+1/-1` in
  `apps/mobile/app/(tabs)/index.tsx`.
