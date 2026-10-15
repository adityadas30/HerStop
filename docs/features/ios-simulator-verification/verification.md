# Verification — iOS Simulator procedure (HerStop mobile)

> **Status: procedure written, NOT executed.** Written 2026-10-14 on branch `paseo/mobile`
> (worktree `.paseo/worktrees/24cbrb6k/herstop-mobile`, HEAD `c49dd9f`). No Simulator was booted,
> no Metro/Expo was started, nothing was installed, and no live service was contacted. Every
> "Expected" below is what should happen, not something that was observed.

## 1. Environment checks run (read-only, 2026-10-14)
| Check | Command | Result |
|---|---|---|
| Xcode | `xcode-select -p` · `xcodebuild -version` | `/Applications/Xcode.app/...` · Xcode 27.0 (27A266a) |
| iOS runtimes | `xcrun simctl list runtimes` | iOS 17.2, 26.3, 26.4 |
| Devices | `xcrun simctl list devices available` | `iPhone 17 Pro` `7ABF361F-E5E9-4739-9DAF-4C2F6A5DE2F6` was **already Booted** (not by this task) |
| Expo Go in that sim | `xcrun simctl listapps <udid> \| grep host.exp.Exponent` | installed |
| Maestro | `which maestro` · `maestro --version` | `/opt/homebrew/bin/maestro` · 2.10.0 |
| Java (for Maestro) | `java -version` | OpenJDK 23.0.2 |
| Node / npm | `node -v` · `npm -v` | v24.14.1 · 11.11.0 |
| Watchman | `which watchman` | not installed (optional; Metro falls back to its own file watcher) |
| Metro port | `lsof -nP -iTCP:8081 -sTCP:LISTEN` | nothing listening |
| `apps/mobile/node_modules` | `ls -d node_modules` | **missing** |
| `apps/mobile/.env` | `test -e .env` (existence only, not read) | **missing** (`.env.example` present) |

## 2. What a human must do before running it
1. **Install dependencies** (from `apps/mobile/`): `npm ci`. The lockfile is committed. Without
   this, `tsc`, `lint`, `npm test` and `expo start` will all fail.
2. **Decide live or mock data.**
   - **Mock (no setup):** leave `.env` absent. The app detects the missing values and serves
     the clearly marked mock stops. Browsing, filters, stop detail and guest save all work. Sign in
     and persisted saves do not.
   - **Live:** copy `.env.example` to `.env` and fill in **only** `EXPO_PUBLIC_SUPABASE_URL` and
     `EXPO_PUBLIC_SUPABASE_ANON_KEY` (the anon/public key only, never a privileged server key).
     Do not paste the file into chat or logs.
3. **Make sure no other worktree's Metro is running.** A leftover `expo start` serves *that*
   branch's code to the Simulator (see `.claude/skills/ios-verify/SKILL.md`).

## 3. Procedure
All commands are run from `apps/mobile/` unless noted otherwise.

### Level 0 — deterministic
```bash
npx tsc --noEmit        # Expected: no output, exit 0
npm run lint            # Expected: 0 errors
npm test                # Expected: all Jest suites in __tests__/ pass
npm run supabase:check  # Live only. Expected: "LIVE" + row count. Without .env: reports mock fallback
```

### Level 1/2 — run in the Simulator
```bash
xcrun simctl list devices booted               # note the UDID; boot one if none:
xcrun simctl boot "iPhone 17 Pro" && open -a Simulator
npx expo start --ios                           # Metro on :8081, opens the project in Expo Go
```
Expected in the Simulator:
- [ ] Onboarding shows "Get Started" and the "decision support — not safety guarantees" line.
- [ ] "Get Started" leads to the Explore tab with "Where are you heading?" and a list of stop cards.
- [ ] Mock mode shows the mock stops. Live mode shows the live `stops` rows (Metro logs say which).
- [ ] Tapping a card opens "Stop Details". Back returns to Explore.
- [ ] The bookmark on a card fills in. The Saved tab lists it under "Keep these stops" (guest).
- [ ] As a guest, the bookmark on the detail screen routes to Profile (sign in) rather than saving.
- [ ] The Safety, Journeys and Profile tabs render. No copy makes an absolute safety claim about a
  place.
- [ ] Screenshot: `xcrun simctl io booted screenshot /tmp/herstop-explore.png`, then **open it
  and look**. A compiled build is not a verified screen.

### Level 3 — Maestro
The app must already be open in Expo Go (step above). All flows use `appId: host.exp.Exponent`.
```bash
UDID=$(xcrun simctl list devices booted | grep -m1 -oE '[0-9A-F-]{36}')
cd .maestro
maestro --device "$UDID" test smoke.yaml          # onboarding → Explore → every tab
maestro --device "$UDID" test save-stop.yaml      # guest: open stop, save from card, see it in Saved
maestro --device "$UDID" test saved-tab.yaml      # clearState: true → signed-out empty state
```
The signed-in flows need a live `.env` and a real inbox. Run them in this order, with nothing in
between:
```bash
maestro --device "$UDID" test auth-request-code.yaml
maestro --device "$UDID" test -e OTP=<code from email> auth-enter-code.yaml
maestro --device "$UDID" test saved-persistence.yaml   # signed-in save survives a relaunch
```
Expected: each command ends with every step green. Screenshots are written to the working
directory (`maestro-herstop-*.png`).

## 4. Changes made in this task
- `apps/mobile/.maestro/save-stop.yaml`: replaced the nonexistent `save-stop-button` id.
  - The guest save now taps the card bookmark `stop-card-bookmark-<id>`.
  - The detail bookmark `stop-detail-bookmark` routes guests to sign in, so the guest flow
    can't use it.
  - Opening a card uses `stop-card-(?!bookmark-).*`, so it can't match a bookmark by accident.
  - Added the Expo Go launch handling that `smoke.yaml` already uses.
  - Asserts the guest "Keep these stops" card.
  - No app code or testIDs needed changing, because the IDs already exist.
- `apps/mobile/.maestro/smoke.yaml`: corrected the comment that said the app has no bundle identifier.
- `apps/mobile/.maestro/README.md`: removed the out-of-date "not installed" and "no bundleIdentifier"
  notes, and listed every flow.

## 5. Blockers and caveats
- **None of this has been executed.** `save-stop.yaml` in particular needs a first real run. These
  are untested assumptions:
  - Maestro's regex support for `(?!...)`. If it fails, use `stop-card-1` for mock data.
  - Nested-touchable tap targeting.
- `node_modules` and `.env` are missing in this worktree (section 2).
- Guest saves live in memory. If Expo Go resumes the JS bundle without reloading, a stop saved by a
  previous run is still saved, and the card tap in `save-stop.yaml` would *unsave* it. Run
  `saved-tab.yaml` (clearState) first, or reload the app, for a clean start.
- In live mode, the stop count depends on founder migrations 003, 005, 006 and 007
  (`docs/release/FOUNDER_CHECKLIST.md`). Expect 6 rows before they run and 44 after.
- Maestro runs only against Expo Go. Testing the real `com.adityadas.herstop` build needs an EAS
  build or a dev client, which is out of scope here and needs founder approval.
- OTP flows hit Supabase email rate limits until Resend SMTP is configured.

## Product-language scan
No new user-facing copy. The flows assert that "Verified safe" and "Guaranteed" are **not** visible.
