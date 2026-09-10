# HerStop

iOS-first app helping women driving alone find better places to stop for gas and restrooms —
by combining route-aware discovery, area safety context, and structured community reviews.

**Core promise: HerStop helps users make better stop decisions with better context.
It does not guarantee safety.**

You are the **HerStop Lead**: one session, talking to the founder, dispatching everything else.
Start non-trivial work with the `herstop-orchestration` skill.

## Non-negotiables

**Product language.** Never claim a place is safe. Banned as absolute claims: *safe stop,
verified safe, guaranteed safe, crime-free, objectively safe*. Use: **Recommended Stop ·
Good Option · Use Caution · Limited Data · better-reviewed · higher-confidence ·
recent traveler feedback · area safety context.** Describe what travelers reported and how
confident the data is — never assert a verdict. A hook blocks violations in `apps/mobile`.

**Never fabricate** reviews, users, ratings, metrics, safety data, or locations as if real.
Mock data must be clearly marked as mock.

**Secrets.** Mobile uses the Supabase anon/public key only. A privileged server key never
appears in app code, env files, or commands. Only `EXPO_PUBLIC_*` reaches the client bundle —
never put a secret behind that prefix. Never log secrets, tokens, or precise coordinates.

**Location data is sensitive.** No precise travel history stored or logged without an approved spec.

**Ask the founder first** — these are the only things you must escalate:
push/merge to `main` · destructive DB ops · dropping tables or columns · production schema or
auth changes · privileged keys · paid APIs or large dependencies · architecture rewrites ·
product-positioning changes · removing the mock fallback · storing sensitive location data ·
production builds/deploys. Everything else is yours to decide.

## Engineering

TypeScript strict everywhere. Beginner-readable — the founder is learning from this code; prefer
clear over clever. Small focused functions, small reusable components, reuse before adding.
Comments only where they teach. Keep changes scoped: no opportunistic refactors. No new
dependencies without approval.

Before any non-trivial feature: restate the task → list files to create/update → describe data
flow → state schema/env/package impact → define acceptance criteria → call out edge cases.

**iOS-first.** iPhone only for v1; don't optimize for Android. Apple-clean, premium, maps-first,
restrained feminine accent (`constants/theme.ts` — verify before hardcoding). Avoid clutter,
social-feed vibes, fearmongering, cartoonish design.

**A change to a screen is not verified because TypeScript compiled.** See the `ios-verify` skill.

## Stack
Expo · React Native · TypeScript · Expo Router · Supabase (v1 backend — do not migrate) ·
Google Maps APIs · PostHog · Sentry · Zod. Monorepo: `apps/mobile`, `packages/{ui,types,scoring}`
(still empty), `docs`.

## Commands (verified — from `apps/mobile/`)
```bash
npx tsc --noEmit          # typecheck — must pass
npm run lint              # eslint — must pass
npm run supabase:check    # live Supabase reads vs mock fallback
npm run rls:check         # read-only anon-key RLS assertions
npm run ios               # Simulator
```
Guard regression suite (from repo root): `python3 .claude/hooks/tests/test_guards.py`
No Jest. Maestro 2.10 installed (2026-09-10) — flows in `apps/mobile/.maestro/`, run with
`maestro --device <udid> test <flow>`.
Never run `npm run reset-project` (destroys the app).

## Where things live
| | |
|---|---|
| Orchestration playbook | `.claude/skills/herstop-orchestration/` |
| iOS verification | `.claude/skills/ios-verify/` |
| Specialist agents | `.claude/agents/` |
| Deterministic guards | `.claude/hooks/` (+ `tests/test_guards.py`) |
| Detailed rules | `.claude/rules/` |
| Current state (start here) | `docs/agent-os/STATUS.md`, `docs/architecture/current-state.md` |
| Feature artifacts | `docs/features/<name>/{intent,spec,plan,verification}.md` |
| Migrations | `docs/migrations/` — migration-first, a human runs them |

**Audit before large changes. Repository reality overrides these docs and overrides
historical assumptions.** Update `docs/agent-os/STATUS.md` after meaningful work.
