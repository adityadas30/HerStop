# COMMANDS

Only commands **verified to exist in this repo**. Run from `apps/mobile/` unless noted.
Package manager: **npm** (`package-lock.json`). Node: see `.nvmrc` (`lts/*`).

## Deterministic checks (Level 0)
```bash
npm install            # install deps
npx tsc --noEmit       # typecheck (strict mode; no dedicated script)
npm run lint           # eslint via eslint-config-expo
npm run supabase:check # read-only: confirm live Supabase reads vs mock fallback
```

## Run the app (Level 1–2)
```bash
npm start              # expo start (dev server / QR)
npm run ios            # expo start --ios (iOS Simulator)
npm run web            # expo start --web
```

## Not available yet (do not invent)
- No `test` script / no Jest.
- No Maestro (`maestro test ...`) — E2E is future work.
- `npm run android` exists but Android is out of scope for v1.

## Notes
- A post-edit hook auto-runs `npm run lint -- --fix` after edits in `apps/mobile` (see
  `.claude/settings.json`).
- `npm run reset-project` scaffolds a blank app — destructive to current app code; do not run.
