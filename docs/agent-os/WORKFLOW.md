# WORKFLOW

## Task lifecycle
```
founder intent
  → spec + plan            docs/features/<name>/{intent,spec,plan}.md
  → dependency graph       (Lead, in TodoWrite)
  → builder agent(s)       mobile-builder / db-engineer in isolated worktrees
  → Level 0 gate           tsc + lint (Stop hook enforces this on the Lead too)
  → integration            Lead merges compatible builder branches
  → fresh verifier         mobile-verifier — clean context, reads the spec not the summary
  → PASS / FAIL / BLOCKED
        FAIL → routed back to the owning builder → re-verify
  → review                 code-reviewer (+ security-reviewer for auth/DB/user-data/UGC)
  → human approval
  → merge into dev, then main
  → update STATUS.md + durable docs
```
The Lead runs this loop itself; the founder does not shuttle anything between sessions.
Mode selection (main context vs subagent vs worktree vs team) is in
`.claude/skills/herstop-orchestration/SKILL.md`.

## Feature artifacts
Every non-trivial task gets a folder under `docs/features/<name>/` from `_template/`:
`intent.md` (why) → `spec.md` (what) → `plan.md` (how) → `verification.md` (result).

## Branch model
- `main` — protected/stable. **No direct pushes; merge needs human approval.**
- `dev` — integration branch. (Not created yet — documented here.)
- `agent/<task-name>` — one per worker task; opens a PR into `dev`.

## Git worktrees (parallelism)
Two mechanisms exist, and they are different:

**1. Agent-managed (normal case).** `mobile-builder` and `db-engineer` declare
`isolation: worktree`, so Claude Code creates and cleans up a worktree under `.claude/worktrees/`
automatically. It branches from the **Lead's current HEAD** (`worktree.baseRef: "head"`), so the
Lead must be on the right integration branch before dispatching. Builders run
`.claude/hooks/worktree-bootstrap.sh` first — a fresh worktree has no `node_modules` and no
local env file.

**2. Manual (long-lived work you want to keep).** The `../herstop-worktrees/*` layout below.
Still valid; used for the existing `agent/*` branches.

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
