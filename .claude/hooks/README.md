# Hooks

Hooks are configured in `.claude/settings.json` (this folder is just documentation).

## Active
- **PostToolUse** — after `Edit`/`Write`/`MultiEdit` in `apps/mobile`, auto-runs
  `npm run lint -- --fix`. Keeps edits lint-clean without a manual step.
- **Notification** — macOS notification when Claude needs attention.

## Recommended future (not yet configured)
- **Pre-commit typecheck** — run `npx tsc --noEmit` (from `apps/mobile/`) before allowing a commit,
  so type errors never land on an `agent/*` branch. Add as a git pre-commit hook or a Claude
  PreToolUse gate on `git commit`.
- **Product-language guard** — a lightweight check that flags "safe"/"verified safe"/"guaranteed"/
  "crime-free" in staged changes (see `.claude/rules/product-boundaries.md`).

Adding executable hooks changes local behavior — keep them fast and non-blocking, and document any
new hook here.
