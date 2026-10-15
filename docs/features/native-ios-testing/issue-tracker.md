# HerStop — founder test results: issue tracker (sprint 1)

Source: founder manual testing of `manual-test-plan.md` (A1–A25), 2026-10-15.
Integration branch: `paseo/sprint-1`. "Verified" = watched or asserted on the native app in the
iPhone 17 Pro Simulator (Maestro or screenshot) against the integrated bundle.

| ID | Pri | Test(s) | Founder observation | Root cause | Fix | Verification |
|---|---|---|---|---|---|---|
| I1 | P0 | A2, A7, A8 | Search showed no keyboard; did not feel editable | **Not reproduced.** The field is a real `TextInput`; on the native build it focuses, shows the soft keyboard, types and filters. Most likely the Simulator's *Connect Hardware Keyboard* setting (hides the soft keyboard; Cmd+K toggles). Real defect found and fixed: controls remounted when switching List/Map, and chip taps dismissed the keyboard | Controls stay mounted; chip/clear taps keep the keyboard; clear restores focus; testIDs `explore-search-input`, `explore-search-clear`, `filter-chip-<label>` | Verified: type "Atlas" → "1 stop found"; clear; "zzzz" → "No matching stops" message preserved |
| I2 | P0 | A13 | Directions opened "696 S Lincoln Ave" instead of 1420 Willow Creek Rd | **Mock-data inconsistency, not a routing bug.** The stop's stored coordinates (40.5642, −74.2891) reverse-geocode to a real address in New Jersey; the displayed address is fictional. The app navigated to the selected stop's own coordinates. Old URL (`&q=name`) and new URL give the *identical* destination (both screenshotted) | URL simplified to `daddr=<lat,lng>&dirflg=d` (no competing search term; Google fallback same destination); mock data documented as fictional with a test that coordinates are valid | Verified: Apple Maps pin in NJ, label "696 S Lincoln Ave", 770 mi route. **Open:** decide how mock stops should present (see below) |
| I3 | P1 | A14–A16 | Guest save did not work as expected | Detail-screen bookmark redirected guests to Profile; card bookmark saved locally. Maestro only exercised the card | Guests save/unsave locally from both entry points; persistence still requires sign-in; detail bookmark disabled only while a saved list is loading | Verified: detail save → "Remove saved stop" → Saved shows "1 stop saved" + "Keep these stops" → unsave from Saved card reverses |
| I4 | P1 | A22 | Legal screens' back button appeared dead | **Not reproduced.** Back works by accessibility tap and by raw coordinate tap on Privacy, Support, Safety Disclosure. Hypothesis: double-tapping a link stacks two identical pages, so the first Back looks inert | `dangerouslySingular` routes for legal and stop-detail; explicit Back control at the end of each legal page with Profile fallback | Verified: header back (coordinates) returns to Profile for Privacy and Support; Back control on Safety Disclosure |
| I5 | P1 | A9 | Gas = 3, Gas + Restroom = 4 | OR semantics (`categories.some`) | AND semantics via shared `filterStops()`; List and Map use the same list; count shown whenever search/filter active | Verified: Gas 3 → +Restroom 2 → +Open Now 1, identical in Map view |
| I6 | P2 | A5, A6 | Location-unavailable messages missing | No loading state; only two failure variants; raw native error logged | Explicit loading / granted / denied / unavailable messages; "Sorted by distance" only with coordinates; raw error no longer logged | Granted verified on device. **Denied/unavailable verified by unit tests only** — this Simulator keeps granting location (`simctl privacy revoke/reset` did not produce a denial) |

## Open decisions for the founder
1. **Mock stops and Directions (I2).** Options: (a) label detail screens "Demo stop — location is a placeholder" and keep
   Directions; (b) disable Directions for mock data; (c) leave as is until the real catalog replaces mock data. Real
   catalog rows come from one source for address and coordinates, so the mismatch disappears with migrations 005/006.
2. **Hardware keyboard (I1).** If the keyboard still does not appear on your machine after toggling
   I/O ▸ Keyboard ▸ *Connect Hardware Keyboard* off, send the exact steps and I will reproduce them.
3. **Saved guest list on sign-in.** Guest in-memory saves are not merged into the account after sign-in. Decide whether they should be.

## Not changed on purpose
- No visual redesign. Small interaction/accessibility fixes only.
- Real-data features (autocomplete, photos, crime data) are research-only; see `docs/research/`.
