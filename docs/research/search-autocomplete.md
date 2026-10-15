# Research: Nationwide location search + autocomplete (Explore)

> **Status:** research only. Nothing here is implemented or approved.
> **Author:** Research & Architecture Analyst · **Date:** 2026-10-15 · **Branch:** `paseo/research-docs`
> All URLs accessed 2026-10-15 unless noted. Prices are **as of 2026-10-15, verify before purchase**.
> Anything not confirmed from a primary source is marked **UNVERIFIED**.

## 1. Problem

Today the Explore search box (`apps/mobile/app/(tabs)/index.tsx`, `searchQuery` + `filteredStops`)
filters an **already-loaded** list by name/address: `lib/api.ts#getStops()` runs
`supabase.from('stops').select('*')` (every row). That works for 6 seeded rows and one OSM corridor, but
not for a nationwide catalog.

What we need:

1. While the user types, suggest **addresses, cities and ZIP codes** anywhere in the US
   (test inputs: `47906`, `West Lafayette`, `90210`, `10001`).
2. Picking a suggestion gives us **one coordinate (and a viewport)**. The app re-centers the map and asks
   the backend for **stops near that point** (a geographic query). We do not filter a preloaded list.
3. Category filters and the List/Map toggle work on **the same result set** for the current search center.
4. Clear **loading / no suggestions / no stops nearby / search-provider error / stops-query error** states.

The map is Apple Maps: `components/StopsMap.tsx` uses `react-native-maps` with no `provider` prop, which
means Apple MapKit on iOS. That matters for licensing (§3).

Founder constraint (STATUS.md, 2026-09-10): **no Google Places**. Stops come from an OpenStreetMap import.
Google is still compared below for completeness.

## 2. Options compared

Legend: ✅ fine for us · ⚠️ workable with caveats · ❌ blocker

### 2.1 Apple MapKit `MKLocalSearchCompleter` (native, on-device API)

| Dimension | Finding |
|---|---|
| What it is | "A utility object for generating a list of completion strings based on a partial search string that you provide." You set `queryFragment` on every keystroke and results come back to a delegate. Apple says it "waits briefly for the string to stop changing", so **it debounces on its own**, and a completer object is meant to be kept and reused. `region` sets the geographic scope and `resultTypes` picks address / point-of-interest / query results. [Apple docs](https://developer.apple.com/documentation/mapkit/mklocalsearchcompleter) |
| Coverage (US + ZIP) | Same data as Apple Maps. Addresses and cities: ✅. **ZIP-only queries such as `47906` should resolve, but this is UNVERIFIED.** Test it on the Simulator before committing (see acceptance criteria). |
| Cost / limits | No API key and no per-call billing for native MapKit inside an app that's in the Apple Developer Program. Apple publishes no numeric quota for native MapKit. Excessive `MKLocalSearch` calls can fail with a throttling error (`MKError.loadingThrottled`; **UNVERIFIED** from current docs, general knowledge). The 25,000 service calls/day figure applies to **MapKit JS + Apple Maps Server API**, not native MapKit ([WWDC22 notes](https://wwdcnotes.com/notes/wwdc22/10006)). |
| License / storage | The Apple Developer Program License Agreement's Apple Maps terms (Schedule/attachment, about §2.5) say Map Data may not be cached, prefetched or stored "other than on a temporary and limited basis", and bar use in "any secondary or derived database". That's quoted in [Apple forum thread 79041](https://developer.apple.com/forums/thread/79041) and [thread 807656](https://developer.apple.com/forums/thread/807656), and the current text sits at [DPLA](https://developer.apple.com/support/terms/apple-developer-program-license-agreement). **Exact current wording: UNVERIFIED.** Effect for us: we use the picked coordinate transiently to query **our own** stops table, which is fine. We **must not** write Apple suggestions/geocodes into Supabase. Showing results on an Apple map: ✅ (it's Apple's own map). |
| Privacy | Typed text goes from the device to Apple's servers under Apple's privacy policy. No HerStop server, key or log is involved. Of all the options here, this sends user data to the fewest parties. |
| Native effort | Needs native code. CNG means `ios/` is generated, so the code has to be a **local Expo module** in `apps/mobile/modules/…`. Create it with `npx create-expo-module@latest --local` ([Expo docs](https://docs.expo.dev/modules/get-started/)), then `npx pod-install` / prebuild. That fits our `expo prebuild → npm run ios:build` flow, and `ios/` stays gitignored. Estimate: about 120–200 lines of Swift (completer + delegate → JS events, plus `MKLocalSearch(request: completion)` to resolve a picked suggestion to a coordinate) and a small TS wrapper. **No new npm dependency.** Existing npm wrappers are small and hardly maintained: `react-native-ios-autocomplete` 0.1.5, `react-native-address-autocomplete` last published 2021, `react-native-maps-placesearch` 0.1.6 (npm registry search, 2026-10-15). I don't recommend taking any of them on. **Approval note:** adding native code isn't a new dependency, but it is a new build surface, so the Lead should confirm. |
| Offline / failure | Without network it returns an error to `completer(_:didFailWithError:)`. The app can then fall back to the Supabase lookup (§4.2). |
| Verdict | ✅ **Primary** |

### 2.2 Google Places Autocomplete (New)

| Dimension | Finding |
|---|---|
| Coverage | Best-in-class worldwide, including US addresses and postal codes. |
| Cost | From the official pricing table ([Google pricing](https://developers.google.com/maps/billing-and-pricing/pricing)): Autocomplete Requests is 10,000 free/month, then $2.83 per 1,000 (0–100k tier). Autocomplete Session Usage has no charge listed when the session ends in a Details call. Place Details Essentials is 10,000 free, then $5.00/1k. Place Details Pro is 5,000 free, then $17.00/1k. Geocoding is 10,000 free, then $5.00/1k. A session token groups keystrokes with the closing Details call. |
| License / storage | "You must not pre-fetch, cache, or store Places API content beyond the allowed exceptions". Place IDs "can [be stored] indefinitely". **"Places API results displayed on a map must be shown on a Google Map."** Without a Google map you must show the Google logo. ([Places policies](https://developers.google.com/maps/documentation/places/web-service/policies)) |
| Privacy | Keystrokes plus (optional) location bias go to Google. A key in the app has to be restricted by iOS bundle ID. |
| Native effort | REST from JS is feasible. Showing results on our **Apple** map is the problem, because of the Google-map display rule. ❌ |
| Verdict | ❌ Conflicts with the founder decision **and** with our Apple map. |

### 2.3 Mapbox (Search Box API / Geocoding v6)

| Dimension | Finding |
|---|---|
| Coverage | Strong US address/place/postcode coverage. Geocoding v6 no longer returns POIs, so Mapbox points to the Search Box API for POIs ([Mapbox geocoding docs](https://docs.mapbox.com/api/search/geocoding/)). |
| Cost | Mapbox's official pricing page wasn't fetched. Secondary sources disagree: Search Box at 2,500 free sessions/month then $11.50/1k ([frontdeskreview](https://frontdeskreview.com/software/maps-api/mapbox.md)), versus a preview tier of 500 free then $3.00/1k ([PricingSaaS, 2026W40](https://pricingsaas.com/companies/mapbox/diffs/2026W40)). **UNVERIFIED, check mapbox.com/pricing.** |
| License / storage | Official: "Temporary results are not allowed to be cached, while Permanent results are allowed to be cached and stored indefinitely". Permanent needs `permanent=true` and a card on file. With `autocomplete=true` "you will likely accumulate one API request per keystroke". ([Mapbox geocoding docs](https://docs.mapbox.com/api/search/geocoding/)) Whether Mapbox results may be shown on a non-Mapbox (Apple) map is **UNVERIFIED** (check the Mapbox ToS / product terms). |
| Privacy | Keystrokes go to Mapbox. A public `pk.` token in the app is normal for Mapbox and should be URL/bundle-restricted. |
| Native effort | Plain REST from JS, no native code. |
| Verdict | ⚠️ Viable paid fallback if Apple and the Census fallback both fall short. Needs approval (paid API). |

### 2.4 Geoapify (OSM-based)

| Dimension | Finding |
|---|---|
| Coverage | OSM + open address data. US addresses vary by area, and city/ZIP coverage is good (**quality UNVERIFIED for rural Indiana**). |
| Cost | Free plan: 3,000 credits/day, no credit card, up to 5 requests/second, "Limited Commercial Use". 1 simple request (geocoding/places) = 1 credit ([Geoapify pricing](https://geoapify.com/pricing)). |
| License / storage | ToS: "you must always provide OpenStreetMap attribution". "Geoapify attribution is mandatory when using Free subscription plan". Free-plan commercial use is allowed "in the development" phase and in production only "with some limitations" (unspecified). Storage/caching rules aren't on the ToS page: **UNVERIFIED.** ([Geoapify T&C](https://www.geoapify.com/term-and-conditions/)) |
| Privacy | Keystrokes go to Geoapify (EU company). The API key would sit in the app or behind an edge function. |
| Native effort | REST from JS. |
| Verdict | ⚠️ Inexpensive fallback, but production terms on the free plan are unclear. |

### 2.5 HERE (Geocoding & Search: Autosuggest)

| Dimension | Finding |
|---|---|
| Coverage | Strong in the US (automotive-grade data). |
| Cost | HERE's plans page describes a Limited plan with 1,000 free daily requests and a pay-per-transaction Base plan "with generous free tiers per API", and calls its prices "indicative" ([HERE plans](https://developers.here.com/plans)). Autosuggest-specific price: **UNVERIFIED.** |
| License / storage | HERE generally restricts storing results without a storage license: **UNVERIFIED.** |
| Native effort | REST from JS. |
| Verdict | ⚠️ Enterprise-flavoured. More process than a two-person app needs. |

### 2.6 Radar

| Dimension | Finding |
|---|---|
| Coverage | US-focused address autocomplete and geocoding. |
| Cost | **Conflicting.** Radar's pricing page FAQ says "Radar does not currently offer a free tier", with Autocomplete and Geocoding "starting at $0.50" per 1,000 ([Radar pricing](https://radar.com/pricing)). Its product page says "free up to 100,000 requests per month" ([radar.com/product/api](https://radar.com/product/api)). **UNVERIFIED**, ask Radar. |
| License / storage | Not stated on the pricing page: **UNVERIFIED.** |
| Privacy | Radar's core business is location tracking/geofencing SDKs. Using only the REST autocomplete endpoint avoids the SDK, but it's still worth a privacy review. |
| Verdict | ⚠️ Cheap, but the free-tier confusion and the tracking-SDK orientation are a weaker fit for us. |

### 2.7 OpenStreetMap: Nominatim (public) and Photon

| Dimension | Finding |
|---|---|
| Nominatim public server | **❌ Banned for autocomplete.** Policy: autocomplete "is not yet supported by Nominatim and you must not implement such a service on the client side using the API". Absolute maximum 1 request/second. "Results must be cached on your side". Valid User-Agent/Referer required. ([OSMF Nominatim Usage Policy](https://operations.osmfoundation.org/policies/nominatim/)) A **self-hosted** Nominatim isn't covered by that policy, but the US import is a large ops burden. |
| Photon public server (`photon.komoot.io`) | Built for search-as-you-type over OSM. The public terms say only "please be fair - extensive usage will be throttled" and "We do not guarantee for the availability". Commercial use isn't addressed ([photon.komoot.io](https://photon.komoot.io/)). OK for prototyping, ❌ as a production dependency unless we self-host. |
| License | OSM data is ODbL. Attribution "© OpenStreetMap contributors" is required (we already show it on Explore). Storing derived results is allowed under ODbL with share-alike obligations for a derived *database*. |
| Privacy | Keystrokes go to the OSMF/komoot servers. |
| Verdict | ❌ Public servers for production autocomplete · ⚠️ self-hosted Photon later if we leave Apple. |

### 2.8 Zero-third-party option: US Census Gazetteer in Supabase

The Census Bureau publishes **Gazetteer files** for ZCTAs (ZIP Code Tabulation Areas) and Places
(cities/towns/CDPs), with names and representative lat/long, as national files
([Census Gazetteer 2024](https://www.census.gov/geographies/reference-files/time-series/geo/gazetteer-files.2024.html)).
The 2026 files switched to pipe-delimited
([2026 page](https://www.census.gov/geographies/reference-files/time-series/geo/gazetteer-files.2026.html)).
US Government works are generally public domain (**UNVERIFIED for these files specifically**: check the page's
terms note).

- About 33k ZCTAs and about 32k places (**counts UNVERIFIED**): a few MB in Postgres.
- Covers `47906`, `90210`, `10001`, `West Lafayette, IN` with **no third party at all**.
- ⚠️ ZCTAs approximate USPS ZIPs. Some ZIPs (PO-box-only, single-building) have no ZCTA.
- ❌ No street addresses.
- Loading it is a one-time public-data import (migration-first, run by a human), not a scrape.

## 3. Licensing summary that drives the decision

| Provider | Store results in Supabase? | Show on our Apple map? |
|---|---|---|
| Apple MapKit | ❌ (temporary only) | ✅ |
| Google Places | ❌ except place IDs | ❌ (Google map required) |
| Mapbox | Only with `permanent=true` (paid) | UNVERIFIED |
| Geoapify / HERE / Radar | UNVERIFIED | UNVERIFIED |
| Nominatim public | must cache; autocomplete banned | ✅ (ODbL attribution) |
| Census Gazetteer | ✅ (public data) | ✅ |

None of this affects the stops query: **we only use the picked point transiently as a query parameter.**
We store no search results and no history server-side.

## 4. Recommendation

**Primary:** Apple `MKLocalSearchCompleter` through a **local Expo module** (`modules/herstop-place-search`), for
addresses, cities and ZIPs, resolved on-device to a coordinate. Free, no key, no new npm dependency, matches
the Apple map, and keeps typed text between the user and Apple.

**Fallback:** Census Gazetteer (ZCTA + Places) loaded into Supabase and queried by an RPC with prefix search.
It covers ZIP and city searches when MapKit errors, is throttled, or returns nothing, and it's what the app
uses in Expo Go / web, where the native module isn't present. Addresses fall back to "Search for a city or
ZIP code instead."

A paid provider (Mapbox) is held in reserve. It needs founder approval (paid API).

### 4.1 Architecture

```
SearchBar (TextInput, editable)
  └─ usePlaceSuggestions(query, mapRegion)            hooks/use-place-suggestions.ts
        ├─ native available?  → HerstopPlaceSearch.setQuery(q, region)   (MapKit debounces)
        │                       ← onResults([{id,title,subtitle}]) / onError(code)
        └─ else / on error    → supabase.rpc('search_places', { q })     (debounce 250 ms, ≥2 chars)
SuggestionList (title/subtitle, "Searching…", "No matches", "Search unavailable")
  └─ onSelect(s) → resolve(s) → { lat, lng, label, span }   (MapKit: MKLocalSearch(request: completion))
SearchCenter state (Explore screen)   { lat, lng, label, source: 'search' | 'device' | 'default' }
  └─ useNearbyStops(center, radiusMeters)  → supabase.rpc('stops_near', …)
       └─ results → categoryFilter (client-side, same array) → List view & Map view
```

- **Single source of truth:** `SearchCenter` plus one `nearbyStops` array. Category chips filter that array
  in memory (`useMemo`), and **both** List and Map render the filtered array. This keeps the existing
  `filteredStops` pattern and changes only where `stops` comes from. Switching List↔Map never refetches.
- **When to refetch:** when the search center changes (suggestion picked, "Use my location"), or when the
  user pans the map far enough and taps a "Search this area" button. Never automatically on every pan:
  that's predictable, cheap, and doesn't trace the user's movement.
- **Debounce:** MapKit debounces internally ([Apple docs](https://developer.apple.com/documentation/mapkit/mklocalsearchcompleter)).
  The Supabase fallback uses 250 ms with a 2-character minimum, and drops stale responses with a request
  counter.
- **Session tokens:** not needed for MapKit (no billing). If Mapbox or Google is ever adopted, generate one
  UUID per "focus → select" session and reset it after a selection, to stay on session pricing.
- **Map region bias:** pass the current map region (or the device region if allowed) as `region`, so
  "Lafayette" prefers Indiana when the user is in Indiana.

### 4.2 Where the geographic stop query runs

**Supabase Postgres + PostGIS, exposed as an RPC that's callable with the anon key**, for public `stops`
data under the existing read-only RLS. An Edge Function isn't needed for a read of public data. Add one only
if we ever have to hold a **third-party** key (Mapbox etc.) server-side, stored as an Edge Function secret.
**A privileged Supabase secret key must never be in the app** (CLAUDE.md), and the RPC doesn't need one.

Proposed shape (sketch for a future migration; **not applied**, a human runs migrations). It follows
Supabase's PostGIS guide, which uses `geography(POINT)`, a GiST index, `st_point(long, lat)::geography`,
and the `<->` operator that "uses the spatial index when used within `order by`"
([Supabase PostGIS](https://supabase.com/docs/guides/database/extensions/postgis)):

```sql
-- 00X_stops_geography.sql  (proposal — review + human-run only)
create extension if not exists postgis with schema extensions;

alter table public.stops
  add column if not exists location extensions.geography(point)
  generated always as (
    extensions.st_setsrid(extensions.st_makepoint(longitude, latitude), 4326)::extensions.geography
  ) stored;

create index if not exists stops_location_gix on public.stops using gist (location);

create or replace function public.stops_near(
  p_lat double precision,
  p_lng double precision,
  p_radius_m integer default 16093,        -- 10 miles
  p_limit integer default 50
)
returns table (stop public.stops, distance_m double precision)
language sql
stable
security invoker                            -- runs under the caller's RLS (anon = public read)
set search_path = ''
as $$
  select s, extensions.st_distance(s.location, pt.g) as distance_m
  from public.stops s,
       (select extensions.st_point(p_lng, p_lat)::extensions.geography as g) pt
  where extensions.st_dwithin(s.location, pt.g, least(p_radius_m, 80467))  -- cap 50 mi
  order by s.location operator(extensions.<->) pt.g
  limit least(p_limit, 100);
$$;

grant execute on function public.stops_near to anon, authenticated;
```

Client: `supabase.rpc('stops_near', { p_lat, p_lng, p_radius_m })`. Keep the mock fallback in `lib/api.ts`:
when live fails, filter `MOCK_STOPS` by haversine distance (already in `lib/location.ts`) and say so in
dev logs.

Notes:
- The generated column keeps today's `latitude`/`longitude` columns as the source of truth (no data
  migration, nothing dropped). Whether a generated column can call PostGIS functions in our Postgres
  version is **UNVERIFIED**. If it can't, use a plain column plus a trigger.
- Returning a composite `stop` column may be awkward in supabase-js. A flat `returns table (id text, name
  text, …, distance_m float8)` is simpler for the client. Decide in the spec.
- Capping radius and limit in SQL stops a client from requesting the whole table.
- "No stops within 10 mi" should offer "Expand to 25 mi". Don't auto-expand silently.

Fallback lookup RPC (also a proposal):

```sql
create table public.geo_places (           -- Census Gazetteer: public data, no user data
  id text primary key,                     -- 'zcta:47906' | 'place:1882862'
  kind text not null check (kind in ('zip','city')),
  label text not null,                     -- '47906' | 'West Lafayette, IN'
  search_key text not null,                -- lower-cased, unaccented
  lat double precision not null,
  lng double precision not null
);
create index on public.geo_places (search_key text_pattern_ops);
-- RLS: enable; public select policy only.
-- search_places(q): where search_key like lower(q) || '%' order by kind, label limit 8
```

### 4.3 What is stored (privacy)

| Data | Where | Retention |
|---|---|---|
| Typed query text | Not stored server-side. Not logged. Not sent to PostHog/Sentry. | — |
| Picked coordinate | Memory only, as a single RPC parameter. Supabase API logs may record request details (**UNVERIFIED** whether POST bodies are captured; if so, round to 3 decimals ≈ 110 m before sending, which is plenty for a 10-mile radius). | session |
| Recent searches (optional, phase 3) | **On-device only** (AsyncStorage/SecureStore), max 5, the **label the user picked** plus our own rounded center, with a "Clear recent searches" control. Whether keeping a MapKit result *label* on-device is "temporary and limited" under Apple's terms is **UNVERIFIED**. More conservative variant: store only the user's own typed text and re-run the search on tap. | until cleared |
| Device location | Unchanged: foreground only, never stored, logged or sent (founder decision 2026-09-10). Passing the device point to `stops_near` *is* sending it to Supabase, so this needs a **founder decision**: round it, or keep distance sorting client-side for device location and use the RPC only for searched places. | — |

Sentry breadcrumbs must not contain query text or coordinates (scrub them in `lib/monitoring.ts`).

### 4.4 UI states

| State | Copy (draft) |
|---|---|
| Typing, waiting | Inline spinner in the field. List keeps the last suggestions. |
| No suggestions | "No matches for "{q}". Try a city or ZIP code." |
| Provider error / offline | "Search is unavailable right now. Check your connection and try again." (fallback RPC is tried first) |
| Stops loading | Skeleton cards / map spinner: "Finding stops near {label}…" |
| No stops in radius | "No stops in our data within 10 mi of {label} yet." + [Expand to 25 mi]. Empty means *no data*, not a judgment about the area. |
| Stops query error | "Couldn't load stops. Pull to retry." Never show "No stops" next to an error (same rule as commit `2a41c18`). |

### 4.5 Phased plan

| Phase | Scope | Effort |
|---|---|---|
| 0 | Migration proposal: PostGIS + `stops.location` + `stops_near` RPC. `getStopsNear()` in `lib/api.ts` with mock fallback. Explore keeps today's text filter. | S |
| 1 | Census Gazetteer import (`geo_places`) + `search_places` RPC + suggestion list UI + `SearchCenter` state. ZIP/city search works everywhere, including Expo Go. | M |
| 2 | Local Expo module wrapping `MKLocalSearchCompleter` (addresses + POIs). Gazetteer becomes the fallback. | M |
| 3 | Recent searches (on-device), "Search this area", radius expansion. | S |
| Later | Route-corridor query (`st_dwithin` against a route linestring), only after a spec on route privacy. | L |

### 4.6 Acceptance criteria (for the future feature spec)

- Typing `47906`, `West Lafayette`, `90210`, `10001` shows a matching suggestion within about 1 s on the
  Simulator (MapKit). With the native module disabled, the same four resolve through the Gazetteer.
- Picking one re-centers the map and the list shows only stops from `stops_near` for that point.
- Toggling a category chip changes List and Map identically. Switching List↔Map makes no network call.
- Airplane mode shows the provider-error copy, not a blank list.
- No query text or coordinate appears in console logs in a release build, or in Sentry.

## 5. Sources (accessed 2026-10-15)

- Apple MKLocalSearchCompleter — https://developer.apple.com/documentation/mapkit/mklocalsearchcompleter
- Apple DPLA — https://developer.apple.com/support/terms/apple-developer-program-license-agreement ; forum quotes https://developer.apple.com/forums/thread/79041 , https://developer.apple.com/forums/thread/807656
- WWDC22 Apple Maps Server API notes — https://wwdcnotes.com/notes/wwdc22/10006
- Expo local modules — https://docs.expo.dev/modules/get-started/
- Google pricing — https://developers.google.com/maps/billing-and-pricing/pricing ; Places policies — https://developers.google.com/maps/documentation/places/web-service/policies
- Mapbox geocoding — https://docs.mapbox.com/api/search/geocoding/ ; secondary pricing: https://pricingsaas.com/companies/mapbox/diffs/2026W40 , https://frontdeskreview.com/software/maps-api/mapbox.md
- Geoapify — https://geoapify.com/pricing , https://www.geoapify.com/term-and-conditions/
- HERE — https://developers.here.com/plans
- Radar — https://radar.com/pricing , https://radar.com/product/api
- Nominatim policy — https://operations.osmfoundation.org/policies/nominatim/ ; Photon — https://photon.komoot.io/
- Supabase PostGIS — https://supabase.com/docs/guides/database/extensions/postgis
- Census Gazetteer — https://www.census.gov/geographies/reference-files/time-series/geo/gazetteer-files.2024.html , https://www.census.gov/geographies/reference-files/time-series/geo/gazetteer-files.2026.html
- npm registry search (wrappers) — https://registry.npmjs.org/-/v1/search?text=MKLocalSearchCompleter
