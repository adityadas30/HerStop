# HerStop — native iOS feature-testing checklist

Branch `paseo/stabilize`, base `b772608`. Written 2026-10-15.

**How to read the status column.** A feature is only "Verified" if someone watched it work in
the native Debug app on the Simulator (screenshot or Maestro run). Code existing, or `tsc`/Jest
passing, is **not** verification. Anything not run is "Not verified".

| Status | Meaning |
|---|---|
| **Verified (mock)** | Watched working in the native app, Supabase unconfigured (mock data). |
| **Unit-tested** | Pure logic has Jest tests; the screen behaviour was not watched. |
| **Needs live Supabase** | Cannot be exercised until the founder supplies the anon URL/key and applies migrations. |
| **Not implemented** | The screen is a placeholder or the feature does not exist. |
| **Not verified** | Code exists, nobody has run it end to end yet. |

## 0. Test setup (once)
1. `cd apps/mobile && npm ci`
2. Simulator booted; set a location: `xcrun simctl location <udid> set 40.4237,-86.9212`
3. Grant location: `xcrun simctl privacy <udid> grant location com.adityadas.herstop`
4. `npm run ios:build` (native Debug build + install), then `npm run ios` (one Metro on :8081)
5. Mock mode = no `apps/mobile/.env`. Live mode = copy `.env.example`, fill the public URL and anon key only.

## 1. Verified in mock mode (watched in the native app)
| Feature | Evidence |
|---|---|
| App launches as `com.adityadas.herstop`, not Expo Go | Screenshot + `launchctl` showed only HerStop running |
| Onboarding → "Get Started" → Explore | `smoke.yaml`, `saved-tab.yaml`, `save-stop.yaml` pass |
| Explore list renders mock stops, labelled Limited Data | Screenshot `08-explore-located.png` |
| List / Map toggle; Apple Maps renders with location dot | Screenshot `t3-explore-map.png` |
| Location granted → "Sorted by distance from you" | Screenshot `08-explore-located.png` |
| Stop detail opens; shows Community Score / Traveler Reviews empty copy | Screenshot `t4-stop-detail.png` |
| Tab navigation: Explore, Safety, Journeys, Saved, Profile | `smoke.yaml` |
| Guest save from card bookmark → appears on Saved tab with sign-in invitation | `save-stop.yaml` |
| Mock-mode diagnostics only in dev logs; no crash when unconfigured | Metro log |
| No banned safety-claim copy on the screens visited | `assertNotVisible` in 3 flows |

## 2. Needs live Supabase (do not test until backend is enabled)
| Feature | Prerequisite |
|---|---|
| Real stop data (44 stops) and scoring from real reviews | Migrations 003, 005, 006 applied |
| Email OTP sign-in + session restore across relaunch | Auth settings + SMTP (Resend) for non-team testers |
| Authenticated saved stops persist across relaunch | `saved-persistence.yaml` + migration 002 |
| Write / edit / delete a review | Migration 003 |
| Report / hide a review (moderation) | Migration 003 |
| Delete account | Migration 007 |

## 3. Not implemented
| Feature | Current state |
|---|---|
| Safety tab | Placeholder: "Safety tools aren't built yet" |
| Journeys tab / Journey Shield | Placeholder, "Coming soon" |
| Nationwide ZIP / city discovery | Explore only filters the loaded catalog; ingestion covers one Indiana corridor |
| "Onboarding seen" memory | Onboarding shows on every launch |

## 4. Ready for your manual testing (mock mode)
Run these by hand and tell me what is wrong. Each step lists what a pass looks like.

### Startup and navigation
- [ ] Cold launch lands on onboarding, not an error screen
- [ ] "Get Started" goes to Explore; every tab opens and returns
- [ ] Force-quit and relaunch works; Metro-disconnected launch shows a clear failure, not a blank screen

### Explore, search, filters
- [ ] Search box filters by name/address; clearing restores the list
- [ ] Gas / Restroom / Open Now / Well Lit chips narrow the list; "Try adjusting your search or filters." shows when nothing matches
- [ ] Result count text matches the visible cards

### Location
- [ ] Permission allowed: cards show distance; header says sorted by distance
- [ ] Permission denied (`simctl privacy <udid> revoke location com.adityadas.herstop`): "Turn on location to sort by distance"
- [ ] No Simulator location set: "Couldn't get your location…" note, list still usable

### Map
- [ ] Map shows the user dot and mock stop pins when zoomed to them; tapping a pin opens the stop
- [ ] Switching List ⇄ Map keeps filters

### Stop details and directions
- [ ] Detail shows name, address, tags, Community Score text, OpenStreetMap attribution
- [ ] "Directions" opens Apple Maps with the stop as destination (check on a real device too; Simulator Maps is limited)
- [ ] Stops without usable coordinates hide the Directions button

### Guest saved stops
- [ ] Bookmark on a card and on the detail screen (detail bookmark prompts sign-in for guests — confirm wording)
- [ ] Saved tab lists the stop; un-bookmarking removes it
- [ ] Relaunch: guest saves are gone (expected; session-only)

### Accessibility
- [ ] VoiceOver: the card is one element and the bookmark is a separate button labelled "Save stop" / "Remove saved stop"
- [ ] Dynamic Type at the largest size: nothing clipped on Explore and Stop detail
- [ ] Dark mode: text readable on Explore, Detail, Saved, Profile

### Error handling (mock / unconfigured)
- [ ] Profile → request sign-in code with no backend shows a readable message, no crash
- [ ] Saved tab with a load error shows the error and **not** "No saved stops yet" (covered by unit tests; confirm visually once live)

### Profile and legal
- [ ] Privacy, Support and Safety-disclosure screens open and the copy makes no safety guarantee
- [ ] Support email is still the placeholder `SUPPORT_EMAIL_PLACEHOLDER` (known blocker)

## 5. Known open issues (not fixed here)
- Onboarding logo `📍` renders as a "?" box on this Simulator runtime.
- Sign-in error text can name the backend vendor; a neutral message would be better.
- Saved-stop load errors have no retry control.
- Simulator Maps imagery/POIs differ from a device; confirm on hardware before release.
