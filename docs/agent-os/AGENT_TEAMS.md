# Agent Teams — status and how to use them

Verified against the installed Claude Code **2.1.267** on 2026-09-10, by inspecting the shipped
binary rather than trusting documentation.

## What is enabled

Agent Teams is **experimental and off by default**. It is gated by an environment variable,
which this project now sets for every session:

```json
// .claude/settings.json
{ "env": { "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1" } }
```

There is also a CLI flag (`claude --agent-teams`) and a related preference, `teammateMode`,
which controls *how* teammates run:

| `teammateMode` | Behavior |
|---|---|
| `auto` (default) | Picks a backend; falls back to in-process if no terminal backend is available |
| `tmux` | Each teammate gets a tmux pane |
| `iterm2` | Native iTerm2 panes (requires iTerm2 + its Python API enabled) |
| `in-process` | Teammates run inside the current session, no panes |

`teammateMode` is a **per-machine terminal preference**, so it belongs in your user settings
(`~/.claude/settings.json`), not in the project. Leave it at `auto` unless panes misbehave.

## What teams actually give you, over plain subagents

Both get an isolated context window. The difference:

| | Subagent | Teammate |
|---|---|---|
| Coordination | you (the Lead) route everything | shared task list; teammates self-coordinate |
| Communication | reports back to you only | can message each other directly |
| Lifetime | one task, then done | persists across the work |
| Cost | lower | higher — each is a full session |

## There is no static team config

No `.claude/teams/` directory. No `team:` field in agent frontmatter. Teams are formed at
**runtime**: with the flag enabled, in an interactive session, ask the Lead to spawn teammates
and it uses your existing `.claude/agents/*.md` definitions as the teammate types.

## Hard requirement: an interactive session

Teammates do not spawn in non-interactive/print mode (`claude -p`) or inside a subagent. The
team tools are not even present in that case. **The Agent Teams pilot therefore could not be run
during the harness build** — that session was non-interactive. It has to be run from a normal
interactive terminal session, and the env var only takes effect for sessions started *after* the
setting was added.

## When to use one — and when not to

Use a team when specialists genuinely need to coordinate **with each other**: several parallel
research or review threads whose findings reshape each other's work.

Do **not** use one for HerStop's normal loop. `build → verify → review` is a linear pipeline;
sequential subagents are correct, cheaper, and easier to reason about. A team there is cost with
no benefit.

If you do form a team, **partition file ownership up front** — teammates must never hold
overlapping files. Same rule as concurrent worktree builders, and it matters more here because
teammates keep working rather than finishing and handing back.

## Dynamic Workflows (related, separate feature)

Also present in 2.1.267 and **on by default**. The Lead writes a script that orchestrates many
agents in phases; results stay in script variables rather than in the Lead's context. Triggered
by the keyword `ultracode` in a prompt, or by asking for a workflow directly. Size is
promptable ("use a small workflow, 5 agents max"). Disabled via `enableWorkflows: false`.

Reserve it for one large, high-value, fan-out job. It is the most expensive mode available.
