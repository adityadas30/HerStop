# HerStop Agent OS

A lightweight, repo-native harness for developing HerStop reliably with a small number of
Claude Code agents, durable docs, deterministic checks, and human approval gates.

## Goal
Maximize reliable engineering output per unit of founder attention — not the number of agents.

**The interface is one HerStop Lead session.** You talk to it; it decomposes the work, dispatches
specialists, collects their results, routes failures back, and escalates only real decisions.
You never copy output between sessions.

Typical run: **Lead plans → one builder → one fresh verifier → review.**

## Where things live
| Thing | Location |
|-------|----------|
| Product one-liner + hard rules | `CLAUDE.md` (repo root) |
| Product docs | `docs/product/` |
| Architecture docs | `docs/architecture/` (`current-state.md` is audit-based) |
| Agent OS (this) | `docs/agent-os/` |
| Feature artifacts | `docs/features/<name>/` (from `_template/`) |
| Agent definitions | `.claude/agents/` |
| Rules (checklists) | `.claude/rules/` |
| Skills | `.claude/skills/` |
| Hooks (enforcement) | `.claude/hooks/` + `.claude/settings.json` |
| Orchestration playbook | `.claude/skills/herstop-orchestration/` |
| iOS verification | `.claude/skills/ios-verify/` |

## Start here
1. `STATUS.md` — current state, updated every session.
2. `TASK_BOARD.md` — what's queued / in progress / blocked.
3. `WORKFLOW.md` — how a task flows from intent to merge, plus the dependency chain.
4. `MODEL_ROUTING.md` — which model for which job.
5. `REVIEW_CHECKLISTS.md` — verification levels + Supabase/RLS checklist.
6. `COMMANDS.md` — the commands that actually work in this repo.
7. `REMOTE_ORCHESTRATION.md` — driving this from a phone while the home machine runs Claude Code.

## The agents
The Lead is the session itself. It dispatches: **mobile-builder** and **db-engineer**
(worktree-isolated, write code) · **mobile-verifier** (fresh-context PASS/FAIL) ·
**code-reviewer** · **security-reviewer** · **repo-scout** (cheap read-only research).
Details in `AGENTS.md` and `.claude/agents/`.

## Enforcement
`.claude/hooks/` blocks secrets, destructive/production database changes, RLS weakening,
protected-branch pushes, production deploys, and safety-claim copy — deterministically, before
the tool call runs. See `.claude/hooks/README.md`.
