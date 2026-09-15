# OSM Beta Dataset — I-65 West Lafayette to Indianapolis

18 real highway stops (gas stations and travel centres) along I-65 between West
Lafayette and Indianapolis, Indiana. Built for HerStop's beta corridor per the
founder's bbox decision: `39.80,-87.00,40.47,-86.10`.

**Source:** [OpenStreetMap](https://www.openstreetmap.org) contributors, via the
Overpass API (`overpass-api.de`) and Nominatim reverse geocoding, retrieved
**2026-09-15**. Full query and processing steps are in `provenance.json`.

**Licence:** Data is © OpenStreetMap contributors, available under the
[Open Database License (ODbL)](https://opendatacommons.org/licenses/odbl/).
Any product surface using this data must carry the attribution:
**"© OpenStreetMap contributors"**.

**No fabricated fields.** Every value in `beta-stops.json` came directly from an
OSM tag or a Nominatim response field — nothing was inferred or guessed. A field
left null/empty (e.g. no `toilets` tag, no rest-area-equivalent app category)
means it wasn't available, not that it was guessed.

**Lebanon Rest Area excluded.** `osm-way-229125508` ("Lebanon Rest Area - I65
SB") is deliberately excluded per founder direction — tagged
`landuse=construction` and `toilets=no` in OSM, so not a usable stop.

See `provenance.json` for the exact Overpass query and dedup/selection logic.
