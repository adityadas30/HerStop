# MODEL ROUTING

Usage-aware routing. The founder has limited Claude usage — spend it where reasoning matters.
Each agent's model is declared in its own `.claude/agents/*.md` frontmatter; this file explains why.

| Model | Assigned to | Why |
|---|---|---|
| **Opus** | the Lead · `security-reviewer` | Decomposition, dependency graphs, integration judgment, and the review where a miss has real consequences for users' privacy. |
| **Sonnet** | `mobile-builder` · `db-engineer` · `mobile-verifier` · `code-reviewer` | Implementation, verification, and ordinary review. Most of the work lives here. |
| **Haiku** | `repo-scout` | Finding facts in the repository. Cheap by design — dispatch it freely instead of burning Lead context on searching. |

## Usage rules
- The number of agents is not the goal. Prefer **Lead + one builder + one verifier**.
- Delegation that re-loads context the Lead already holds is a net loss — do the small thing yourself.
- Escalate a model only for a genuinely high-risk change, and say why in one line.
- Stop and ask if a task outgrows its plan.

## Cost order of execution modes
main context < subagent < worktree subagent < agent team < dynamic workflow.
Pick the cheapest that actually works. Selection guidance:
`.claude/skills/herstop-orchestration/SKILL.md`.

## Independent review
A second opinion from a different model or tool (e.g. an outside reviewer on a diff) is still
useful for high-risk changes. What matters is that the reviewer has **fresh context** and did
not write the code.
