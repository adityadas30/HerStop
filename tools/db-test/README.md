# Local Postgres migration rehearsal

Run from the repository root:

```sh
PATH=/Users/adityadas/.nvm/versions/node/v24.14.1/bin:$PATH node tools/db-test/run.mjs
```

Install, only if needed: `PATH=/Users/adityadas/.nvm/versions/node/v24.14.1/bin:$PATH npm install --prefix tools/db-test --ignore-scripts --no-audit --no-fund`. The isolated package has only `@electric-sql/pglite` (locked version 0.3.14); mobile packages/lockfiles are untouched and node_modules is ignored. Installation is the only network operation. The runner reads repository SQL files, never reads environment files, never opens a network connection, and creates a new in-memory database each time. All SQL is in `.sql` files, including the query registry and fixtures. No shell-embedded SQL.

The harness applies the exact original 001,002,003,005,006,007 files. Synthetic fixtures model the supplied live shape (six stops, TEST rename, one user, two saves). Counts are asserted after every step. Separate transaction fixtures exercise A/B/anon under real PostgreSQL roles/RLS, including strict SQLSTATE checks so FK/duplicate failures cannot masquerade as RLS denials. Tests are rolled back. Each down script is applied twice and compared against its pre-up catalog snapshot: tables, columns/defaults, policies, functions/definitions/owners/ACLs, constraints, indexes and triggers. OIDs are excluded. Guard rejection paths are exercised. A CSV round trip restores the TEST name, original created_at and saves; updated_at intentionally refreshes through 005's trigger. CSV cells in this local test contain JSON-encoded values; Dashboard's typed CSV import is a separate manual verification.

Known-risk tests deliberately assert the vulnerable **observed** baseline, not the desired secure behavior: immediate public edits; daily timing boundary; arbitrary-UUID ban disclosure; banned callers' moderation operations; TRUNCATE under simulated broad grants. Their PASS means reproduction, not production approval. After baseline/rollback tests, a separate local rehearsal applies the two proposed fixes and checks selected mitigations. These proposals are not included in the staging apply sequence and still need production review.

No extension workaround or migration substitution was needed: PGlite ran PL/pgSQL, roles, RLS, triggers, SECURITY DEFINER, gen_random_uuid(), catalog queries and all original migration constructs. `auth.users` is a minimal local stand-in, with auth.uid()/auth.role() reading request.jwt.claims; JWT verification itself is not implemented. Grants are an explicit simulation, not Supabase defaults. PGlite cannot establish the current Supabase platform's default ACLs, auth deletion ownership, audit/identity/session/storage cascades, PostgREST behavior, SMTP/OTP, realtime, backup/PITR availability, concurrent-session lock behavior or iOS behavior. None is reported as verified.

The runner fails fast and exits nonzero for an unexpected assertion/error; the table includes the failure and later tests are not claimed as run. No row payloads, credentials or coordinates are printed. See [staging runbook](../../docs/sprint-2/staging-runbook.md) for the separate founder-only live checks.
