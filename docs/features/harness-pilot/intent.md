# Intent — harness-pilot

## Why this exists
HerStop development moved from several manually coordinated Claude Desktop conversations
(Orchestrator, DB Agent, Mobile Builder, QA) — which were separate sessions that could not
actually talk to each other — to a single repo-native **HerStop Lead** session that dispatches
real subagents.

Before trusting that machinery with a real feature, prove the machinery itself.

## What the founder wanted
A safe pilot demonstrating that the orchestration works end to end: the Lead creates tasks,
autonomously dispatches project subagents, those agents run in their own contexts and their own
git worktrees, results come back without the founder copy/pasting anything, an independent
verifier returns a verdict, the Lead reacts to it, and the hooks and tests actually fire.

## Why these two tasks
Both are real, already on the task board or implied by it, and tiny enough that a failure costs
nothing:

- **A** clears the last remaining `npm run lint` warning — an unused import.
- **B** adds `testID` anchors so the staged Maestro flows stop matching on user-visible copy.

They touch **disjoint files**, which is the point: it lets two worktree-isolated builders run at
the same time and proves the isolation is real rather than decorative.

## Non-goals
Not a feature. No product behavior changes. No schema, no migrations, no dependencies, no copy.
