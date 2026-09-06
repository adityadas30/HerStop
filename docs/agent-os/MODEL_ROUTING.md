# MODEL ROUTING

Usage-aware routing. The founder has limited Claude usage — spend it where reasoning matters.

| Model | Use for |
|-------|---------|
| **Opus / highest reasoning** | Architecture, orchestration, hard debugging, final high-risk review only. |
| **Sonnet** | Implementation, normal debugging, test/lint fixes, repo edits. |
| **Haiku / smaller** | Summaries, doc updates, low-risk checklists. |
| **Codex / ChatGPT Plus** | Independent review, code-diff review, alternative-implementation critique, PR sanity checks. |
| **Local (founder's 3080)** | Optional later: summaries / log compression / status updates only. Not for core code yet. |

## Usage rules
- Do not run unlimited agents. Prefer **one orchestrator burst + one builder + one verifier**.
- Avoid long exploratory loops.
- Before using an expensive model, state why in one line.
- Stop and ask for approval if a task becomes larger than expected.

## Mapping to agents
Orchestrator → Opus. Mobile Builder / Supabase-DB → Sonnet. QA Verifier → Sonnet (or Codex for a
truly independent pass). Reviewer → Sonnet, escalate to Opus only for high-risk diffs.
