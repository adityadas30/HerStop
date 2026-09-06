# HerStop Agent OS

A lightweight, repo-native harness for developing HerStop reliably with a small number of
Claude Code agents, durable docs, deterministic checks, and human approval gates.

## Goal
Maximize reliable engineering output per unit of founder attention — not the number of agents.
Typical run: **one orchestrator burst → one builder → one verifier.**

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
| Hooks | `.claude/settings.json` + `.claude/hooks/README.md` |

## Start here
1. `STATUS.md` — current state, updated every session.
2. `TASK_BOARD.md` — what's queued / in progress / blocked.
3. `WORKFLOW.md` — how a task flows from intent to merge, plus the dependency chain.
4. `MODEL_ROUTING.md` — which model for which job.
5. `REVIEW_CHECKLISTS.md` — verification levels + Supabase/RLS checklist.
6. `COMMANDS.md` — the commands that actually work in this repo.
7. `REMOTE_ORCHESTRATION.md` — driving this from a phone while the home machine runs Claude Code.

## The five agents
Orchestrator (Opus) · Mobile Builder (Sonnet) · Supabase/DB (Sonnet) ·
QA/Fresh-Context Verifier (Sonnet) · Reviewer/Security (Sonnet→Opus by severity).
Details in `AGENTS.md` and `.claude/agents/`.
