# Supabase & RLS

Enforceable checklist: `.claude/rules/supabase-rules.md` and
`docs/agent-os/REVIEW_CHECKLISTS.md`. This is the rationale + current posture.

## Client
`apps/mobile/lib/supabase.ts` creates the client from `EXPO_PUBLIC_SUPABASE_URL` /
`EXPO_PUBLIC_SUPABASE_ANON_KEY` (AsyncStorage session persistence). `supabaseConfigured` gates
whether callers attempt a query or short-circuit to mock (avoids ~10s DNS/TCP hangs).

## Key posture
- **Anon/public key only** in mobile. Service-role keys never in app code or `.env`.
- `.env` is gitignored; `.env.example` carries variable names + safe placeholders.
- Only `EXPO_PUBLIC_*` values reach the client bundle — never put a secret behind that prefix.

## RLS by table
- **`stops`** — public read OK (non-sensitive). Currently `for select using (true)`. No write policies.
- **`saved_stops` / `reviews` / `profiles`** (future) — every write scoped to `auth.uid()`. No public
  writes. Review these policies before shipping.

## Change control
Schema is migration-first and tracked in the repo. Executing SQL against the live DB, dropping
tables/columns, destructive data ops, and production schema/auth changes **require human approval**.

## Current blocker
The configured project host returns NXDOMAIN, so no live table is reachable to verify RLS end-to-end.
See `docs/features/db-live-reads/` for the exact unblock steps.
