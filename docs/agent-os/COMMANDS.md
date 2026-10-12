# COMMANDS

Only commands **verified to exist in this repo**. Run from `apps/mobile/` unless noted.
Package manager: **npm** (`package-lock.json`). Node: see `.nvmrc` (`lts/*`).

## Deterministic checks (Level 0)
```bash
npm install            # install deps
npx tsc --noEmit       # typecheck (strict mode; no dedicated script)
npm run lint           # eslint via eslint-config-expo
npm run supabase:check # read-only: confirm live Supabase reads vs mock fallback
npm run rls:check      # read-only: anon-key RLS assertions for profiles/saved_stops/reviews
```

From the **repo root** — the harness's own regression suite (the only automated tests here):
```bash
python3 .claude/hooks/tests/test_guards.py   # 22 guard cases + 7 product-language cases
```

## Run the app (Level 1–2)
```bash
npm start              # expo start (dev server / QR)
npm run ios            # expo start --ios (iOS Simulator)
npm run web            # expo start --web
```

## iOS verification (Level 2)
```bash
xcrun simctl list devices booted
xcrun simctl boot "iPhone 17 Pro" 2>/dev/null || true; open -a Simulator
cd apps/mobile && CI=1 nohup npx expo start --ios > /tmp/herstop-verify.log 2>&1 &
xcrun simctl io booted screenshot /tmp/herstop-<screen>.png    # then READ the png
pkill -f "expo start"                                          # tear down
```
Full procedure and failure modes: `.claude/skills/ios-verify/SKILL.md`.

**Check for a stale dev server first.** `curl -s localhost:8081/status` — a leftover
`expo start` from another worktree will serve the wrong branch's code and silently invalidate
the whole verification run.

## In a worktree, bootstrap first
```bash
.claude/hooks/worktree-bootstrap.sh   # links node_modules, copies the local env file
```
Without it a fresh worktree fails tsc/lint/supabase:check for reasons unrelated to the change.

## Not available yet (do not invent)
- Jest covers pure `lib/` functions only (`npm test`); there are no component/UI tests.
- Maestro is **not installed**; flows are staged in `apps/mobile/.maestro/` and skipped.
- `npm run android` exists but Android is out of scope for v1.

## Notes
- A post-edit hook auto-runs `npm run lint -- --fix` after edits in `apps/mobile` (see
  `.claude/settings.json`).
- `npm run reset-project` scaffolds a blank app — destructive to current app code; do not run.
