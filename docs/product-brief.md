# HerStop — Product Brief

## What It Is

HerStop helps women driving alone on medium and long trips find better places to stop for gas and restrooms — by combining route-aware discovery, area context, and structured community reviews.

## What It Is Not

HerStop does **not** guarantee safety. It provides decision support.

Never use: safe, guaranteed safe, verified safe, crime-free.
Always use: Recommended Stop, Good Option, Use Caution, Limited Data, higher confidence, better reviewed.

## Primary User

Women driving alone on medium and long trips in the U.S.

## Core Use Case

> "I'm driving 4 hours alone. I need to stop for gas in 45 minutes. Which exit is the better choice?"

User enters route → sees recommended stops → opens stop detail → decides confidently.

## MVP Screens

| Screen | Route | Status |
|--------|-------|--------|
| Onboarding | `/onboarding` | Shell ✓ |
| Discover (home) | `/(tabs)/` | Shell ✓ |
| Saved Stops | `/(tabs)/saved` | Shell ✓ |
| Profile | `/(tabs)/profile` | Shell ✓ |
| Stop Detail | `/stop/[id]` | Shell ✓ |

## Scoring Model (v1)

- Community reviews → 70%
- Area safety context → 20%
- Confidence modifier → 10%

Rules:
- < 3 reviews → show "Limited Data"
- Weak lighting + night visit → downgrade score
- High loitering reports → strong downgrade

## Review Structure

Fields collected per review:
- Overall feeling (1–5)
- Lighting quality
- Restroom quality
- Cleanliness
- Staff kindness
- Loitering concern (low/medium/high)
- Would stop here alone again (yes/no)
- Short note (optional)
- Time of visit (day/night/unknown)

## Phase Roadmap

### Phase 1 (current) — Shell
- App structure, screens, branding
- No backend, no maps

### Phase 2 — Core Feature
- Supabase: auth (OTP), DB, storage
- Google Maps: route input, nearby stops
- Stop cards + map view
- Review submission

### Phase 3 — Polish
- PostHog analytics
- Sentry error tracking
- Bookmark sync
- Review quality signals

## NOT in v1

Android optimization, subscriptions, panic button/SOS, social feed, friend tracking, ML personalization, CarPlay, gamification, admin dashboards.
