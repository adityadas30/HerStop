#!/usr/bin/env bash
# PostToolUse(Edit|Write) — auto-fix lint on mobile source only.
# Scoped so edits to docs/config don't pay for an eslint run.
set -uo pipefail
path=$(python3 -c 'import json,sys;d=json.load(sys.stdin);print((d.get("tool_input") or {}).get("file_path") or "")' 2>/dev/null <<< "${HOOK_INPUT:-$(cat)}")
case "$path" in
  */apps/mobile/*.ts|*/apps/mobile/*.tsx)
    cd "$CLAUDE_PROJECT_DIR/apps/mobile" 2>/dev/null || exit 0
    npx eslint --fix "$path" >/dev/null 2>&1 || true
    ;;
esac
exit 0
