# Intent — db-live-reads

## User problem
The app should show real, up-to-date stop data from Supabase, but during development it is unclear
whether the app is reading from the live database or silently falling back to mock data. This makes
backend progress impossible to trust.

## Desired outcome
- We can confirm, in one command, whether live Supabase `stops` reads work.
- The running app clearly distinguishes **LIVE Supabase** from **MOCK fallback** in dev logs.
- If live reads are blocked, the exact blocker and the exact manual fix steps are documented.

## Non-goals
- No UI redesign. No auth. No reviews. No maps.
- No schema execution against the live DB (founder does that).
- Do not remove the mock fallback.

## Constraints
- Anon/public key only; never a service-role key. No secrets in code or logs.
- Keep changes small and scoped. No new dependencies.
