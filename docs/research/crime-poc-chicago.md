# Proof of concept: Chicago public incident data near gas stations

> **Status:** research only. This is a local, non-production experiment, not a feature. Area safety
> context is still a **founder positioning decision** (see [`crime-data.md`](crime-data.md)).
> **Run date:** 2026-10-15 · **Scripts:** [`tools/crime-poc/`](../../tools/crime-poc/README.md)
> **Source:** City of Chicago Data Portal, *Crimes - 2001 to Present* (`ijzp-q8t2`), public SODA API,
> unauthenticated. Attribution: Chicago Police Department.
> All numbers below come from that run. **Aggregates only.** No incident rows, addresses, case numbers or
> coordinates appear in this doc.

## TL;DR

- Inside city limits the data is rich enough to *describe* an area. Over 12 months it holds 230,704
  records, 99.8% geocoded, updated daily, with an officer-assigned premise tag that includes
  `GAS STATION`.
- **It can't support a stop-level score or verdict.** Around 93 block-level points where incidents were
  tagged `GAS STATION`:
  - The count "near the station" is mostly the neighbourhood. Only 0.4–7% of records within the radius
    were tagged at the premise itself.
  - The count changes about 17× (median) between 150 m and 800 m.
  - Swapping the radius or window reorders which places look "busiest". Only 5–7 of the top 10 stay in
    the top 10.
  - What's reported *at* a station barely tracks what's reported *around* it (Spearman 0.19).
- **Outside city limits it's "No data for this area".** In the one suburban strip inside our study box,
  78 of 115 grid cells had zero records. That reflects jurisdiction, not low crime. Highway exits and
  rural stops on HerStop's corridors are mostly outside any city portal.
- If anything ships, it must be **counts with context**: category, radius, window, source,
  data-through date and coverage level. No score and no verdict. Copy is in §8.

## 1. What was fetched (polite limits)

| | |
|---|---|
| Window | `2025-10-08` → `2026-10-08` (exclusive). Records present: **2025-10-08 to 2026-10-07** |
| Citywide | 5 server-side **aggregate** queries (count tables) over the window, so no rows were downloaded for these. **230,704** records, **230,679** distinct case numbers |
| Row-level study box | N 41.98 / W −87.84 / S 41.88 / E −87.68, about 11 km × 13 km on the Northwest Side. The west edge goes past Harlem Ave into suburbs that Chicago police don't cover. **45,481 rows** |
| Row-level gas-station set | All records tagged `location_description = 'GAS STATION'` citywide: **2,899 rows** |
| Total | **48,380 rows** (cap 60,000) in **12 HTTP requests**, 1.5 s apart, no key. Raw responses cached in `tools/crime-poc/.cache/` (gitignored, not committed) |

The citywide window holds about 231k rows, roughly 4× the cap. So row-level analysis uses one study
box, and citywide figures come from aggregates.

## 2. Offense categories

**How they're defined.** Each record has an Illinois UCR (`iucr`) code. It's shown as `primary_type`
(31 values in the window) plus a finer `description`, and also carries an `fbi_code`. Records are
**reported incidents** taken from CPD's CLEAR system. In the portal's words, they "may be based upon
preliminary information… that have not been verified", and classifications "may be changed at a later
date". Homicides are one row **per victim**. In the box, all 5 case numbers with more than one row were
homicides.

**Citywide, 12 months (top types):** THEFT 50,705 · BATTERY 42,119 · CRIMINAL DAMAGE 25,550 · ASSAULT
20,744 · MOTOR VEHICLE THEFT 18,222 · OTHER OFFENSE 15,571 · DECEPTIVE PRACTICE 13,329 · BURGLARY
13,288 · NARCOTICS 6,474 · CRIMINAL TRESPASS 5,508 · WEAPONS VIOLATION 4,874 · ROBBERY 4,813 · CRIMINAL
SEXUAL ASSAULT 1,791 · … · HOMICIDE 421.

**Proposed relevance grouping** (a HerStop research proposal in `analyze.mjs`, not an official
taxonomy):

| Group | primary_type / description | Relevant to a stop decision? |
|---|---|---|
| `person` | ROBBERY, BATTERY, ASSAULT, HOMICIDE, CRIMINAL SEXUAL ASSAULT, SEX OFFENSE, KIDNAPPING, STALKING, INTIMIDATION, HUMAN TRAFFICKING (non-domestic) | **Yes**: confrontations with strangers are what a traveller is weighing |
| `vehicle` | MOTOR VEHICLE THEFT; THEFT FROM MOTOR VEHICLE; CRIMINAL DAMAGE TO VEHICLE; BURGLARY FROM MOTOR VEHICLE | **Yes**: a parked or refuelling car |
| `property_other` | other THEFT (incl. RETAIL THEFT), CRIMINAL DAMAGE, BURGLARY, ARSON, CRIMINAL TRESPASS | Weak: often against the business, not a customer |
| `enforcement` | NARCOTICS, WEAPONS VIOLATION, CONCEALED CARRY, PROSTITUTION, LIQUOR LAW, GAMBLING, INTERFERENCE WITH PUBLIC OFFICER, PUBLIC PEACE VIOLATION, … | **No**: mostly measures police activity (stops, arrests), not things that happened to someone |
| `domestic` | any record with `domestic = true` | **No**: between people who know each other |
| `not_location_relevant` | DECEPTIVE PRACTICE (fraud, card skimming), OTHER OFFENSE, OFFENSE INVOLVING CHILDREN | **No**, or too ambiguous |

**Limits.** These are reported incidents only, not all crime. Reporting rates differ by offense, and
sexual offenses and offenses against women are known to be under-reported. Counts reflect patrol
intensity and calls for service. Enforcement categories rise wherever police focus. Historical policing
patterns correlate with neighbourhood race and income (see `crime-data.md` §2.5). Busy stations get
more reports partly because more people pass through, and nothing here is normalised for footfall.

## 3. Time

- **Newest record:** 2026-10-07, which had only **11** records against a typical **~663/day**.
  **Last complete day: 2026-10-06**, which is **9 days** before the run date (2026-10-15). The portal
  describes the dataset as "2001 to present, minus the most recent seven days".
- **Update cadence:** metadata says "Data are updated daily". `rowsUpdatedAt` was 2026-10-15 11:04 UTC,
  and the latest `updated_on` was 2026-10-14.
- **Late fill (unverified):** the last 7 complete days averaged **607/day**, compared with a 36-day
  baseline of **663/day** (about 8% lower). This *may* be reports added late, or ordinary variation.
  Measure it in a pilot by re-fetching the same window a few weeks later.
- **`updated_on` is not a revision signal.** 96.1% of study-box rows share one `updated_on` date
  (2026-10-01), which looks like a bulk re-extract. So the data can't tell us which records were
  reclassified.
- 3.5% of rows have a time of exactly 00:00:00. That is probably a default for an unknown time
  (**unverified**). It distorts hour-of-day analysis.
- The portal says the data "should not be used for comparison purposes over time".

## 4. Geographic precision and coverage

- **Anonymisation:** "addresses are shown at the block level only and specific locations are not
  identified". Coordinates are snapped to the block, so many incidents share one point. In the box,
  45,481 rows sit on **26,040 distinct points**. The busiest single point has **214** rows, and 15.6% of
  rows are on points with 10 or more. One block point can stand for a station, the street in front of
  it, and its neighbours. "Attempts to derive specific addresses are strictly prohibited."
- **Missing coordinates:** **456 of 230,704 (0.2%)** citywide. It's uneven: CRIMINAL SEXUAL ASSAULT
  **8.4%**, SEX OFFENSE 4.1%, OFFENSE INVOLVING CHILDREN 3.0%, HUMAN TRAFFICKING 24% (7 of 29). A radius
  count therefore **systematically undercounts sexual offenses**, which may matter most to HerStop's
  users. Gas-station-tagged rows: 5 of 2,899 missing.
- **Jurisdiction:** Chicago city limits only. The study box was split into 621 cells of 500 m. **123
  cells had zero records**, and **78 of the 115 cells west of Harlem Ave** were empty. That strip is
  mostly suburbs policed by other agencies. The 846 rows west of Harlem come from parts of the city
  that extend there (which parts is **unverified**). Zero means *not covered*, not *quiet*.
- **Edge effects:** 13 of the 93 test places (14%) have an 800 m circle that touches an empty cell.
  Their count would silently mix covered and uncovered ground unless a polygon check labels them
  `partial`.
- **Highways and rural areas:** this dataset has nothing outside the city. Interstate exits, suburbs
  and rural stops on the West Lafayette ↔ Chicago corridor (I-65 / I-94 / I-90 outside the city) would
  all be **No data for this area**. Only 46 citywide records were tagged `HIGHWAY / EXPRESSWAY`.

## 5. `location_description`: at the premise vs nearby

- The field is a fixed list chosen by the reporting officer. It has 121 distinct values in the window,
  plus 1,115 blank. It records the **premise type**, never the business name. It's incomplete: an
  incident on the forecourt can be tagged `STREET`, `PARKING LOT / GARAGE (NON RESIDENTIAL)`,
  `SIDEWALK`, `VEHICLE NON-COMMERCIAL` or `CONVENIENCE STORE`. **So this tag is incomplete; it can't
  confirm that an incident happened at a particular station.**
- **`GAS STATION`: 2,899 records (1.3% of all)** citywide. Other travel-adjacent premises: PARKING LOT /
  GARAGE (NON RESIDENTIAL) 8,300 · CONVENIENCE STORE 1,646 · AIRPORT PARKING LOT 159 · HIGHWAY /
  EXPRESSWAY 46.
- **What gets tagged `GAS STATION`** (citywide, 12 mo, by our grouping): `person` 948 (32.7%) ·
  `property_other` 891 (30.7%) · `enforcement` 338 (11.7%) · `not_location_relevant` 293 (10.1%) ·
  `vehicle` 283 (9.8%) · `domestic` 146 (5.0%). Only **1,231 (42.5%)** fall in the traveller-relevant
  groups. Top descriptions: ASSAULT SIMPLE 257, BATTERY SIMPLE 228, CRIMINAL TRESPASS TO LAND 201, RETAIL
  THEFT 166, CRIMINAL DAMAGE TO PROPERTY 158, THEFT $500 AND UNDER 137, WEAPONS VIOLATION UNLAWFUL
  POSSESSION – HANDGUN 135 (enforcement), MOTOR VEHICLE THEFT AUTOMOBILE 115, ROBBERY ARMED – HANDGUN 90.
- **Time of day:** 42.4% of gas-station-tagged records fall between 21:00 and 06:00. That window is
  37.5% of the hours, and the share is inflated by default-midnight times. So it's mildly skewed to
  night, but it isn't normalised for how many people are at stations at night.

## 6. Stop-level feasibility test (no invented locations)

**Method.** In the study box, 467 records were tagged `GAS STATION`. They sit on **148** distinct block
points, which we merged within 50 m into **122 places**. We kept the **93** places whose 800 m circle
lies fully inside the downloaded box. These places come from the data. They are **not verified station
locations**: one point can hold two stations, or a mis-tag. Stations with no tagged incident are
invisible to this method, which is a selection bias. For each place we counted every geocoded record
within 150 / 400 / 800 m over the last 90 and 365 days. The windows end at the newest record.

**Distribution of the count of *all* records (n = 93 places):**

| Radius / window | min | p10 | median | p90 | max | share tagged at the premise |
|---|---|---|---|---|---|---|
| 150 m / 90 d | 2 | 5 | 13 | 38 | 57 | 7.2% |
| 150 m / 365 d | 6 | 20 | 48 | 118 | 207 | 5.9% |
| 400 m / 90 d | 13 | 28 | 59 | 129 | 189 | 1.8% |
| 400 m / 365 d | 56 | 121 | 233 | 479 | 724 | 1.3% |
| 800 m / 90 d | 62 | 117 | 221 | 426 | 544 | 0.5% |
| 800 m / 365 d | 229 | 479 | 843 | 1,586 | 2,140 | 0.4% |

**Traveller-relevant only (`person` + `vehicle`):** 150 m/90 d median 6 (0–24) · 400 m/90 d median 25
(4–74) · 800 m/365 d median 361 (88–768). Records tagged at the premise itself: 150 m / 365 d median
**2** (1–19).

**What this shows:**

1. **The neighbourhood dominates.** Even at 150 m, about 93% of counted records weren't tagged at the
   station. At 400 m it's 98.7%, and at 800 m it's 99.6%. A "count near this station" is a count of the
   neighbourhood.
2. **The radius changes everything.** For the same place, the 800 m count is a median **17.2×** the
   150 m count. That ratio ranged from 6.6× to 163× across places. Pick a radius and you've picked the
   answer.
3. **Rankings aren't stable.** Spearman correlation between 150 m and 800 m (365 d) is **0.71**. Of the
   10 places with the most records at 150 m, only **6** are in the top 10 at 800 m. Comparing 150 m/90 d
   with 800 m/365 d gives 7 of 10, and **5 of 10** for traveller-relevant counts. The window matters
   less (150 m: 90 d vs 365 d, ρ = 0.92), but 90-day counts at small radii are tiny: **17 of 93
   places** had fewer than 3 traveller-relevant records at 150 m / 90 d.
4. **Premise and neighbourhood tell different stories.** The correlation between records tagged *at*
   the station (365 d) and records *around* it (400 m, excluding the station) is only **ρ = 0.19**.
5. **So a score would mislead.** Any single number would mostly encode the analyst's choice of
   radius/window plus neighbourhood reporting intensity. It would carry the bias in §2 and the coverage
   gaps in §4. Put next to a stop, it would read as a judgment of that business, which the data can't
   support.

## 7. Missing, ambiguous and unsupported cases

| Case | What we saw | Required behaviour |
|---|---|---|
| No coordinates | 0.2% overall. Up to 8.4% for sexual-assault records | Disclose "Some offense types, including sexual offenses, are often not mapped and are undercounted" |
| Duplicates | 0 duplicate row ids. Multi-row cases are homicides (one row per victim) | Count rows as incidents-per-victim. Note it in About this data |
| Outside city limits | 78 of 115 suburban cells empty | **"No data for this area"**. Never 0, never "low", never lighter styling |
| Circle crosses the city boundary | 13 of 93 places (800 m) | `partial` coverage label. Ideally clip the circle to the city polygon (not done in this PoC) |
| Small numbers | 17 of 93 places had fewer than 3 relevant records at 150 m / 90 d | Show "fewer than 3". Prefer ≥ 400 m and ≥ 90 d |
| Recent days | Last day partial (11 rows). Last week possibly low | Data-through date = last complete day, minus a buffer |
| Reclassification | `updated_on` unusable (96% share one date) | Recompute the whole window on every refresh, never append-only |
| Sparse areas | 21 non-empty cells had fewer than 10 records in 12 months | Low counts aren't evidence of low crime. Show the coverage level, not reassurance |

**What the data can't say:** whether an incident happened on a given station's lot, or which business it
involved. It can't say anything about crime that wasn't reported, how well lit or staffed a place is,
or what it's like tonight. It can't tell you anything outside Chicago, compare places fairly
(footfall, policing), or show trends over time (the portal disclaims this). It isn't a verdict about
any place.

## 8. Proposed explainable record and copy

This uses the `AreaIncidentSummary` shape from [`crime-data.md` §3.2](crime-data.md), with these fields
confirmed by the PoC. **Illustrative values below are real counts from the median test place in this
run.** The place is a block-level point with gas-station-tagged records, not a named station, and it
must not be presented as one.

```jsonc
// proposal only — illustrative, real counts from the 2026-10-15 run; not a real HerStop stop
{
  "stopId": "<HerStop stop id>",
  "radiusMeters": 400,
  "windowDays": 90,
  "coverage": "incident_level",            // or partial | aggregate_only | stale | no_data
  "counts": [                               // records whose block point is within the radius
    { "category": "person",         "count": 15 },
    { "category": "vehicle",        "count": 9 },
    { "category": "property_other", "count": 18 }
  ],
  "excludedFromCounts": ["enforcement (3)", "domestic (12)", "fraud/other (2)"],
  "taggedAtPremiseType": { "premise": "GAS STATION", "count": 0, "note": "officer-assigned premise type; incomplete" },
  "source": { "name": "Chicago Police Department via City of Chicago Data Portal", "dataset": "ijzp-q8t2",
              "terms": "https://www.chicago.gov/city/en/narr/foia/data_disclaimer.html" },
  "dataThrough": "2026-10-06",
  "computedAt": "2026-10-15",
  "caveats": ["block-level locations", "reported incidents only", "about a 1–2 week lag",
              "some offense types often unmapped", "not comparable between places"]
}
```

No score, rank, colour or label is derived from it, and it never feeds `lib/scoring.ts`.

**User-facing copy (complies with `product-boundaries.md`):**

> **Area context** · Reported incidents within 400 m (¼ mi) · last 90 days
> 15 involving a person · 9 vehicle-related · 18 other property
> Source: Chicago Police Department, City of Chicago Data Portal · Data through Oct 6, 2026
> These are police reports for the surrounding blocks, not this business. Locations are approximate
> (block level), and not all incidents are reported. [About this data]

Small counts:
> Fewer than 3 vehicle-related reports in this area in the last 90 days.

No coverage:
> **Area context** · No data for this area. This stop is outside the areas covered by our public data
> sources. That doesn't mean fewer incidents happen here. See recent traveler feedback above.

Partial coverage:
> **Area context** · Partial data. Part of this area is outside Chicago city limits, so these counts
> include only the part inside the city.

**Must be disclosed (About this data):** block-level precision, so counts are for the surrounding area
and not the business. Reported incidents only, with known under-reporting, especially of sexual
offenses, some of which aren't mapped. Reflects policing and calls for service, not normalised for
traffic. About a 1–2 week reporting lag; classifications may change. Excluded categories (enforcement,
domestic, fraud). Source and terms link. Not for comparing places or trends over time.

**Never:** a counts badge on the stop card or pin, red/green colouring, ranking stations by count, a
"premise-tagged" count presented as "at Shell", or any word implying the place is or isn't safe.

## 9. Verdict

- **Chicago (inside city limits): adequate for *area context*, not for stop-level judgment.** The data
  is fresh (about 9 days), almost fully geocoded and openly accessible. Fixed-radius category counts
  with honest caveats are technically feasible. They describe the **neighbourhood**, and the premise tag
  is too sparse and incomplete (median 2 tagged records per place per year) to say anything specific
  about a station.
- **Highways, suburbs and rural areas: not adequate.** The dataset doesn't cover them. HerStop's core
  case (a woman driving alone, stopping off the interstate) is mostly outside city portals, so most of
  the corridor would show "No data for this area". A city-only feature risks implying that uncovered
  stops are better.
- **Before any pilot:**
  1. **Licence check.** The dataset licence is "See Terms of Use". The City's terms page is
     <https://www.chicago.gov/city/en/narr/foia/data_disclaimer.html> (HTTP 200, accessed 2026-10-15;
     **its contents weren't reviewed in this PoC**). Confirm in writing whether redistribution of
     derived counts in a commercial app is allowed, along with attribution and the "Chicago Police
     Department" name-use restriction in the dataset description.
  2. A city-boundary polygon to clip circles and assign `partial` / `no_data` properly.
  3. Real station locations from HerStop's own `stops` table, not incident tags.
  4. A late-fill and reclassification study (re-fetch the same window after 2–4 weeks).
  5. A founder positioning decision and a copy review (`product-boundaries.md`).
  6. Server-side computation with no raw rows stored, an app token for the SODA API if volume grows,
     and a coverage map for every corridor before claiming any coverage.

## 10. Unverified / not done

- The contents of the City's terms page (only its URL was checked).
- The cause of the slightly lower last-week counts (late fill vs variation).
- Whether 00:00 times are a default for an unknown time.
- Which city areas account for the 846 rows west of Harlem Ave.
- The empty-cell coverage check is a proxy. A 500 m cell can be empty because it's a park, cemetery or
  rail yard inside the city. No city boundary polygon was used.
- Only one study box (Northwest Side) was analysed row by row. Other parts of the city may differ in
  scale. The method's conclusions (radius sensitivity, neighbourhood dominance) are structural and
  expected to hold, but the specific numbers won't transfer.
