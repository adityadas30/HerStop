# Crime-data proof of concept (Chicago): research only

A local, **non-production** experiment. It tests whether public incident data can support stop-level
context near gas stations. It is not a HerStop feature. Nothing here is used by `apps/mobile`, writes
to a database, or needs a key or an account.

Findings: [`docs/research/crime-poc-chicago.md`](../../docs/research/crime-poc-chicago.md).

## What it does

1. `fetch.mjs` makes about 12 small, unauthenticated requests to the City of Chicago open-data portal's
   public SODA API for **Crimes - 2001 to Present** (`ijzp-q8t2`):
   - dataset metadata (1 request)
   - 5 **citywide aggregate** queries over the fixed 12-month window (the server returns small count
     tables, not incident rows)
   - **row-level** data for one study box on the Northwest Side (10,000-row pages)
   - **row-level** data for incidents tagged `GAS STATION` citywide

   Window: `2025-10-08` to `2026-10-08` (exclusive). There is a hard cap of 60,000 rows (the 2026-10-15
   run used 48,380) and a 1.5 s pause between requests. Responses are cached in `.cache/` (gitignored).
2. `analyze.mjs` reads the cache and prints **aggregate statistics only**. It also writes
   `.cache/summary.json`. It never prints an incident, a block address, a case number or a coordinate.

## Commands (from the repo root)

```bash
export PATH="$HOME/.nvm/versions/node/v24.14.1/bin:$PATH"   # any Node 18+ (needs built-in fetch)

node tools/crime-poc/fetch.mjs             # downloads once, then reuses .cache/
node tools/crime-poc/analyze.mjs           # prints the summary JSON
node tools/crime-poc/fetch.mjs --refresh   # re-download (the numbers will drift as the city updates data)
```

There are no dependencies beyond Node's standard library. On the same cache, `analyze.mjs` is
deterministic: two runs on 2026-10-15 produced byte-identical `summary.json`.

## Rules for this folder

- Never commit `.cache/`. It holds raw incident rows, including block-level addresses.
- Don't put any individual incident in a doc, a screenshot or a commit. Use aggregates only.
- The dataset's own terms prohibit trying to derive specific addresses. Don't.
- The category grouping in `analyze.mjs` (`person`, `vehicle`, `property_other`, `enforcement`,
  `domestic`, `not_location_relevant`) is a **HerStop research proposal**, not an official taxonomy.
