# Rule: Coding Standards

- **TypeScript everywhere**, strict mode. No `any` unless justified in a comment.
- Beginner-readable: the founder is learning from this code. Prefer clear over clever.
- Small, focused functions and small reusable components.
- Reuse existing utilities/components before adding new ones.
- Comments only where they aid understanding — not narration.
- Match the style of surrounding code (naming, structure, imports).
- No new dependencies without calling it out and getting approval.
- Keep changes scoped to the task. No opportunistic refactors.

## Deterministic checks (run from `apps/mobile/`)
- `npx tsc --noEmit` — must pass.
- `npm run lint` — must pass (a post-edit hook also runs `lint --fix`).
- There is no test runner yet; see `.claude/rules/testing-rules.md`.
