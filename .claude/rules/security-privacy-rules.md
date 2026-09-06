# Rule: Security & Privacy

- Treat location-related data as **sensitive**.
- Do not store precise user travel history unless explicitly designed and justified in a spec.
- Never log secrets, tokens, exact anon/API keys, or sensitive location trails.
- Debug logging must be dev-only and must not print credentials or precise coordinates.
- Any future analytics (PostHog) must avoid unnecessary personal-location exposure.
- Secrets live in `.env` (gitignored). Only `EXPO_PUBLIC_*` values reach the client bundle —
  never put a secret behind that prefix.
- UGC (reviews) must be designed with moderation, reporting, abuse prevention, and privacy in mind.

## Requires human approval
- Adding analytics that tracks sensitive location behavior.
- Storing sensitive location/user data.
- Adding paid external APIs or large dependencies/frameworks.
