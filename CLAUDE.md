# HerStop

## Product
HerStop is an iOS-first mobile app that helps women driving alone on medium and long trips find better places to stop for gas and restrooms by combining route-aware discovery, area safety context, and structured community reviews.

## Core promise
HerStop helps users make better stop decisions with better context.
It does not guarantee safety.

## Primary user
Women driving alone on medium and long trips in the U.S.

## MVP scope
- onboarding
- home screen with route input
- route-based stop discovery
- map/list results
- stop detail screen
- structured reviews
- save/bookmark stop
- browse without account
- OTP login for saving/reviewing
- profile

## Platform scope
- iPhone only for v1
- do not optimize for Android yet
- keep future expansion possible, but prioritize iOS-first UX

## Stack
- Expo
- React Native
- TypeScript
- Expo Router
- Supabase
- Google Maps APIs
- PostHog
- Sentry
- Zod

## Repo structure
- apps/mobile
- packages/ui
- packages/types
- packages/scoring
- docs

## Product wording rules
Never describe a place as:
- safe
- guaranteed safe
- verified safe
- crime-free

Prefer:
- Recommended Stop
- Good Option
- Use Caution
- Limited Data
- higher confidence
- better reviewed
- recent travelers reported good lighting
- limited recent data

HerStop is decision support, not a guarantee.

## Review model
Structured reviews should include:
- overall feeling
- lighting
- restroom quality
- cleanliness
- staff kindness
- loitering concern / strange vibe
- would stop again alone
- short optional note
- time of visit

## Scoring model v1
Use:
- community reviews: 70%
- area safety context: 20%
- confidence score: 10%

Low review count should force Limited Data.
Weak lighting plus nighttime should lower recommendations.
Repeated loitering concerns should lower recommendations strongly.

## Engineering rules
- Use TypeScript everywhere
- Keep code beginner-readable
- Prefer simple implementations over clever abstractions
- Use small reusable components
- Keep functions focused
- Add comments only when they help learning
- State files to create/update before implementation
- State data flow before implementation
- State schema/env impact before implementation
- Mention package installs explicitly before adding them

## Workflow rules
Before implementing any non-trivial feature:
1. restate the task
2. list files to create/update
3. describe data flow
4. identify schema/env/package impact
5. define acceptance criteria
6. call out edge cases

When debugging:
- identify likely root causes first
- avoid broad refactors unless necessary
- prefer the smallest good fix
- explain how to verify the fix

## UI direction
- Apple-clean
- premium
- maps-first
- subtle, restrained feminine accent styling is okay
- avoid overdesigned or gimmicky UI

## Commands (verified — run from `apps/mobile/`)
- Install: `npm install`
- Typecheck: `npx tsc --noEmit`
- Lint: `npm run lint`
- Start / iOS: `npm start` · `npm run ios`
- Confirm live Supabase reads vs mock: `npm run supabase:check`
- No test runner yet (no Jest/Maestro). Do not claim tests pass. See `docs/agent-os/COMMANDS.md`.

## Agent OS & workflow
- Development harness lives in `docs/agent-os/` (start at `README.md`, then `STATUS.md`).
- Enforceable rules: `.claude/rules/`. Agents: `.claude/agents/`. Skills: `.claude/skills/`.
- **Audit before large changes** — repository reality overrides historical assumptions.
- Prefer small, scoped changes. No unrelated refactors. No new deps without approval.
- Do not push directly to `main`; merges to `main` need human approval.
- Update `docs/agent-os/STATUS.md` after meaningful work.
- Ground-truth architecture: `docs/architecture/current-state.md`.

## Approval gates (must be human-approved)
Push/merge to `main` · destructive DB ops · dropping tables/columns · production schema/auth changes ·
service-role keys · paid APIs / large deps · architecture rewrites · product-positioning changes ·
removing the mock fallback · storing sensitive location data.
See `.claude/rules/agent-workflow-rules.md`.

## Current project priority
Focus on the mobile app first.
The waitlist site will be a separate repo later.
Immediate blocker: confirm live Supabase reads (`docs/features/db-live-reads/`).