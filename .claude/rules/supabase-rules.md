# Rule: Supabase / Database

- **v1 backend is Supabase.** Do not migrate to AWS/MongoDB.
- Mobile uses the **anon/public key only**. Service-role keys never appear in app code or `.env`.
- `.env` is not committed. `.env.example` holds variable names + safe placeholders only.
- Env vars: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- Schema changes are **migration-first** and tracked in the repo (`docs/schema.sql` today).
- **RLS:**
  - Public read is OK for non-sensitive `stops` data.
  - `saved_stops`, `reviews`, `profiles` writes must be scoped to `auth.uid()`.
  - Review every table touching users, saved stops, reviews, or profiles.
- Keep app-side access typed (`lib/types.ts`) and preserve the mock fallback in `lib/api.ts`.

## Requires human approval (do not do autonomously)
- Executing SQL against the live DB.
- Dropping tables/columns or destructive data operations.
- Production schema or auth-setting changes.
- Any use of a service-role key.
