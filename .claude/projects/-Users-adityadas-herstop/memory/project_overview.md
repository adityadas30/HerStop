---
name: HerStop project overview
description: What HerStop is, tech stack, repo layout, current development phase
type: project
---

HerStop is a mobile app for women traveling alone to find and review gas stations and rest stops along their route.

**Stack:** Expo 54, React Native 0.81, Expo Router 6, TypeScript, monorepo (apps/mobile)

**Repo layout:**
- `apps/mobile/` — Expo app
- `apps/mobile/app/` — file-based routing (Expo Router)
- `apps/mobile/components/ui/` — Button, Card, Section, IconSymbol
- `apps/mobile/constants/theme.ts` — Colors, Typography, Spacing, Radius, Fonts tokens
- `docs/` — documentation

**Current phase:** Early UI scaffolding. No backend, no Supabase, no Maps yet. Screens: Onboarding, Discover (home), Saved, Profile, Stop Detail — all placeholder/empty-state.

**Why:** Building the frontend shell first before adding backend/data integration.

**How to apply:** All current work is frontend-only. Don't suggest backend, auth, or map integrations unless explicitly asked.
