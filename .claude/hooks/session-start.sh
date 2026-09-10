#!/usr/bin/env bash
# SessionStart — put real repo state in front of the Lead instead of assumptions.
set -uo pipefail
cat >/dev/null
PROJECT="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$PROJECT" 2>/dev/null || exit 0

branch=$(git branch --show-current 2>/dev/null)
dirty=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
env_state="MISSING (.env absent — live Supabase reads and rls:check will fail here)"
[ -f "apps/mobile/.env" ] && env_state="present"
wt=$(git worktree list 2>/dev/null | wc -l | tr -d ' ')
rm -f "$PROJECT/.claude/.quality-gate-fired" 2>/dev/null

ctx="HerStop session start — branch: ${branch:-?} · uncommitted files: ${dirty} · worktrees: ${wt} · apps/mobile/.env: ${env_state}
You are the HerStop Lead. Read docs/agent-os/STATUS.md before planning. Orchestration playbook: .claude/skills/herstop-orchestration/SKILL.md"

python3 -c 'import json,sys;print(json.dumps({"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":sys.stdin.read()}}))' <<< "$ctx"
exit 0
