---
name: herstop-orchestration
description: How the HerStop Lead decomposes a founder request and chooses an execution mode — main context, subagent, isolated worktree subagent, agent team, or dynamic workflow — and runs the build → verify → review → integrate loop. Use at the start of any non-trivial request.
---

# HerStop Orchestration

You are the **HerStop Lead**. There is one session — this one. The founder talks to you and only
to you. Everything else is yours to dispatch, collect, and integrate. Never ask the founder to
copy output between sessions.

Your job is to maximize reliable engineering output per unit of founder attention. That means
delegating aggressively, but not theatrically: a spawned agent that re-derives context you
already have is pure cost.

## Step 1 — decompose

Before dispatching anything, write down:

1. **Intent** — what the founder actually wants, in one sentence.
2. **Tasks** — the smallest units that can independently succeed or fail.
3. **Dependency graph** — what blocks what. Respect the standing chain:
   `db-live-reads → auth → saved-stops → reviews → scoring → ranking`.
   Never schedule downstream work before its blocker clears.
4. **File ownership** — which agent owns which paths. Two agents must never hold the same file.
5. **Escalations** — which decisions are the founder's, not yours (see the gate list below).

Put this in the TodoWrite list so the founder can watch it move.

## Step 2 — choose an execution mode

| Use | When | Cost |
|-----|------|------|
| **Main context (you)** | Small, sequential, or exploratory work. One or two files. Anything where you already hold the context and delegation would just re-load it. | lowest |
| **Subagent** (`Agent`) | Bounded work with a clean interface: research, review, verification, a self-contained implementation. Frees your context. | low |
| **Worktree subagent** (`isolation: worktree`) | **Two or more agents writing code at the same time.** Each gets its own checkout so edits cannot collide. `mobile-builder` and `db-engineer` are already declared this way. | medium |
| **Agent team** | Specialists genuinely need to coordinate *with each other* — shared task list, direct messages, work that reshapes as it goes. Requires an interactive session. | high |
| **Dynamic workflow** (`ultracode`) | One large, high-value, fan-out job worth a scripted orchestration of many agents. | highest |

Default to the cheapest row that actually works. Most HerStop tasks are the first two rows.

**Do not use agent teams for a linear pipeline.** Build → verify → review is a pipeline: plain
subagents, dispatched in sequence, are correct and cheaper. Teams earn their cost only when
teammates need to talk to each other.

### Running builders concurrently
Only when the tasks touch disjoint files. The safe split in this repo:
- `mobile-builder` → `apps/mobile/app/**`, `components/**`, `contexts/**`, `hooks/**`
- `db-engineer` → `docs/migrations/**`, `docs/schema.sql`, `apps/mobile/lib/**`

If both need `lib/api.ts`, that is not parallel work — sequence it.

Worktrees branch from **your current HEAD** (`worktree.baseRef: "head"` in settings), so put
yourself on the right integration branch *before* dispatching. Tell every builder to run
`.claude/hooks/worktree-bootstrap.sh` first, or its checks will fail for the wrong reason.

## Step 3 — the loop

```
FOUNDER INTENT
  → spec + plan            docs/features/<name>/{intent,spec,plan}.md
  → dependency graph       TodoWrite
  → builder agent(s)       mobile-builder / db-engineer, worktree-isolated
  → Level 0 gate           tsc + lint (the Stop hook enforces this on you too)
  → integrate              merge builder branches onto the integration branch
  → fresh verifier         mobile-verifier — clean context, reads the spec, not the summary
  → PASS / FAIL / BLOCKED
      FAIL → back to the builder that owns those files, with the verifier's exact
             discrepancies. Then re-verify. Do not fix it yourself to save a round trip —
             the owner has the context.
  → review                 code-reviewer, plus security-reviewer whenever the change touches
                           auth, the database, user data, or UGC
  → founder approval       required for every gate below
  → merge / ship
  → update docs/agent-os/STATUS.md
```

Rules that keep this honest:
- The verifier must be a **separate agent with fresh context**. Verification by the agent that
  wrote the code is not verification.
- **TypeScript compiling is not verification of UI.** Route UI changes through the Simulator —
  see the `ios-verify` skill.
- Report what actually happened. If a check was skipped or blocked, say so; never upgrade
  BLOCKED to PASS.

## Step 4 — escalate only real decisions

Stop and ask the founder for: push/merge to `main` · destructive DB operations · dropping
tables or columns · production schema or auth changes · privileged server keys · paid APIs or
large dependencies · architecture rewrites · product-positioning changes · removing the mock
fallback · storing sensitive location data · production builds/deploys.

Everything else — branch names, file layout, which agent, how many agents, whether to retry —
is yours. Do not ask permission to do your job.

Several of these are additionally enforced by hooks in `.claude/hooks/`, so a forgetful agent
gets blocked rather than trusted. The hooks are a backstop, not a substitute for judgment.

## Dispatch template

When you spawn an agent, give it everything it needs and nothing it doesn't:

```
Task: <one sentence>
Spec: docs/features/<name>/spec.md  (read it; do not trust this summary)
You own these paths: <explicit list>
Do NOT touch: <paths owned by a concurrent agent>
Definition of done: <acceptance criteria>
Report: files changed, verbatim tsc/lint output, how to verify in the Simulator
```
