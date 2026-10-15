# Agents

Defined in `.claude/agents/`. The **Lead is the main session you talk to** — it is not an agent
definition. Everything below is something the Lead dispatches.

| Agent | Model | Isolation | Writes code? | Owns |
|---|---|---|---|---|
| **mobile-builder** | sonnet | **worktree** | yes | `apps/mobile/app/**`, `components/**`, `contexts/**`, `hooks/**` |
| **db-engineer** | sonnet | **worktree** | yes | `docs/migrations/**`, `docs/schema.sql`, `apps/mobile/lib/**` |
| **mobile-verifier** | sonnet | none (read-only) | no | verification evidence |
| **code-reviewer** | sonnet | none (read-only) | no | review findings |
| **security-reviewer** | opus | none (read-only) | no | security/RLS/privacy findings |
| **repo-scout** | haiku | none (read-only) | no | repository facts |

## Why worktree isolation
Only the two code-writing agents get `isolation: worktree`. Each runs in its own checkout, so
two builders can work at the same time without touching each other's files. Worktrees branch
from the **Lead's current HEAD** (`worktree.baseRef: "head"` in `.claude/settings.json`) — not
from `origin/main`, which is stale in this repo.

A fresh worktree has no `node_modules` and no local env file, so every builder runs
`.claude/hooks/worktree-bootstrap.sh` before any check.

Verification and review agents are deliberately read-only. **An agent that can rewrite the code
it is judging is not an independent check.** Dispatch them to fix something only by explicitly
saying so.

## Handoff pattern
1. Lead writes `docs/features/<name>/{intent,spec,plan}.md`.
2. Builder(s) implement in isolated worktrees, run Level 0, commit, report back.
3. Lead integrates compatible branches.
4. `mobile-verifier` verifies from a clean context against the spec → PASS/FAIL/BLOCKED.
5. FAIL routes back to the builder that owns those files, then re-verify.
6. `code-reviewer`, plus `security-reviewer` for anything touching auth, DB, user data, or UGC.
7. Founder approves. Merge. Update `STATUS.md`.

## Choosing how much machinery to use
See `.claude/skills/herstop-orchestration/SKILL.md`. Short version: most tasks are the Lead
working directly, or one subagent. Concurrent worktree builders when the work genuinely splits
by file. Agent teams only when specialists must coordinate with each other — a build → verify →
review pipeline is not that.

## Skills vs agents vs hooks vs docs
- **Agents** — who does the work, and what they may touch.
- **Skills** (`.claude/skills/`) — procedures anyone can follow.
- **Hooks** (`.claude/hooks/`) — deterministic enforcement; the model cannot talk its way past them.
- **Docs** (`docs/`) — durable product and architecture knowledge.
