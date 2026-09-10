#!/usr/bin/env bash
# Stop hook — deterministic Level 0 gate.
#
# If this turn left uncommitted TypeScript changes in apps/mobile, typecheck and lint
# must pass before the Lead is allowed to finish. Blocks at most once per session so a
# genuinely stuck state can still be reported to the founder instead of looping.
set -uo pipefail
cat >/dev/null   # drain the hook event

PROJECT="${CLAUDE_PROJECT_DIR:-$(pwd)}"
MOBILE="$PROJECT/apps/mobile"
[ -d "$MOBILE" ] || exit 0

changed=$(git -C "$PROJECT" status --porcelain -- 'apps/mobile/**/*.ts' 'apps/mobile/**/*.tsx' 2>/dev/null)
[ -z "$changed" ] && exit 0

STAMP="${CLAUDE_PROJECT_DIR:-/tmp}/.claude/.quality-gate-fired"
[ -f "$STAMP" ] && exit 0

cd "$MOBILE" || exit 0
tsc_out=$(npx tsc --noEmit 2>&1); tsc_rc=$?
lint_out=$(npm run lint 2>&1); lint_rc=$?

if [ $tsc_rc -ne 0 ] || [ $lint_rc -ne 0 ]; then
  : > "$STAMP"
  reason="QUALITY GATE FAILED — apps/mobile has uncommitted TypeScript changes that do not pass Level 0."
  [ $tsc_rc -ne 0 ] && reason="$reason"$'\n\n--- npx tsc --noEmit ---\n'"$(echo "$tsc_out" | tail -30)"
  [ $lint_rc -ne 0 ] && reason="$reason"$'\n\n--- npm run lint ---\n'"$(echo "$lint_out" | tail -30)"
  reason="$reason"$'\n\nFix these, or route them back to the responsible builder agent, before finishing. (This gate fires once per session.)'
  python3 -c 'import json,sys;print(json.dumps({"decision":"block","reason":sys.stdin.read()}))' <<< "$reason"
fi
exit 0
