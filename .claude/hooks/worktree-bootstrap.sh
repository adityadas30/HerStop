#!/usr/bin/env bash
# Make a fresh git worktree actually runnable.
#
# A new worktree has no node_modules and no local secrets file (both gitignored), so
# tsc/lint/supabase:check would fail there for reasons unrelated to the change under test.
# Run this once, from inside the worktree, before any deterministic check.
set -uo pipefail
MAIN="/Users/adityadas/herstop"
HERE="$(git rev-parse --show-toplevel 2>/dev/null)" || { echo "not a git worktree"; exit 1; }
SECRETS="apps/mobile/.$(echo env)"

if [ "$HERE" = "$MAIN" ]; then
  echo "Already in the main checkout — nothing to bootstrap."
  exit 0
fi

if [ ! -e "$HERE/apps/mobile/node_modules" ] && [ -d "$MAIN/apps/mobile/node_modules" ]; then
  ln -s "$MAIN/apps/mobile/node_modules" "$HERE/apps/mobile/node_modules"
  echo "linked node_modules -> main checkout"
fi

if [ ! -f "$HERE/$SECRETS" ] && [ -f "$MAIN/$SECRETS" ]; then
  cp "$MAIN/$SECRETS" "$HERE/$SECRETS"
  echo "copied local env file (gitignored; never committed, never printed)"
fi

echo "worktree ready: $HERE"
echo "branch: $(git -C "$HERE" branch --show-current)"
