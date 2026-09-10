---
name: ios-verify
description: The real iOS verification procedure for HerStop — what this machine can actually do (Simulator, screenshots, Expo dev server, physical iPhone, Maestro) and the exact commands. Use whenever a change needs to be seen running, not just compiled.
---

# iOS Verification

HerStop is iOS-first. **A change to a screen is not verified because TypeScript compiled.**
Look at the screen.

## What this machine actually has

| Capability | Status | Notes |
|---|---|---|
| iOS Simulator | **available** | Xcode 26.6. Runtimes: iOS 26.4, 26.3, 17.2. `iPhone 17 Pro` is the working device. |
| Simulator screenshots | **available** | `xcrun simctl io booted screenshot` — verified working. |
| Expo dev server | **available** | `npx expo start --ios`. Installs Expo Go into the sim on first run (slow — minutes). |
| iOS bundle export | **available** | `npx expo export --platform ios` — proves it bundles. |
| Physical iPhone | **paired, currently unavailable** | `adi's iPhone` (iPhone 17 Pro) shows as `unavailable` in `xcrun devicectl list devices` — it must be connected and unlocked. Use Expo Go over LAN, same Wi-Fi. |
| Maestro | **not installed** | `maestro` is not on PATH. Flows are staged in `apps/mobile/.maestro/`. Installing it needs founder approval. |
| Jest / unit tests | **none** | The only automated suite is `.claude/hooks/tests/test_guards.py`. |

Do not claim a capability this table says you do not have.

## Level 0 — deterministic
From `apps/mobile/`:
```bash
npx tsc --noEmit
npm run lint
npm run supabase:check   # live Supabase reads vs mock fallback
npm run rls:check        # read-only anon-key RLS assertions
```
In a worktree, run `.claude/hooks/worktree-bootstrap.sh` first — a fresh worktree has no
`node_modules` and no local env file, so these fail for reasons unrelated to the change.

## Level 1 — bundle
```bash
cd apps/mobile && npx expo export --platform ios
```

## Level 2 — Simulator (required for UI changes)

**Preflight: check for a stale dev server.**
```bash
curl -s -m 3 http://localhost:8081/status    # "packager-status:running" means one is already up
pgrep -fl "expo start"                       # which worktree is it serving?
```
A leftover `expo start` from another worktree serves **that branch's code** to the Simulator, so
every screenshot you take verifies the wrong thing and looks completely normal while doing it.
This has already happened once in this repo. Kill it (`pkill -f "expo start"`) before starting
your own.

```bash
# 1. device
xcrun simctl list devices booted
xcrun simctl boot "iPhone 17 Pro" 2>/dev/null || true
open -a Simulator

# 2. dev server (background; first run installs Expo Go and takes minutes)
cd apps/mobile && CI=1 nohup npx expo start --ios > /tmp/herstop-verify.log 2>&1 &

# 3. watch until the bundle is served
tail -40 /tmp/herstop-verify.log

# 4. capture each screen in the acceptance criteria
xcrun simctl io booted screenshot /tmp/herstop-explore.png
```
Then **Read the PNG** and write down what you see. A screenshot you did not look at is not
evidence. Capture one per screen the spec mentions.

Tear down when finished:
```bash
pkill -f "expo start" || true
```

### Navigating without taps
There is no `idb`/`applesimutils` here and AppleScript has no Accessibility permission, so
**scripted taps are not possible**. Navigate with deep links instead — this works well:
```bash
xcrun simctl openurl booted "exp://127.0.0.1:8081/--/safety"
xcrun simctl openurl booted "exp://127.0.0.1:8081/--/(tabs)"
xcrun simctl openurl booted "exp://127.0.0.1:8081/--/stop/1"
```
Confirm which screen you actually landed on from the highlighted tab in the screenshot, not from
the URL you requested.

### Confirming you are looking at live, current code
Two cheap checks, both worth doing before trusting any screenshot:
- `curl -s localhost:8081/status` → `packager-status:running`
- watch the dev-server log for `[getStops] LIVE Supabase: 6 rows` — proves a fresh bundle of the
  current branch, not a stale cache.

Common failures, and what they mean:
- `npx expo start --ios` may prompt to upgrade Expo Go in the simulator, and under `CI=1` that
  prompt hard-fails with `CommandError: Input is required, but 'npx expo' is in non-interactive
  mode.` Use `npx expo start --localhost` (without `--ios`) and deep-link in, or answer the
  prompt interactively once.
- `NXDOMAIN` / mock data on Explore → the env file is missing or the Supabase host is wrong.
  Run `npm run supabase:check` to tell live from mock. Not a UI bug.
- Expo Go missing → first `--ios` run downloads it. Let it finish; do not hand-install.
- Blank screen with a red box → read `/tmp/herstop-verify.log`, that is the real error.

## Level 3 — Maestro (staged, not runnable yet)
Flows live in `apps/mobile/.maestro/`. They are written against the real screens and will run
unchanged once Maestro is installed:
```bash
maestro test apps/mobile/.maestro/smoke.yaml
```
If `maestro` is not on PATH, report "Level 3 skipped — Maestro not installed" and move on.
Installing it is a founder decision (`brew install maestro` pulls a JVM toolchain).

## Physical iPhone
```bash
xcrun devicectl list devices          # confirm the phone is connected and available
cd apps/mobile && npx expo start      # scan the QR from Expo Go, same Wi-Fi
```
Useful for haptics, real gestures, and true dark-mode rendering. Screenshots must be taken by
the founder — there is no scripted screenshot path for a physical device here.

## Recording results
Every run goes into the feature's `docs/features/<name>/verification.md` with:
the command, its verbatim output, PASS/FAIL/BLOCKED per acceptance criterion, and the
screenshot paths. BLOCKED is an honest and acceptable result. A PASS you did not observe is not.
