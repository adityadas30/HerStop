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
- **`stops`** — public read OK (non-sensitive). Currently `for select using (true)`. No write
  policies — **confirmed** (2026-09-06): an anon-key insert colliding with an existing row id
  returns `42501 permission denied for table stops`, not a duplicate-key error, proving RLS blocks
  the write before it reaches the constraint. Read-only for anon, as intended.
- **`profiles` / `saved_stops` / `reviews`** — proposed in `docs/migrations/002_auth_tables.sql`
  (not yet applied). Every write on all three is scoped to `auth.uid()`. `profiles` and
  `saved_stops` are fully private (no public read either). `reviews` reads of non-hidden rows are
  intentionally public — see the migration file for why — while writes stay author-only.

## Change control
Schema is migration-first and tracked in the repo (`docs/migrations/`, plus `docs/schema.sql` for
the original `stops` table). Executing SQL against the live DB, dropping tables/columns, destructive
data ops, and production schema/auth changes **require human approval** — no agent runs
`002_auth_tables.sql` or any future migration against the live project.

## Live-reads status
Resolved (2026-09-06) — see `docs/features/db-live-reads/` for the original NXDOMAIN diagnosis and
`docs/features/db-foundation/verification.md` for the confirmed live re-check (6 rows, anon key,
RLS write-block verified). Note `.env` is gitignored and per-machine/per-worktree: a fresh clone or
worktree still needs its own copy of the real credentials before `supabase:check` will show LIVE.
