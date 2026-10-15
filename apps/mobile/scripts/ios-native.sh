#!/usr/bin/env bash
# Build HerStop as a native Debug app and install it on a booted iOS Simulator.
#
# Why this exists: `expo run:ios` / `expo start --ios` look the Simulator app up
# through Expo CLI, which fails under Xcode 27 ("Can't determine id of Simulator
# app"). This script calls xcodebuild and simctl directly instead.
#
# Usage (from apps/mobile):  npm run ios:build
#   UDID=<simulator id> npm run ios:build     # default: the first booted Simulator
# Then start Metro in another terminal:  npm run ios
set -euo pipefail

BUNDLE_ID="com.adityadas.herstop"
UDID="${UDID:-$(xcrun simctl list devices booted | grep -m1 -oE '[0-9A-F]{8}-([0-9A-F]{4}-){3}[0-9A-F]{12}')}"
if [ -z "$UDID" ]; then echo "No booted Simulator. Boot one first." >&2; exit 1; fi

# Sentry's Xcode build phase would try to upload debug symbols; not wanted locally.
export SENTRY_DISABLE_AUTO_UPLOAD=true
export LANG="${LANG:-en_US.UTF-8}" # CocoaPods needs a UTF-8 locale

# ios/ is generated (gitignored). Create it only if it is missing; never --clean here.
if [ ! -d ios ]; then npx expo prebuild --platform ios --no-install; fi
(cd ios && pod install)

xcodebuild -workspace ios/HerStop.xcworkspace -scheme HerStop -configuration Debug \
  -destination "id=$UDID" -derivedDataPath ios/build build

xcrun simctl install "$UDID" ios/build/Build/Products/Debug-iphonesimulator/HerStop.app
xcrun simctl launch "$UDID" "$BUNDLE_ID"
