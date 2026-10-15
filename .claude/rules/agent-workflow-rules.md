# Rule: Agent Workflow & Approval Gates

## Allowed without human approval
- Read files; create documentation and feature artifacts.
- Create branches; edit code on `agent/*` branches.
- Run local `tsc` / `lint` / `supabase:check`.
- Add minimal dev-only logging.
- Commit to an `agent/*` branch; prepare PR notes.

## Requires human approval FIRST
- Pushing directly to `main`; merging into `main`.
- Deleting files broadly.
- Destructive DB operations; dropping tables/columns; production schema/auth changes.
- Using service-role keys.
- Adding paid external APIs or large dependencies/frameworks.
- Rewriting app architecture; changing product positioning.
- Removing the mock fallback completely.
- Storing sensitive location/user data; adding location-tracking analytics.

## Working style
- Audit before large changes. Repository reality overrides historical assumptions.
- Prefer small scoped changes over big fragile automation.
- Keep 2–3 agents max working in parallel, on **non-overlapping files**. Code-writing agents
  run worktree-isolated (`mobile-builder`, `db-engineer`); state file ownership explicitly when
  dispatching them.
- Verification and review agents are read-only by default. An agent that can rewrite the code
  it is judging is not an independent check.
- If a task grows beyond its plan, stop and ask.
- Update `docs/agent-os/STATUS.md` after meaningful work.

## Enforcement
Several gates above are also enforced deterministically by `.claude/hooks/` — a forgetful agent
is blocked rather than trusted. See `.claude/hooks/README.md`. The hooks are a backstop, not a
replacement for the judgment described here, and they are not a sandbox.
