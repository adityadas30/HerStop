# Verification — db-live-reads

Verified 2026-09-06 on branch `main` (working tree, no push).

## Result: live reads BLOCKED — cause identified

The `.env` holds real-format values, but the Supabase **project host does not exist**
(`xnkjqcygzjlspeagcoal.supabase.co` → NXDOMAIN). The app therefore attempts the query, DNS fails,
`getStops()` catches it, and serves `MOCK_STOPS`. This corrects the historical "placeholder .env"
theory — the values are real-format but point at a dead/incorrect project.

Confirmed the network itself works: `google.com` and `supabase.com` both return HTTP 200; only the
project host fails to resolve.

## Commands run (with results)
```
$ npm run supabase:check
→ Checking Supabase project host: xnkjqcygzjlspeagcoal.supabase.co
❌ Cannot resolve host "xnkjqcygzjlspeagcoal.supabase.co" (ENOTFOUND / NXDOMAIN).
   → The Supabase project is deleted, paused, or the URL is wrong.
   → Create/restore the project, then put its real URL + anon key in .env.
(exit 1)

$ npx tsc --noEmit
(exit 0 — passes)

$ npm run lint
✖ 2 problems (1 error, 1 warning)   (exit 1)
```

### Lint note (pre-existing, not from this change)
Both problems are in files this task did NOT touch:
- `app/(tabs)/profile.tsx:19` — unescaped `'` (react/no-unescaped-entities).
- `components/ui/JourneyShield.tsx:4` — unused import `IconSymbol`.

The files changed by this task (`lib/api.ts`, `lib/supabase.ts`, `scripts/supabase-check.mjs`,
`package.json`) are lint-clean. Left the pre-existing issues alone per scope discipline; logged as a
tiny cleanup on the task board.

## Acceptance criteria
- [x] `npm run supabase:check` prints the exact blocker (NXDOMAIN) — will print live row count once fixed.
- [x] Dev logs distinguish `LIVE Supabase: N rows` vs `MOCK fallback (reason: …)` (`lib/api.ts`).
- [x] `.env.example` added with safe placeholders; `.env` remains untracked (git-verified).
- [x] `npx tsc --noEmit` passes.
- [~] `npm run lint` — clean on changed files; 2 pre-existing issues in untouched files remain.
- [x] Mock fallback preserved; no secrets logged (host only).

## Product-language scan
No "safe"/"verified safe"/"guaranteed"/"crime-free" introduced. (yes)

## Known remaining issues — founder unblock steps
Live reads can't be completed here because the Supabase project host doesn't resolve. To unblock:

1. **Create or restore the Supabase project** (dashboard → supabase.com). If it was paused, resume it;
   if deleted, create a new project.
2. **Get the public credentials:** Project Settings → API → Project URL + `anon`/`public` key
   (never the `service_role` key).
3. **Update `apps/mobile/.env`** with the real `EXPO_PUBLIC_SUPABASE_URL` and
   `EXPO_PUBLIC_SUPABASE_ANON_KEY`. (Do not commit `.env`.)
4. **Create the table + seed:** open the SQL Editor and run `docs/schema.sql`.
5. **(Optional live-read marker):** rename seed row id `1` to confirm reads are truly live:
   ```sql
   update stops set name = 'Willow Creek Plaza TEST' where id = '1';
   ```
6. **Confirm from the terminal:** `cd apps/mobile && npm run supabase:check`
   → expect `✅ LIVE — Supabase returned N row(s)` (and the TEST marker line if you did step 5).
7. **Confirm in the app:** `npm run ios`; the Explore log should read `[getStops] LIVE Supabase: N rows`,
   and the first card should show "Willow Creek Plaza TEST" if step 5 was applied.

## Reviewer notes
- Anon key only; key never logged (host only). `.env` gitignored and untracked (verified).
- `stops` public read is appropriate (non-sensitive, anonymous browsing). No RLS changes made.
- All changes additive/log-only; no schema executed, no data mutated, no branch pushed.
