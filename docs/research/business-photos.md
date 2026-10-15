# Research: Compliant photos of gas stations and rest areas

> **Status:** research only. Nothing here is implemented or approved.
> **Date:** 2026-10-15 · All URLs accessed 2026-10-15. Prices **as of 2026-10-15, verify before purchase**.
> Claims not confirmed from a primary source are marked **UNVERIFIED**. This is not legal advice. Have
> counsel review the final photo policy before launch.

## 1. Context

`components/ui/StopCard.tsx` currently shows a colored block (`stop.imageColor`) with a faint
`photo.fill` SF Symbol. `stops.image_url` exists in `docs/schema.sql` but isn't populated. Review photos
were **cut** from the current sprint (STATUS.md, 2026-09-10). Stops come from an OSM import, and the map
is Apple Maps.

The aim is real, correctly licensed photos where we can get them, honest placeholders where we can't, and
**never** an image presented as a place it isn't.

## 2. Sources compared

### 2.1 Google Places Photos (Place Photos, New)

| | Finding |
|---|---|
| Licensing | Content is licensed for display through the API, not owned. "You must not pre-fetch, cache, or store Places API content beyond the allowed exceptions" (place IDs are the exception). ([Places policies](https://developers.google.com/maps/documentation/places/web-service/policies)) |
| Photo references | "You cannot cache a photo name. Also, the name can expire." You have to fetch a fresh name from Place Details / Nearby / Text Search each time. ([Place Photos](https://developers.google.com/maps/documentation/places/web-service/place-photos)) |
| Attribution | "You must always credit the author when displaying photos or reviews", using name/avatar/profile link where space allows. Thumbnails can omit it only if the full-size view shows it. `authorAttributions` must appear "wherever you display the image". Google Maps logo attribution is also required. ([policies](https://developers.google.com/maps/documentation/places/web-service/policies), [Place Photos](https://developers.google.com/maps/documentation/places/web-service/place-photos)) |
| Map display | "Places API results displayed on a map must be shown on a Google Map". That conflicts with our Apple map whenever photos sit on map callouts. |
| Cost | Place Details Photos (Enterprise SKU): 1,000 free/month, then $7.00 per 1,000 (0–100k). Each photo also needs a Details/Search call to get a fresh photo name: Details Essentials $5.00/1k after 10k free, Pro $17.00/1k after 5k free. ([Google pricing](https://developers.google.com/maps/billing-and-pricing/pricing)) |
| Fit | ❌ for now: founder decision "no Google Places", recurring per-view cost, no storage, Google-map display rule. |

### 2.2 Apple Maps / MapKit

| | Finding |
|---|---|
| Photo API | There's **no public API that returns raw place photos** from Apple Maps. Native MapKit exposes place identifiers and fields like name, phone and URL. An Apple DTS reply mentions no photo access ([forum 775521](https://developer.apple.com/forums/thread/775521)). "No photo API" is a **negative claim, partly UNVERIFIED**: I found no documentation of a photo property, which isn't proof none exists. |
| What *is* available | Apple's own **place card UI**. `MKMapItemDetailViewController` (iOS 18+) "displays detailed information about a map item" and "presents modally". Its view hierarchy "is private and must not be modified" ([Apple docs](https://developer.apple.com/documentation/mapkit/mkmapitemdetailviewcontroller)). WWDC24 introduced place cards ([WWDC24 10097](https://developer.apple.com/videos/play/wwdc2024/10097/)). Whether the card shows Apple's photos for a given gas station is **UNVERIFIED** (depends on Apple's data). We can't extract, store or restyle those images. |
| Storage terms | Apple Maps Map Data may not be cached, prefetched or stored except on a temporary, limited basis (DPLA Apple Maps terms, quoted in [forum 79041](https://developer.apple.com/forums/thread/79041); current text: **UNVERIFIED**). |
| Fit | ⚠️ A "View on Apple Maps" / place-card button (needs a native module plus matching our OSM stop to an Apple map item) is a legitimate way to let users *see* Apple's imagery without us hosting it. Phase 3+. |

### 2.3 Mapillary (street-level imagery, Meta)

| | Finding |
|---|---|
| License | Images are shared under **CC BY-SA**, with an attribution format like `"Title" <link> by "username" <profile>, licensed under CC-BY-SA` ([Mapillary help: Licenses](https://help.mapillary.com/hc/en-us/articles/115001770409)). Developer use is governed by the Developer Policy and commercial use by the Mapillary Commercial Terms. Above a free API quota you're asked to contact them (per [Mapillary legal, archived 2016](https://web-archive.nli.org.il/National_Library/20160526010038mp_/https://mapillary.com/legal)). **Current commercial terms and quotas: UNVERIFIED.** |
| Practical | Imagery is road-facing, sometimes years old, and may show faces/plates (Mapillary auto-blurs, **UNVERIFIED** how reliably). It shows "what the approach looks like", not a curated photo. CC BY-SA **share-alike** may apply to derived images (crops are probably adaptations). Keep originals unmodified. |
| Fit | ⚠️ Phase 2 candidate as a clearly labeled "Street-level view (Mapillary contributor, CC BY-SA)", **hotlinked through their API, not bulk-downloaded**. |

### 2.4 KartaView

| | Finding |
|---|---|
| License | Images CC BY-SA 4.0. The platform software is partly proprietary ([OSM wiki: KartaView](https://wiki.openstreetmap.org/wiki/KartaView)). An OSM list comment warns deep links can lose license info ([tagging list 2021](https://lists.openstreetmap.org/pipermail/tagging/2021-June/061820.html)). **KartaView's current terms page wasn't checked: UNVERIFIED.** |
| Fit | ⚠️ Sparser US coverage than Mapillary (**UNVERIFIED**). Lower priority. |

### 2.5 Wikimedia Commons / OSM-linked images

| | Finding |
|---|---|
| Licenses | Mostly CC BY, CC BY-SA, GFDL or public domain. Reuse requires crediting the **original creator**, naming the license (with a link), and ShareAlike for adaptations. WMF gives "no warranty" on license correctness, so verify per file. Trademarks and personality rights still apply: "commercial use of images of people may require the subject's explicit agreement". ([Commons reuse guide](https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia)) |
| OSM linkage | OSM objects can carry `image=*`, `wikimedia_commons=*` or `wikidata=*` tags. Since our stops come from OSM, the import can pick these up. Few US gas stations have them; mostly **rest areas / welcome centers** do (**UNVERIFIED**, measure during import). |
| Fit | ✅ Phase 1 for rest areas: per-file license captured from the Commons API at import time, attribution shown under the image. |

### 2.6 Business-provided photos (claim flow)

- The business owner uploads photos and **warrants** they own the rights, granting HerStop a license to
  display them (terms of submission).
- Needs a **verification** step (domain email, phone callback, or manual review) before a business can claim
  a stop. Otherwise a stranger could "claim" a competitor.
- Label them "Photo from the business". This is marketing material, not traveler feedback, so it's visually
  separate from reviews.
- Fit: ⚠️ Phase 3. Needs ToS language, a claim-review queue and abuse handling.

### 2.7 User-contributed photos (with reviews)

Highest value and highest risk. Requirements before shipping:

| Risk | Mitigation |
|---|---|
| **EXIF GPS / device metadata** reveals where and when the reviewer was (location data is sensitive, see security-privacy-rules.md) | Strip **all** EXIF on device before upload, and **again server-side** (never trust the client). Store no original. |
| Faces, license plates, other people | Guideline "photograph the facility, not people". Automatic face/plate detection with blur, or reject + human review. Report button. |
| Time-of-visit inference | Don't show the exact upload timestamp. Show month/season ("Photo from Oct 2026"). |
| Wrong place / misleading images | Report flow ("Not this place"). Only show after moderation passes. |
| Copyright (photo taken from the web) | Upload terms: contributor took the photo and grants a license. Takedown/DMCA contact. |
| Harassment / doxxing via images | Pre-moderation for the first N uploads per account, rate limits, account-level bans. |
| Storage | A Supabase Storage bucket with RLS: write = own `auth.uid()` folder, public read **only** for `approved` rows (served through a view/signed URL). |

Fit: Phase 3. Needs a spec, moderation tooling and founder approval (UGC + new storage).

### 2.8 Brand logos (Shell, BP, Speedway, Love's…)

- Logos are **trademarks**. Showing them can imply endorsement or affiliation. Nominative fair use generally
  allows naming the brand in text (**legal nuance: UNVERIFIED, not legal advice**).
- Recommendation: show the brand **name as text** (from OSM `brand=*`) and **no logos**, unless we sign
  a brand partnership. Never put a logo next to a HerStop recommendation label, where it could read as the
  brand endorsing our rating.

### 2.9 Placeholder strategy (applies in every phase)

When no licensed photo exists:
- Keep a calm, neutral tile, but make it **intentional**: category glyph (SF Symbol `fuelpump.fill`,
  `toilet.fill`, `cup.and.saucer.fill`, `car.fill`) on a soft tint from `constants/theme.ts`
  (`tintLight` / dark-mode equivalent), with optional brand-name text.
- **Never** use stock photos of generic gas stations on a specific stop. That's fabricating what the place
  looks like.
- No "No photo" label on cards, since repeating an absence is noise. On the detail screen a single subtle
  line is fine ("No photos yet").
- Accessibility: placeholder `accessibilityLabel="Gas station, no photo available"`. Real photos get a
  meaningful label plus their attribution text.

## 3. What NOT to do

- ❌ Scrape Google Maps / Google Business Profile pages, Yelp, Tripadvisor, Apple Maps or brand websites
  for photos, by hand or with tools (Apify actors etc.).
- ❌ Bulk-download Mapillary/KartaView/Commons images to rehost "just in case". Fetch per stop, on demand
  or at import with per-file license capture.
- ❌ Store Google Places photos or photo names in Supabase/Storage, or cache them beyond what the terms allow.
- ❌ Crop out, hide or shrink attribution until it's unreadable.
- ❌ Show a photo from a different location (or a stock image) as if it were this stop.
- ❌ Keep EXIF location on any user upload, or show exact upload times.
- ❌ Use brand logos without permission.
- ❌ Use AI-generated "photos" of a real stop.

## 4. Recommended phased approach

| Phase | What | Dependencies |
|---|---|---|
| **0 (now)** | Designed placeholder (category glyph + tint + brand text). No photos. | UI only (see `docs/design/ui-ux-backlog.md`) |
| **1** | Wikimedia Commons images for stops whose OSM object links one (`wikimedia_commons` / `image` / `wikidata`), license + creator captured per file at import, attribution under the image, tap → Commons file page. | `stop_photos` table (migration), import script update |
| **2** | Mapillary street-level image nearest the stop entrance, labeled "Street-level view", CC BY-SA attribution, loaded live by image ID (store the ID + attribution, not the image). Confirm commercial terms first. | Mapillary commercial terms review (**UNVERIFIED**) |
| **3** | User photos with reviews (EXIF strip, moderation, report) **or** a verified business claim flow. "View on Apple Maps" button. | Spec + founder approval (UGC, storage), native module |
| Not planned | Google Places Photos | Founder decision. Revisit only with a Google map + budget |

## 5. Proposed data model: `stop_photos` (NOT implemented)

```sql
-- proposal only; migration-first, human-run, RLS reviewed by security-reviewer
create table public.stop_photos (
  id                uuid primary key default gen_random_uuid(),
  stop_id           text not null references public.stops(id) on delete cascade,
  source            text not null check (source in
                      ('wikimedia_commons','mapillary','kartaview','business','user','herstop')),
  source_ref        text,              -- Commons file title / Mapillary image id / storage path
  url               text,              -- display URL; null when it must be resolved live (e.g. Mapillary)
  thumb_url         text,
  license           text not null,     -- SPDX-ish: 'CC-BY-SA-4.0', 'CC-BY-4.0', 'PD', 'business-grant', 'user-grant'
  license_url       text,
  attribution_text  text not null,     -- exactly what we render, e.g. 'Photo: Jane Doe, CC BY-SA 4.0, via Wikimedia Commons'
  author_name       text,
  author_url        text,
  captured_period   text,              -- coarse: '2026-10' (never exact timestamp for user photos)
  fetched_at        timestamptz not null default now(),
  last_checked_at   timestamptz,       -- periodic re-check that the file/license still exists
  moderation_status text not null default 'pending'
                      check (moderation_status in ('pending','approved','rejected','removed')),
  moderation_note   text,              -- internal only; never selected by anon
  submitted_by      uuid references auth.users(id),   -- only for source='user'/'business'
  is_primary        boolean not null default false,
  created_at        timestamptz not null default now()
);
create index on public.stop_photos (stop_id) where moderation_status = 'approved';
-- RLS sketch:
--   select: anon/authenticated only where moderation_status = 'approved' (via a view without moderation_note/submitted_by)
--   insert: authenticated, source='user', submitted_by = auth.uid(), moderation_status forced 'pending'
--   update/delete: no client access (moderation via a security-definer RPC for moderators)
```

Rules: no row is displayed unless `attribution_text` and `license` are non-empty and `moderation_status
= 'approved'`. `stops.image_url` stays unused (or is later replaced by a `primary photo` view) and is not
dropped without approval.

## 6. Sources (accessed 2026-10-15)

- Google Places policies — https://developers.google.com/maps/documentation/places/web-service/policies
- Google Place Photos — https://developers.google.com/maps/documentation/places/web-service/place-photos
- Google pricing — https://developers.google.com/maps/billing-and-pricing/pricing
- Apple MKMapItemDetailViewController — https://developer.apple.com/documentation/mapkit/mkmapitemdetailviewcontroller
- Apple forum (place card customization) — https://developer.apple.com/forums/thread/775521 ; (Map Data caching) https://developer.apple.com/forums/thread/79041
- WWDC24 "Unlock the power of places with MapKit" — https://developer.apple.com/videos/play/wwdc2024/10097/
- Mapillary licenses — https://help.mapillary.com/hc/en-us/articles/115001770409 ; archived legal — https://web-archive.nli.org.il/National_Library/20160526010038mp_/https://mapillary.com/legal
- KartaView — https://wiki.openstreetmap.org/wiki/KartaView ; https://lists.openstreetmap.org/pipermail/tagging/2021-June/061820.html
- Wikimedia Commons reuse — https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia
