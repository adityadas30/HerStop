# Hooks — deterministic enforcement

Hooks are executed by Claude Code, not by the model. That makes them the right place for the
constraints that must never be reasoned around. Wiring lives in `.claude/settings.json`.

Regression suite: `python3 .claude/hooks/tests/test_guards.py` (22 guard cases + 7
product-language cases). Run it after touching any guard.

## Active

| Event | Script | What it does |
|---|---|---|
| `SessionStart` | `session-start.sh` | Injects real repo state (branch, dirty count, worktrees, whether the local env file exists) so the Lead plans from facts, not assumptions. Also clears the quality-gate stamp. |
| `PreToolUse(Bash)` | `guard-bash.py` | **Denies:** printing the env file · privileged-key references · destructive SQL via psql/supabase/REST · `supabase db reset\|push` · push to `main` · force-push · `eas build/submit/update` · `expo publish` · `reset-project`. **Asks:** bare `psql` · merge/rebase against main · `reset --hard` / `branch -D` / `clean -f` · recursive delete outside the scratchpad. |
| `PreToolUse(Edit\|Write\|NotebookEdit)` | `guard-write.py` | **Denies:** writing an env file · a privileged key reference in repo code · a real JWT in a tracked file · disabling RLS. **Asks:** `using (true)` on `saved_stops`/`reviews`/`profiles` · edits to the hooks or settings themselves. Content rules apply only to files inside the repo. |
| `PostToolUse(Edit\|Write)` | `check-product-language.py` | Scans string literals in `apps/mobile/**/*.ts(x)` for absolute safety claims and blocks with a correction. "Safety" as a topic is allowed; "this stop is safe" is not. |
| `PostToolUse(Edit\|Write)` | `lint-fix.sh` | `eslint --fix` on the edited file only — scoped, so doc edits don't pay for a lint run. |
| `Stop` | `quality-gate.sh` | If the turn left uncommitted TS changes in `apps/mobile`, runs `tsc --noEmit` + `lint` and blocks the turn from ending if either fails. Fires at most once per session so a genuinely stuck state can still be reported. |
| `Notification` | inline | macOS notification when the Lead needs attention. |

Not a hook, but lives here: `worktree-bootstrap.sh` — run by builder agents inside a fresh
worktree to link `node_modules` and copy the local env file.

## Design notes
- Guards return `{"hookSpecificOutput": {"permissionDecision": "deny"|"ask", ...}}` on exit 0.
  `deny` is absolute; `ask` routes to the founder. In a **non-interactive** session `ask`
  resolves to denied — that is intended: unattended runs should not silently do risky things.
- `deny` reasons name the rule and the alternative, so a blocked agent can self-correct rather
  than retry blindly.
- Guards are regex over the command/content. They stop the obvious and the careless; they are
  a backstop for judgment, not a sandbox. Keep them fast and keep false positives near zero —
  a noisy guard gets worked around.

## Known gaps
- The "don't edit the guards" rule covers `Edit`/`Write` but not a `Bash` heredoc that rewrites
  a hook file.
- Product-language scanning covers `apps/mobile` source only, not docs or commit messages.
