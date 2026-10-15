# Research: Reported-crime context near stops (feasibility)

> **Status:** research only. Area safety data was **cut** from the current sprint (STATUS.md, 2026-09-10).
> Building any of this is a **product-positioning decision for the founder**.
> **Date:** 2026-10-15 · All URLs accessed 2026-10-15. Prices **as of 2026-10-15, verify before purchase**.
> Claims not confirmed from a primary source are marked **UNVERIFIED**.

## 1. Principles (non-negotiable, from product-boundaries.md)

1. **No single rating, score, grade, color-coded "risk level" or verdict** derived from crime data. We
   show counts with context and nothing more.
2. **Never attribute incidents to the business.** Incidents are "reported in the area within X mi", never
   "at Shell". Even where a dataset has a premise type like `GAS STATION` (Chicago) or a `LocationName`
   (Indianapolis), we **don't** surface it per business.
3. **Missing coverage = "No data for this area".** It's never "low crime", never zero, never a lighter
   color.
4. Always show **source, time window, radius, last updated, coverage level**.
5. This is **area context** that sits beside traveler feedback. It never feeds `lib/scoring.ts` or the
   Recommended / Good Option labels.

## 2. Data sources compared

### 2.1 FBI Crime Data Explorer (CDE) API

| | Finding |
|---|---|
| Granularity | **Agency-level aggregates** (counts by offense for a reporting agency per period), not incident points. Third-party docs say the public API returns aggregated counts and incident-level NIBRS data is in bulk files ([apify listing](https://apify.com/muhammadafzal/fbi-crime-data-scraper), secondary). **API granularity: UNVERIFIED from FBI docs.** |
| Coverage | 2024: data from **86.3% of law-enforcement agencies, covering 95.6% of the population** ([FBI RCN 2024 FAQ](https://cde.ucr.cjis.gov/LATEST/resources/reports/Reported%20Crimes%20in%20the%20Nation%202024%20FAQs.pdf)). Press coverage says about 75% of participating agencies submitted via NIBRS, covering 87% of the population ([Alabama Reflector, 2025-08-11](https://alabamareflector.com/2025/08/11/us-crime-rates-fell-nationwide-in-2024-fbi-report-says/), secondary, **UNVERIFIED** against FBI). |
| Gaps | Non-reporting agencies, partial-year reporters, and the mismatch between agency jurisdiction and a highway exit (state police / sheriff vs city PD). |
| Access / limits | Free api.data.gov key. Default **1,000 requests/hour**. `DEMO_KEY` 30/hour, 50/day per IP ([api.data.gov manual](https://api.data.gov/docs/developer-manual/)). Base path `api.usa.gov/crime/fbi/cde` vs legacy `/sapi`: **UNVERIFIED** ([fbi-cde frontend repo](https://github.com/fbi-cde/crime-data-frontend)). |
| Lag | Annual national release (2024 data published Aug 2025). CDE also publishes some monthly data (**UNVERIFIED**). |
| License | US federal government data, generally public domain (**UNVERIFIED** for CDE specifically). |
| Fit | ⚠️ Usable only as **jurisdiction-level** context ("Tippecanoe County Sheriff reported N offenses in 2024"). Not near-a-stop. |

### 2.2 City / police open-data portals (Socrata, ArcGIS)

| Jurisdiction | Dataset & fields | Location precision | Freshness | Terms |
|---|---|---|---|---|
| **Chicago** | "Crimes - 2001 to Present" (Socrata `ijzp-q8t2`). Fields: `date`, `block`, `iucr`, `primary_type`, `description`, `location_description`, `arrest`, `domestic`, `beat`, `district`, `fbi_code`, `latitude`, `longitude`, `updated_on` | "addresses are shown at the **block level** only". "attempts to derive specific addresses are strictly prohibited" | Updated daily, minus the most recent **7 days** | License "See Terms of Use". Data "should not be used for comparison purposes over time". Classifications preliminary. ([portal metadata API](https://data.cityofchicago.org/api/views/ijzp-q8t2.json)) |
| **New York City** | "NYPD Complaint Data Current (Year To Date)" (`5uac-w243`). Fields include `cmplnt_fr_dt`, `ofns_desc`, `law_cat_cd` (felony/misdemeanor/violation), `prem_typ_desc`, `latitude`, `longitude` | Precision/obfuscation rules are in the data dictionary attachment: **UNVERIFIED** (historic records may have 0,0 coordinates, [UWM metadata](https://geodiscovery.uwm.edu/catalog/sde-columbia-nypd_complaint_2019/metadata)) | "all complete quarters so far this year" (**quarterly lag**) ([metadata API](https://data.cityofnewyork.us/api/views/5uac-w243.json)) | NYC Open Data terms: **UNVERIFIED** |
| **Los Angeles** | Legacy "Crime Data from 2020 to Present" is **frozen** after LAPD's records-system change (go-live 2024-03-07). New NIBRS **Offenses** and **Victims** datasets since Oct 2024, refreshed **bi-weekly** ([data.gov listing](https://catalog.data.gov/dataset/crime-data-from-2020-to-present)) | Block-level/rounded (**UNVERIFIED** for the new datasets) | Bi-weekly | **UNVERIFIED** |
| **Indianapolis (IMPD)** | ArcGIS `gis.indy.gov/server/rest/services/IMPD/IMPD_Public_Data/MapServer/1` "Incidents_Public". Fields include `sOccDate`, `CR_Desc`, `NIBRSClassCode`, `NIBRSClassDesc`, `PremiseType`, `LocationName`, `sAddress`, `Latitude`, `Longitude`, `Disposition`. `maxRecordCount` 2000 (needs paging). Also per-year "IMPD UCR" layers on the OpenIndy portal ([BTAA catalog](https://geo.btaa.org/catalog/e37beed7fb394452adacd4bf54e5c575_26.oai_dc_xml)) | Address-level fields exist (`sAddress`, `LocationName`). Whether they're generalized: **UNVERIFIED**. If precise, we must aggregate and never show points | **UNVERIFIED** | **UNVERIFIED**, terms page not found. Ask the City of Indianapolis before use. Some towns inside Marion County have their own police departments (**UNVERIFIED** which), so IMPD coverage ≠ county. |
| **West Lafayette, IN** | No open-data portal found. The city's "Crime and Safety" page lists "Crime Statistics" and a "Crime Map" (page returned 403 to our fetch; vendor **UNVERIFIED**). NIBRS reporting since Nov 2020 per a third-party aggregator ([uscrimereview](https://uscrimereview.com/in/agency/west-lafayette-pd), secondary) | — | Annual report (a 2025 report was released, [WLFI](https://www.wlfi.com/news/lafayette-and-west-lafayette-police-release-monthly-stats/article_1ae2fcc7-4ffe-4d1e-ad50-1cbb3e4e86be.html)) | Records requests possible ([MuckRock example](https://www.muckrock.com/foi/west-lafayette-175/police-data-collection-2017-2022-west-lafayette-police-department-160599/)). **Redistribution terms of any third-party crime-map vendor typically prohibit reuse: UNVERIFIED** |
| **Lafayette, IN** | Not found in this research: **UNVERIFIED** | — | — | — |

Platform limits: Socrata (SODA) throttles unauthenticated requests per IP. With an app token it "currently
[does] not throttle", except for abuse ([Socrata app tokens](https://dev.socrata.com/docs/app-tokens.html)).
ArcGIS REST services page results by `maxRecordCount`.

### 2.3 Commercial aggregators

| | CrimeoMeter | SpotCrime |
|---|---|---|
| What | Incident API by lat/lng + radius + date range (per third-party integration docs, [Membrane](https://skills.getmembrane.com/apps/crimeometer)) | Map/alerts of incidents from police and **news reports** ([Wikipedia](https://en.wikipedia.org/wiki/SpotCrime.com)) |
| Pricing | Pricing page lists a Personal plan (7-day trial, non-commercial) and a Commercial plan (14-day trial). **No prices published** ([crimeometer.com/pricing](https://www.crimeometer.com/pricing)) | Commercial API key by contacting sales. Results capped at 50 (third-party wrapper, [libraries.io](https://libraries.io/pypi/spotcrime)), **UNVERIFIED** |
| Coverage | Claims nationwide. **Methodology and gaps UNVERIFIED** | Mixed. History of disputes over source data ([Wikipedia](https://en.wikipedia.org/wiki/SpotCrime.com)) |
| Redistribution | **UNVERIFIED** (not on pricing page) | **UNVERIFIED** (ask for written terms) |
| Risk | Black-box normalization. Some products output a "crime score", which **we must not display** | News-sourced items skew toward sensational events |
| Fit | ⚠️ Only after a written license review. Paid API, so it needs founder approval | ⚠️ Same |

### 2.4 Cross-cutting data-quality issues

- **Rural / highway-corridor gaps.** Interstate exits are often unincorporated and policed by a county
  sheriff or state police, who rarely publish incident-level open data (**UNVERIFIED** as a general claim,
  but consistent with what we found for Tippecanoe/Indiana). Much of the I-65 corridor between West Lafayette
  and Indianapolis is likely to be "No data" (**UNVERIFIED**, measure in the pilot).
- **Jurisdiction boundaries.** A 1-mile circle around a stop can cross city/county lines. Data from one
  agency covers only part of the circle, so we need **partial coverage** as an explicit state.
- **Obfuscation.** Block-level geocoding (Chicago) moves points by up to a block. Some agencies snap to
  intersections or centroids. Sensitive offenses (sexual assault) are often withheld or not geocoded
  (**UNVERIFIED** per city). Counts near a stop are therefore **approximate** and undercount some offense
  types.
- **Reporting lag.** 7 days (Chicago), bi-weekly (LA), quarterly (NYC YTD), annual (FBI). Show "Data
  through {date}".
- **Taxonomies differ.** Chicago IUCR, NYPD `ofns_desc`/`law_cat_cd`, LAPD and IMPD NIBRS codes. We
  need a small mapping table to broad HerStop categories (§3.2) and should show the source's own label
  on drill-down.
- **Preliminary classifications** change after investigation (Chicago disclaimer).

### 2.5 Bias in reported-crime data (must be stated in-app and in docs)

- Reported crime measures **reports and police activity**, not crime itself. Areas with more patrols or more
  calls show more incidents. Under-reported offenses (including many against women) are undercounted.
- Historical policing patterns correlate with neighborhood race and income. Showing raw counts can
  reinforce stereotypes about neighborhoods and the people who live or work there.
- Busy places (highway exits, stations with high traffic) produce more reports simply from volume.
  Counts aren't normalized for footfall and can't be compared fairly between a truck stop and a rural
  station.
- Chicago's own terms warn against comparisons over time.

The design consequence: **no ranking or comparing stops by crime count, no heatmaps, no "worst areas"**,
and caveats always one tap away.

## 3. Proposed incident-information model

### 3.1 Coverage enum

```ts
// proposal only — not implemented
type CrimeCoverage =
  | 'incident_level'     // agency publishes geocoded incidents covering the whole radius
  | 'partial'            // incident data covers only part of the radius (jurisdiction boundary)
  | 'aggregate_only'     // only agency/county totals (e.g. FBI CDE) — no near-stop counts shown
  | 'stale'              // newest record older than threshold (e.g. > 120 days)
  | 'no_data';           // no usable source — UI says "No data for this area"
```

### 3.2 Summary record (computed server-side, cached per stop)

```ts
// proposal only
interface AreaIncidentSummary {
  stopId: string;
  radiusMiles: 0.5 | 1;                 // fixed choices, not user-tunable to tiny radii
  windowDays: 90 | 365;
  coverage: CrimeCoverage;
  counts: {                             // only when coverage is 'incident_level' or 'partial'
    category: 'violent' | 'robbery' | 'vehicle' | 'property' | 'other';
    count: number;                      // real counted records; never imputed
  }[];
  sources: { name: string; url: string; license: string }[];
  dataThrough: string;                  // ISO date of newest record in source
  computedAt: string;
  caveats: string[];                    // e.g. 'Locations shown at block level', 'Excludes sensitive offenses'
}
```

Rules:
- `counts` is **omitted** (not zero-filled) for `aggregate_only`, `stale` and `no_data`.
- A count under a small threshold (e.g. < 3) is shown as "Fewer than 3". That avoids false precision and
  re-identifying individual incidents.
- Storage: a `area_incident_summaries` table keyed by `stop_id`. **Raw incident rows are not stored** unless
  the source license allows it and a spec justifies it. Computed by a scheduled job (Edge Function or
  external script) with its own server-side credentials, never in the app.
- Nothing about the **user's** location is involved: summaries are per stop, so asking for one reveals no
  more than opening the stop.

### 3.3 UI copy guideline

Allowed pattern:
> **Area context** · *Reported incidents within 1 mi, last 90 days*
> 4 vehicle-related · 2 property · fewer than 3 robbery
> Source: Chicago Police Dept. via City of Chicago Data Portal · Data through Oct 8, 2026
> Reported crime reflects police reports, not all crime. Locations are approximate. [About this data]

No coverage:
> **Area context** · No data for this area. Local police data isn't available here. This doesn't
> mean fewer incidents occur.

Aggregate only:
> **Area context** · Incident-level data isn't published for this area. [See county-level totals from the FBI]

Never:
- "Safe area", "low-crime area", "dangerous", "high-risk", "crime-free", "this station is…"
- Red/green coloring of counts, or icons that imply danger (skull, siren, warning triangle on the stop card).
- Crime counts on the **stop card** or map pin. Area context lives only on the stop **detail** screen,
  below traveler feedback, and collapsed by default.
- Push notifications about crime near a stop.

Tone: neutral, factual, no fearmongering (frontend-rules.md).

## 4. Phased pilot proposal

| Phase | Scope | Exit criteria |
|---|---|---|
| **0: decision** | Founder decides whether area context fits the positioning. Legal review of source terms. | Written go/no-go. Selected jurisdiction's terms confirmed in writing |
| **1: one-jurisdiction pilot (internal only)** | **Chicago** first: the clearest open terms, daily updates, block-level privacy built in, and on the planned West Lafayette → Chicago corridor (I-65/I-94). Script computes `AreaIncidentSummary` for stops inside city limits. Every stop outside the city shows `no_data` / `partial`. Internal TestFlight only. | Summaries match manual spot checks for 10 stops. Copy review passes product-boundaries. Founder review of screenshots |
| **2: Indiana** | Indianapolis (IMPD ArcGIS) once terms are confirmed. FBI CDE `aggregate_only` for Tippecanoe/other counties. | Terms confirmed, coverage map documented |
| **3: expand** | Add cities with clear open-data licenses, one at a time, each with a coverage note. Consider a commercial source only after a license review + founder approval (paid). | Per-source checklist (license, lag, precision, taxonomy map) |

Out of scope at every phase: risk scores, heatmaps, routing around "bad" areas, any use in the stop
recommendation label.

## 5. Sources (accessed 2026-10-15)

- FBI RCN 2024 FAQ — https://cde.ucr.cjis.gov/LATEST/resources/reports/Reported%20Crimes%20in%20the%20Nation%202024%20FAQs.pdf
- Alabama Reflector (secondary) — https://alabamareflector.com/2025/08/11/us-crime-rates-fell-nationwide-in-2024-fbi-report-says/
- api.data.gov limits — https://api.data.gov/docs/developer-manual/
- FBI CDE frontend repo — https://github.com/fbi-cde/crime-data-frontend
- Chicago dataset metadata — https://data.cityofchicago.org/api/views/ijzp-q8t2.json
- NYC dataset metadata — https://data.cityofnewyork.us/api/views/5uac-w243.json ; https://geodiscovery.uwm.edu/catalog/sde-columbia-nypd_complaint_2019/metadata
- LA — https://catalog.data.gov/dataset/crime-data-from-2020-to-present
- Indianapolis — https://gis.indy.gov/server/rest/services/IMPD/IMPD_Public_Data/MapServer ; https://geo.btaa.org/catalog/e37beed7fb394452adacd4bf54e5c575_26.oai_dc_xml
- West Lafayette — https://www.westlafayette.in.gov/government/police-department/crime-and-safety (403 on fetch) ; https://uscrimereview.com/in/agency/west-lafayette-pd ; https://www.wlfi.com/news/lafayette-and-west-lafayette-police-release-monthly-stats/article_1ae2fcc7-4ffe-4d1e-ad50-1cbb3e4e86be.html ; https://www.muckrock.com/foi/west-lafayette-175/police-data-collection-2017-2022-west-lafayette-police-department-160599/
- Socrata app tokens — https://dev.socrata.com/docs/app-tokens.html
- CrimeoMeter — https://www.crimeometer.com/pricing ; https://skills.getmembrane.com/apps/crimeometer
- SpotCrime — https://en.wikipedia.org/wiki/SpotCrime.com ; https://libraries.io/pypi/spotcrime
