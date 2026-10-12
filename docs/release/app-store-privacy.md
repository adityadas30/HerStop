# App Store privacy & metadata (draft)

Answers for App Store Connect → App Privacy, derived from the code as of 2026-10-12.
Keep in sync with `docs/release/privacy-policy.md` and `apps/mobile/constants/legal-content.ts`.
Founder reviews and submits these; nothing here has been entered in App Store Connect.

## Tracking
**No tracking.** No advertising, analytics, or cross-app tracking SDKs. No ATT prompt needed.

## Data types

| Apple data type | Collected? | Linked to user? | Used for tracking? | Purpose | Code source |
|---|---|---|---|---|---|
| Contact Info → Email Address | Yes (only if the user signs in) | Yes | No | App Functionality (one-time sign-in code) | `lib/auth.ts`, Supabase Auth |
| User Content → Other User Content (reviews, review reports) | Yes (signed-in users only) | Yes | No | App Functionality | `lib/` review/report calls, Supabase tables |
| Identifiers → User ID | Yes (Supabase auth user id; ties saved stops, reviews, reports to the account) | Yes | No | App Functionality | `lib/supabase.ts` session |
| Diagnostics → Crash Data | **Only when `EXPO_PUBLIC_SENTRY_DSN` is set** (t9, not yet shipped). Answer "Yes" if the release build has a DSN; "No" otherwise | Not linked (no PII sent) | No | App Functionality / Analytics (crash diagnostics) | Sentry integration (t9) |
| Location (Precise/Coarse) | **No.** Read on-device to sort stops by distance; never stored, logged, or sent off-device | n/a | n/a | n/a | `lib/location`, `expo-location` |

Notes:
- Saved stops are keyed by user ID and stored in Supabase; they fall under User ID / App Functionality, not a separate Apple type.
- Location: Apple's "collected" means transmitted off device. It is not. Declare no Location data. The permission string already says so (`app.json` → `NSLocationWhenInUseUsageDescription`).
- Browsing as a guest collects nothing.
- Account deletion is in-app (Profile tab), which satisfies Apple's account-deletion requirement once migration 007 is applied (see `docs/migrations`).

## Required-reason API privacy manifest
Declared in `apps/mobile/app.json` → `ios.privacyManifests`. Each entry is copied from a `PrivacyInfo.xcprivacy` shipped by an installed package (`apps/mobile/node_modules`, verified 2026-10-12). Nothing is declared that no package declares.

| Category | Reasons | Declared by |
|---|---|---|
| FileTimestamp | C617.1 | `@react-native-async-storage/async-storage`, `react-native` (React, cxxreact, RCT-Folly, glog, boost), `react-native-maps` |
| FileTimestamp | 0A2A.1, 3B52.1 | `expo-file-system` (dependency of `expo`) |
| UserDefaults | CA92.1 | `react-native` (React/Resources), `expo-constants`, `expo-system-ui` |
| SystemBootTime | 35F9.1 | `react-native` third-party boost |
| DiskSpace | E174.1, 85F4.1 | `expo-file-system` |

- `react-native-maps` is used with the Apple provider; its Google Maps bundle (`GoogleMapsPrivacy.bundle`) is not linked, so its extra reasons are not declared.
- Re-verify when upgrading Expo SDK or adding native packages (`find node_modules -name PrivacyInfo.xcprivacy`). Sentry (t9) ships its own manifest; add anything it declares.
- Reference: https://developer.apple.com/documentation/bundleresources/privacy_manifest_files/describing_use_of_required_reason_api

## URLs
| Needed | Current state |
|---|---|
| Privacy Policy URL | In-app: Profile → Privacy (`app/legal/privacy.tsx`). Source text `docs/release/privacy-policy.md`. **Founder TODO:** host publicly and enter the URL. |
| Support URL | In-app: Profile → Support (`app/legal/support.tsx`). **Founder TODO:** public page/URL. |
| Support email | `SUPPORT_EMAIL_PLACEHOLDER` in `constants/app-info.ts`. **Founder TODO:** set a real address before submission. |
| Safety disclosure | In-app: `app/legal/safety-disclosure.tsx` |

## Draft listing copy
Follows `.claude/rules/product-boundaries.md`: decision support, no safety guarantee.

**Name:** HerStop
**Subtitle (30 max):** Rest stops, traveler-reviewed

**Keywords (100 max):** rest stop,restroom,road trip,women travelers,highway,travel,reviews,lighting,map,stopover

**Promotional text:** See what other travelers reported about rest stops on your road trip: lighting, restrooms, cleanliness, staff, and more.

**Description:**
HerStop helps women travelers decide where to stop on the road.

Browse rest stops, fuel stations, and other stops near you, and read structured feedback from other travelers: lighting, restroom quality, cleanliness, staff, and how the area felt. Each stop shows a label such as Recommended Stop, Good Option, or Use Caution, along with how many traveler reviews are behind it. Stops with fewer than 3 reviews are marked Limited Data.

- Explore stops on a list or map, sorted by distance from you
- Read recent traveler feedback and see how much data a stop has
- Save stops for later (with an account)
- Leave your own review and report reviews that don't belong
- Get directions in your maps app

HerStop is decision support, not a safety guarantee. Conditions change, and feedback reflects what individual travelers reported. Use your own judgment.

Your location is used on your device to sort stops by distance. It is not stored or sent anywhere. You can browse without an account.

Stop data © OpenStreetMap contributors (ODbL).

**Review notes (for Apple):** Browsing needs no account. Sign-in uses an emailed one-time code; a reviewer account needs a Supabase test user (founder TODO, do not commit credentials). Journeys and Safety tabs are labelled "Coming Soon" and contain no live features.

**Age rating:** user-generated content (reviews) with reporting and moderation → answer the UGC questions accordingly.
