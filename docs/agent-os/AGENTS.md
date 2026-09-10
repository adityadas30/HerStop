# Agents

Defined in `.claude/agents/`. Keep **2–3 active in parallel at most**, on non-overlapping files.

| Agent | Model | Does | Does NOT |
|-------|-------|------|----------|
| **Orchestrator** | Opus | Plan, sequence, dependency graph, write specs/plans, assign, track, final review | Long implementation bursts; push/merge to main |
| **Mobile Builder** | Sonnet | Expo/RN UI, components, navigation, hooks, contexts | Supabase schema/RLS; unrelated refactors; add deps without approval |
| **Supabase/DB** | Sonnet | Client, schema, RLS, migration docs, typed data access | Service-role in mobile; destructive DB ops without approval |
| **QA / Verifier** | Sonnet | Independent verification from clean context; run checks; report discrepancies | Implement fixes |
| **Reviewer / Security** | Sonnet→Opus | Review diffs for correctness, security, RLS, privacy, language, overengineering | Implement changes |

## Handoff pattern
1. Orchestrator writes `docs/features/<name>/{intent,spec,plan}.md`.
2. Builder (Mobile or Supabase) implements on an `agent/<name>` branch, runs Level 0 checks.
3. QA verifies independently against the spec; fills `verification.md`.
4. Reviewer reviews the diff.
5. Human approves merge into `dev`, then (separately) into `main`.

## Skills vs agents
Agents are *who* does the work; skills (`.claude/skills/`) are *how-to* playbooks agents invoke
(`feature-planner`, `expo-builder`, `supabase-builder`, `debugger`). Agents reference skills;
they don't duplicate them.
