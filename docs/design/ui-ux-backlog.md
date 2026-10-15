# UI/UX design backlog (from founder manual testing)

> **This is a backlog, NOT a redesign.** The full visual redesign is **deferred until functionality is
> stable** (search, live stops, saved stops, reviews). Items here are scoped, independent fixes and
> directions. Each one still goes through the normal spec → build → `ios-verify` (Level 2 Simulator
> screenshot) loop.
>
> **Date:** 2026-10-15 · Source: founder manual testing on the iOS 26.3 Simulator plus a read of the current
> code at `077f1fc`. Observations marked *(code read)* come from the source, not a screenshot. Re-confirm them
> on the Simulator before building.

Effort: **S** ≤ half a day · **M** 1–3 days · **L** > 3 days or needs a spec/native work.
Priority: **P0** broken/misleading · **P1** core-experience quality · **P2** polish.

## Summary

| # | Item | Group | Pri | Effort | Depends on |
|---|---|---|---|---|---|
| 1 | Logo renders as "?" box | Onboarding | P0 | S | — |
| 2 | Onboarding copy claims reviews are "by women" | Onboarding | P1 | S | founder decision |
| 3 | Editable search with suggestions | Explore search | P1 | L | search-autocomplete.md |
| 4 | Recent searches | Explore search | P2 | S | search-autocomplete.md §4.3 |
| 5 | Search-area / radius feedback | Explore search | P1 | S | search-autocomplete.md |
| 6 | Repetitive "Limited Data" + "No reviews yet" on cards | Stop card | P1 | S | — |
| 7 | Card image placeholder | Stop card | P1 | S | business-photos.md §2.9 |
| 8 | Photo gallery on stop detail | Photos | P2 | M | business-photos.md |
| 9 | Area-context (reported incidents) section | Crime data | P2 | M | crime-data.md + founder go/no-go |
| 10 | Typography & spacing scale consistency | Visual | P2 | M | — |
| 11 | Dark-mode contrast audit | Appearance | P1 | S | — |
| 12 | VoiceOver labels & order | Accessibility | P1 | M | — |
| 13 | Dynamic Type support | Accessibility | P1 | M | — |
| 14 | Empty / error state consistency | States | P1 | S | — |

---

## A. Onboarding and logo

### 1. Logo glyph renders as a "?" box (P0 · S)
- **Observation:** On the iOS 26.3 Simulator the onboarding logo shows a missing-glyph "?" box. *(code
  read)* `app/onboarding.tsx:20` renders the emoji `📍` inside a `<Text>` with a custom style. The emoji
  font fallback seems to fail in this Simulator/runtime. Exact cause **unconfirmed** (font family override on
  `styles.logo`, or a Simulator emoji-font issue).
- **Why it matters:** The first screen a new user sees looks broken, and that undercuts trust right away.
- **Direction:** Replace the emoji with the existing `IconSymbol` (`components/ui/icon-symbol.tsx`,
  `expo-symbols` already installed), e.g. SF Symbol `mappin.and.ellipse` or `fuelpump.circle.fill` in
  `colors.tint`. Longer term, a real brand mark as a PNG/SVG asset in `assets/images/` (also used for the app
  icon). Don't use emoji for brand UI anywhere.
- **Verify:** Simulator screenshot in light and dark mode.
- **Dependency:** none.

### 2. Onboarding copy: "reviewed by women, for women driving alone" (P1 · S)
- **Observation:** *(code read)* `app/onboarding.tsx` body copy. The app doesn't collect or verify reviewer
  gender, so "reviewed by women" is a claim we can't currently back up (never fabricate users/reviews).
- **Why it matters:** product-boundaries.md and trust. If a reviewer turns out not to be a woman, the
  promise breaks.
- **Direction:** Something like "Discover gas stations and rest stops along your route, with recent
  traveler feedback from women who drive alone." Wording is a **founder decision** (product positioning).
- **Dependency:** founder.

## B. Explore search experience

### 3. Editable search with live suggestions (P1 · L)
- **Observation:** Search only filters the loaded stops by name/address. Typing a city or ZIP (`47906`,
  `West Lafayette`) finds nothing unless a stop's address happens to contain it.
- **Why it matters:** Searching by place is the main way users explore a trip ahead of time.
- **Direction:** Keep the field always editable, with a clear (×) button. Show a suggestion list *under* the
  field (title + subtitle, SF Symbol per type: `mappin` address, `building.2` city, `number` ZIP). Picking
  one re-centers the map and refetches stops near it. Show the active place as the field's value, plus a
  small "Near {label}" line above results. Keyboard: `returnKeyType="search"`, dismiss on scroll.
- **Dependency:** `docs/research/search-autocomplete.md` (MapKit local module + Census fallback + `stops_near` RPC).

### 4. Recent searches (P2 · S)
- **Direction:** On focus with an empty field, show up to 5 recent places stored **on device only**, with
  "Clear". No server storage.
- **Dependency:** search-autocomplete.md §4.3 (Apple storage terms, UNVERIFIED).

### 5. Search-area and radius feedback (P1 · S)
- **Direction:** A "Search this area" pill appears after the map pans. Results header: "12 stops within
  10 mi of West Lafayette". Empty: "No stops in our data within 10 mi yet" + "Expand to 25 mi".
- **Dependency:** search-autocomplete.md §4.4.

## C. Stop card visual hierarchy

### 6. Repeated "Limited Data" + "No reviews yet" (P1 · S)
- **Observation:** *(code read)* `StopCard` always renders `ScoreBadge` (which says **Limited Data** when
  there's no score) **and** `reviewCountLabel(...)` ("No reviews yet"). With few reviews in the catalog,
  every card repeats the same two "nothing here" messages. That's visual noise, and it makes the list look
  empty.
- **Why it matters:** The card should lead with what we *do* know (name, distance, amenities). Absence
  should be stated once, quietly.
- **Direction:** When `review_count === 0`, show a single muted line, "No traveler reviews yet", and
  **hide the badge** (or show a neutral outline badge without the color fill). Keep the **Limited Data**
  badge for 1–2 reviews, where the label adds information ("2 reviews · Limited Data"). Never show a count
  or score we don't have, and never imply a stop is better or worse because data is missing. On the detail
  screen, keep the full explanation ("Not enough recent traveler feedback to show a label").
- **Dependency:** none (`lib/scoring.ts` unchanged, presentation only).

### 7. Card image placeholder (P1 · S)
- **Observation:** *(code read)* Cards show a flat `imageColor` block with a 30%-white `photo.fill`. It reads
  as "image failed to load".
- **Direction:** Category glyph (`fuelpump.fill` / `toilet.fill`) on a theme tint (`tintLight`, dark
  equivalent), optional brand name text. No stock photos.
- **Dependency:** business-photos.md §2.9.

## D. Photo galleries

### 8. Stop detail photo gallery (P2 · M)
- **Direction:** Horizontal pager at the top of the stop detail, only when approved licensed photos exist.
  Attribution caption on every image ("Photo: {author}, {license}, via {source}"). Tap opens full screen
  with complete attribution. Street-level imagery is labeled "Street-level view". No gallery chrome at all
  when there are zero photos.
- **Dependency:** business-photos.md (`stop_photos` table, phases 1–2).

## E. Crime-data presentation

### 9. "Area context" section (P2 · M), only if the founder approves
- **Direction:** Collapsed section on the stop **detail** screen only, below traveler feedback. Counts by
  broad category with radius, window, source and "data through". "No data for this area" when there's no
  coverage. Neutral typography, **no red/green, no danger icons, nothing on cards or pins, no score.**
- **Dependency:** crime-data.md §3 + founder go/no-go (positioning).

## F. Typography, spacing, consistency

### 10. Type & spacing scale (P2 · M)
- **Observation:** The founder noted inconsistent sizes/spacing between Explore, Saved and detail. Specifics
  weren't captured. `constants/theme.ts` exports `Typography`, `Spacing` and `Radius`, but some screens
  likely use ad-hoc values *(unconfirmed, needs a grep audit)*.
- **Direction:** Audit for hardcoded font sizes/margins and map them to theme tokens. Align titles with
  iOS text styles (Large Title / Headline / Body / Footnote). This is token hygiene, not a restyle.
- **Dependency:** none. Keep separate from the deferred redesign.

## G. Light / dark mode

### 11. Dark-mode contrast audit (P1 · S)
- **Observation:** `app.json` sets `"userInterfaceStyle": "automatic"`, so the app follows system
  appearance. Dark accent `#C9A5A6` and `tintLight` `#3D2829` *(code read, `constants/theme.ts`)* need
  checking against WCAG AA (4.5:1 body text, 3:1 large text/UI). So does `secondaryText` on `card` in both
  modes. Also the hardcoded `rgba(255,255,255,0.3)` placeholder icon.
- **Direction:** Screenshot every tab in both modes (Simulator: Settings → Developer → Dark Appearance, or
  `xcrun simctl ui booted appearance dark`). Measure contrast and adjust tokens only.
- **Dependency:** none.

## H. Accessibility

### 12. VoiceOver (P1 · M)
- **Observation:** *(code read)* Only about 6 `accessibilityLabel`/`accessibilityRole` usages across
  `app/` + `components/`. The bookmark was deliberately moved outside the card for VoiceOver (good). Chips,
  the List/Map toggle state, badges and the map pins need labels/states.
- **Direction:** Card label = "{name}, {label or 'no traveler reviews yet'}, {distance}". Chips get
  `accessibilityState={{ selected }}`. The toggle is a segmented control with `selected`. Decorative icons
  are hidden. Test with VoiceOver on the Simulator (Accessibility Inspector).
- **Dependency:** none. Also improves Maestro selectors (testing-rules.md).

### 13. Dynamic Type (P1 · M)
- **Direction:** Check at the largest accessibility sizes. Make sure cards wrap rather than truncate
  critical info (name, label), and tags wrap. Avoid fixed heights on text containers. Don't set
  `allowFontScaling={false}`.
- **Dependency:** none.

## I. Empty and error states

### 14. Consistent empty / error states (P1 · S)
- **Observation:** Commit `2a41c18` fixed Saved showing "No saved stops yet" next to a load error. Apply the
  same rule everywhere (Explore, stop detail reviews, search).
- **Direction:** One small `StateMessage` component (icon + title + body + optional action) for: loading,
  empty (no data), error (retry), offline, and signed-out-gated. Error never coexists with empty. Copy
  describes data availability ("No stops in our data here yet"), never area quality.
- **Dependency:** search-autocomplete.md §4.4 for search-specific copy.

---

## Deferred (full redesign, after functionality is stable)
- Brand identity (logo mark, app icon, color refinement), map pin styling, motion, onboarding illustration,
  Journeys/Safety "Coming Soon" screens. Revisit once search, live stops, reviews and saved stops are
  verified end-to-end.
