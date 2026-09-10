# Maestro flows (Level 3 E2E)

**Not runnable yet.** `maestro` is not installed on this machine. These flows are staged so
that Level 3 becomes a one-command step the day it is installed, rather than a writing task.

## To enable (founder decision — pulls a JVM toolchain)
```bash
brew install maestro          # or: curl -Ls https://get.maestro.mobile.dev | bash
maestro --version
```

## To run
```bash
cd apps/mobile
CI=1 npx expo start --ios &   # app must be running in the Simulator first
maestro test .maestro/smoke.yaml
maestro test .maestro/save-stop.yaml
```

## Flows
| File | Covers |
|------|--------|
| `smoke.yaml` | onboarding → Explore → every tab renders → no safety-claim copy |
| `save-stop.yaml` | open a stop → save → appears in Saved (guest path) |

## Notes
- `appId: host.exp.Exponent` targets **Expo Go**, because `app.json` has no
  `ios.bundleIdentifier`. Change it once a dev client or standalone build exists.
- `save-stop.yaml` asserts the guest (in-memory) path only. Persisted saving needs a signed-in
  user *and* `docs/migrations/002_auth_tables.sql` applied; until then a signed-in save rolls
  back by design and asserting persistence would fail for the wrong reason.
- Adding stable `testID`s to `StopCard` and the bookmark button would make these flows much
  less brittle than matching on visible text. Worth doing before Level 3 goes live.
