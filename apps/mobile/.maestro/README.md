# Maestro flows (Level 3 E2E)

Maestro 2.10 is installed on this machine (`/opt/homebrew/bin/maestro`). The full Simulator
procedure, including setup and blockers, is in
`docs/features/ios-simulator-verification/verification.md`.

## To run
```bash
cd apps/mobile
# Native Debug build installed on the Simulator (see verification.md), and ONE Metro on :8081:
npx expo start --dev-client
UDID=$(xcrun simctl list devices booted | grep -m1 -oE '[0-9A-F-]{36}')
maestro --device "$UDID" test .maestro/smoke.yaml
maestro --device "$UDID" test .maestro/save-stop.yaml
```

## Flows
| File | Covers |
|------|--------|
| `smoke.yaml` | onboarding → Explore → every tab renders → no safety-claim copy |
| `save-stop.yaml` | open a stop → save from its card bookmark → appears in Saved (guest path) |
| `saved-tab.yaml` | signed-out Saved tab shows the sign-in invitation (clean state) |
| `auth-request-code.yaml` | Profile → request an email sign-in code (live Supabase) |
| `auth-enter-code.yaml` | enter that code (`-e OTP=...`), run straight after the request flow |
| `saved-persistence.yaml` | signed-in save survives an app relaunch |

## Notes
- `appId: com.adityadas.herstop` targets the **native Debug build** (not Expo Go). Metro must be
  running on :8081 or the Debug app cannot load its JS bundle.
- The three auth flows need live Supabase and a real email code; they are not run in mock mode.
- Stable testIDs in use: `stop-card-<id>`, `stop-card-bookmark-<id>`, `stop-detail-bookmark`,
  `otp-code-input`. Prefer these over matching visible copy.
- As a guest, the detail-screen bookmark routes to sign in instead of saving. Guest saves go
  through the card bookmark.
