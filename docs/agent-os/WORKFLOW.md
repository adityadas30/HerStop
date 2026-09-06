# WORKFLOW

## Task lifecycle
```
founder intent
  → spec (docs/features/<name>/spec.md)
  → plan (plan.md)
  → scoped implementation on agent/<name> branch
  → deterministic checks (tsc + lint)
  → iOS simulator / Maestro verification (when available)
  → independent fresh-context verifier (qa-verifier)
  → code/Supabase/security review (reviewer)
  → human approval
  → merge into dev, then main
  → update STATUS.md + durable docs
```

## Feature artifacts
Every non-trivial task gets a folder under `docs/features/<name>/` from `_template/`:
`intent.md` (why) → `spec.md` (what) → `plan.md` (how) → `verification.md` (result).

## Branch model
- `main` — protected/stable. **No direct pushes; merge needs human approval.**
- `dev` — integration branch. (Not created yet — documented here.)
- `agent/<task-name>` — one per worker task; opens a PR into `dev`.

## Git worktrees (parallelism)
Agents work in separate worktrees so they don't collide.

**macOS / Linux**
```bash
git checkout main && git pull origin main
git checkout -b dev && git push -u origin dev          # first time only

mkdir -p ../herstop-worktrees
git worktree add -b agent/db-live-reads ../herstop-worktrees/db-live-reads dev
git worktree add -b agent/ui-polish     ../herstop-worktrees/ui-polish     dev
```
**Windows PowerShell**
```powershell
git checkout main; git pull origin main
git checkout -b dev; git push -u origin dev

New-Item -ItemType Directory -Force ..\herstop-worktrees
git worktree add -b "agent/db-live-reads" "..\herstop-worktrees\db-live-reads" dev
git worktree add -b "agent/ui-polish"     "..\herstop-worktrees\ui-polish"     dev
```
If `dev` already exists: `git fetch origin && git checkout dev && git pull`.

## Worktree rules
- Avoid editing the same files from two agents at once.
- Keep commits small and descriptive.
- Each `agent/*` branch → PR into `dev`. Update `STATUS.md` after meaningful work.

## Dependency chain (blockers)
`db-live-reads` → saved-stops persistence → auth → reviews → real scoring → recommendation ranking.
Maps/Places scaffold after DB reads are stable. Do not start downstream work before blockers clear.
