# HerStop — founder manual test plan (native iOS, Simulator)

Base commit `eeb55c0`. Mock mode (no `apps/mobile/.env`). Companion to `feature-checklist.md`.
"Auto" = a Maestro flow already passes this against the native app. "Manual only" = nobody
has watched it yet, so a pass or fail from you is new information.

## Before you start
- Simulator iPhone 17 Pro is booted with HerStop installed; Metro runs on :8081 from the Mobile worktree.
- Location is set near Purdue and permission is granted. To change: `xcrun simctl location <udid> set <lat>,<lng>`;
  revoke with `xcrun simctl privacy <udid> revoke location com.adityadas.herstop`.
- Reset app state: long-press the app icon → Delete App → rebuild with `npm run ios:build`, or run `saved-tab.yaml` (clears state).
- Stop names are mock data (e.g. "Cedar Falls Rest Area"). They are not real places and show "Limited Data".

## A. Test NOW (mock mode)
| # | Test | Steps | Expected | Failure looks like | Auto |
|---|---|---|---|---|---|
| A1 | Cold launch + onboarding | Launch HerStop | Logo area, "Find better stops. Travel with more confidence.", **Get Started**, line "decision support — not safety guarantees" | Red error screen, blank screen, crash, "supabaseUrl is required" | Yes (smoke) |
| A2 | Enter the app | Tap Get Started | Explore with search "Where are you heading?" and tab bar | Stays on onboarding; tab bar covered by a warning toast | Yes (smoke) |
| A3 | Explore list | Stay on List | "Recommended near you", stop cards with a badge and "No reviews yet" | Empty list, duplicate cards, overlapping text | Partly (screenshot) |
| A4 | Location sorting | Location granted → look under the heading | "Sorted by distance from you"; "N.N mi away" on cards, nearest first | Note says "Couldn't get your location" even though set; order not by distance | Manual only |
| A5 | Location denied | Revoke permission, relaunch, Get Started | "Turn on location to sort by distance"; list still usable | Crash, spinner forever | Manual only |
| A6 | No GPS fix | Clear Simulator location (Features ▸ Location ▸ None), relaunch | "Couldn't get your location, so stops aren't sorted by distance" | Crash or blank list | Seen once; manual recheck |
| A7 | Search | Type part of a stop name | List narrows; "N stop(s) found" matches visible cards; clearing restores all | Count mismatch; keyboard hides results | Manual only |
| A8 | No-match search | Type `zzzz` | "Try adjusting your search or filters." | Blank list with no message | Manual only |
| A9 | Filter chips | Tap Gas, Restroom, Open Now, Well Lit (scroll chips) | Each narrows the list; tapping again clears | Chip highlights but list unchanged | Manual only |
| A10 | List ⇄ Map | Tap Map, then List | Apple Maps with your location dot; filters kept when switching | Blank map, crash, filters reset | Partly (tour run) |
| A11 | Map pins | Zoom/pan to a mock stop, tap its pin | Pin visible; tapping opens that stop | Pin missing or opens a different stop | Manual only |
| A12 | Stop detail | Tap a card | Name, address, tags, Directions button, "Community Score" ("Fewer than 3 traveler reviews…"), "Traveler Reviews" empty copy, OpenStreetMap credit | Missing sections, back button dead | Yes (save-stop opens it) |
| A13 | Directions | On detail, tap Directions | Apple Maps opens with the stop as destination | Nothing happens; wrong place | Manual only |
| A14 | Guest save from card | Tap the bookmark on a card | Bookmark fills; **Saved** tab lists the stop with "Keep these stops" sign-in card | Bookmark does nothing; stop missing from Saved | Yes (save-stop) |
| A15 | Unsave | In Explore tap the same bookmark again | Stop disappears from Saved | Stays saved | Manual only |
| A16 | Guest save from detail | On detail tap the bookmark | Sends you to sign in (guests cannot save here) | Silently does nothing | Manual only |
| A17 | Saved tab empty (guest) | Fresh state → Saved | "Saved Stops", "Save stops for later", **Sign in** button | "No saved stops yet" next to an error | Yes (saved-tab) |
| A18 | Safety tab | Tap Safety | "Safety tools aren't built yet", IN DEVELOPMENT pill | Crash | Yes (tab opens) |
| A19 | Journeys tab | Tap Journeys | COMING SOON pill | Crash | Yes (tab opens) |
| A20 | Profile (guest) | Tap Profile | Profile with email sign-in | Crash | Yes (opens) |
| A21 | Sign-in unconfigured | Enter an email → Send code | Readable message, no crash, app keeps working | Hang, red screen, raw error | Manual only |
| A22 | Legal screens | Profile → Privacy, Support, Safety disclosure | Each opens; wording makes no guarantee; support email shows placeholder | Dead link; wording claims a place is safe | Manual only |
| A23 | Relaunch | Force-quit, reopen | Onboarding again (known); guest saves are gone (expected) | Crash on relaunch | Manual only |
| A24 | VoiceOver | Settings ▸ Accessibility ▸ VoiceOver; swipe a card | Card reads as one item; bookmark is a separate "Save stop" / "Remove saved stop" button | Bookmark unreachable | Manual only |
| A25 | Dynamic Type + dark mode | Largest text size; dark appearance | No clipped text on Explore, Detail, Saved, Profile | Truncated or unreadable text | Manual only |

## B. Needs real Supabase (not testable yet)
Prerequisites: founder supplies the anon URL/key in `.env`, and migrations 003, 005, 006, 007 are applied.

| # | Test | Steps | Expected | Failure looks like | Auto |
|---|---|---|---|---|---|
| B1 | Real catalog | Launch with live config | ~44 real stops instead of 6 mock; no "Cedar Falls" mock names | Still 6 stops | No |
| B2 | Email OTP sign-in | Profile → email → code from inbox | Signed in; Profile shows the account | Code never arrives; rate-limit error | Flows exist, not run |
| B3 | Session restore | Sign in, force-quit, reopen | Still signed in | Signed out | No |
| B4 | Saved persists | Sign in → save → relaunch | Saved stop is still there (Saved tab) | Missing after relaunch | Flow exists (saved-persistence), not run |
| B5 | Save failure rollback | Sign in, go offline, tap a bookmark | Bookmark reverts, small error text | Bookmark stays filled though not stored | Logic unit-tested |
| B6 | Write a review | Stop detail → write review | Review appears; score updates after 3+ reviews | Submit fails silently | No |
| B7 | Report / hide review | Review menu → report | Confirmation; review handled per moderation rules | Menu missing | No |
| B8 | Delete account | Profile → Delete account | Account and its saves removed; signed out | Error "not available yet" (needs 007) | No |
| B9 | Cross-user isolation | Sign in as user A and B | Neither sees the other's saved stops | Any leakage | rls:check partial |

## C. Missing or incomplete (prioritized)
1. **Live backend not enabled:** migrations 003/005/006/007, anon key, and real stop catalog. Blocks every B test.
2. **Email delivery for ordinary testers:** custom SMTP (Resend) not set up; only the team can receive codes.
3. **Nationwide ZIP/city discovery:** Explore only filters the loaded catalog (one Indiana corridor ingested).
4. **Safety tab and Journeys tab:** placeholders.
5. **Support email:** still `SUPPORT_EMAIL_PLACEHOLDER` (needed for App Review).
6. **Apple/EAS provisioning:** no EAS project id, no Simulator build profile; real-device install not possible yet.
7. **Onboarding shows on every launch** (no "seen" flag).
8. **Saved load error has no Retry control.**
9. **Sign-in error text can name the backend vendor.**
10. **Onboarding logo emoji renders as a "?" box** on this Simulator runtime.
11. **Sentry** has no DSN/org/project; crash reports unreadable.
12. **Directions and map imagery** need a real-device confirmation.
