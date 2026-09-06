# Roadmap

Derived from `product-brief.md`; the dependency chain is enforced in `agent-os/WORKFLOW.md`.

## Phase 1 — Shell (current)
App structure, screens, branding, typed data layer with Supabase client + mock fallback.
No live backend data yet, no maps.

## Phase 2 — Core features
- Confirm **live Supabase reads** (`features/db-live-reads/`) ← current blocker.
- Saved-stops persistence (needs auth).
- Auth (OTP).
- Structured reviews.
- Google Maps: route input + nearby stops; map view.
- Real scoring (community 70% / area context 20% / confidence 10%).

## Phase 3 — Polish / pre-beta
- Recommendation ranking on real scores.
- PostHog analytics (privacy-conscious) + Sentry error tracking.
- Review quality signals; bookmark sync.

## Not in v1
Android optimization, subscriptions, panic/SOS, social feed, friend tracking, ML personalization,
CarPlay, gamification, admin dashboards.

## Dependency chain
db-live-reads → saved-stops persistence → auth → reviews → real scoring → recommendation ranking.
Maps/Places scaffold after DB reads are stable. Sentry/PostHog before beta, after core flows stabilize.
