# Spec — community-reviews

> Two tracks that run in parallel against the **contract** below:
> **Track DB** (`db-engineer`): `docs/migrations/003_reviews_privacy_and_moderation.sql` + `apps/mobile/scripts/rls-check.mjs`.
> **Track App** (`mobile-builder`): everything in `apps/mobile/{app,components,contexts,lib}`.
> The app must handle the RPCs not existing yet (before the founder runs 003) as an ordinary error state.

## 1. Database contract (migration 003 — founder runs it)

Current state: `reviews` exists (002) with RLS; it is empty.

**Changes**
1. `reviews`: add `unique (user_id, stop_id)` — one review per traveler per stop.
2. Drop policy `"Anyone can read visible reviews"` on `reviews`. The base table becomes readable
   only by its author (existing policy `"Authors can read their own review even if hidden"`).
   Author insert/update/delete policies stay.
3. Trigger on `reviews`: when the caller is an ordinary signed-in user (`auth.role() = 'authenticated'`),
   force `is_hidden = false` on insert and keep `old.is_hidden` on update. Closes 002's documented
   "author can un-hide" gap. Dashboard/SQL-editor edits by the founder are unaffected.
4. New table `review_reports` — `id uuid pk`, `review_id uuid → reviews on delete cascade`,
   `reporter_id uuid → auth.users on delete cascade`, `reason text check in ('spam','offensive',
   'not_about_stop','personal_info','other')`, `note text check (char_length(note) <= 280)`,
   `review_note_snapshot text` (copy of the review's note at report time, so an edit can't erase
   evidence), `created_at`, `unique (review_id, reporter_id)`. RLS on; **no** client select/update/delete;
   inserts only via `report_review()`.
5. New table `hidden_reviews` — `user_id uuid → auth.users on delete cascade`, `review_id uuid →
   reviews on delete cascade`, `created_at`, `primary key (user_id, review_id)`. RLS on, **no client
   policies**; inserts only via `hide_review()`. *(Changed after security review 2026-09-10:
   author-wide blocking let an attacker learn which reviews one traveler wrote by blocking and
   diffing results, and exposed the blocked user's id. Viewers hide single reviews instead.)*
6. New table `banned_users` — `user_id uuid pk → auth.users on delete cascade`, `reason text`,
   `created_at`. RLS on, **no client policies**. The founder inserts rows from the dashboard to block
   an abusive account from the service (App Store 1.2). Banned authors' reviews disappear everywhere
   and they can no longer insert or update reviews.
7. Author delete policy recreated as `using (auth.uid() = user_id and is_hidden = false)` — deleting
   a moderated review would cascade-delete its reports and allow re-posting.
8. The `is_hidden` trigger also sets `created_at = now()` on insert and keeps `created_at`,
   `stop_id`, `user_id` unchanged on update.
9. **Publish delay:** other travelers see a review only 24 hours after creation; the author sees it
   immediately. One named interval, easy to change. (Recommended default; founder may veto.)
10. Whole file wrapped in `begin; set local lock_timeout = '5s'; … commit;`. `revoke execute … from
    public, anon` on write functions.

**Functions** (all `security definer`, `set search_path = public`, explicit `grant execute`):

| Function | Callable by | Returns / does |
|---|---|---|
| `get_stop_reviews(p_stop_id text)` | anon, authenticated | Rows: `id uuid, stop_id text, overall_feeling, lighting, restroom_quality, cleanliness, staff_kindness smallint, loitering_concern text, would_stop_again boolean, time_of_visit text, note text, created_month date` (`date_trunc('month', created_at)` — month precision only), `is_mine boolean`, `is_hidden boolean`. Includes non-hidden reviews older than the publish delay **plus** the caller's own review (even if hidden or new). Excludes reviews the caller hid and reviews by banned authors. Newest first, limit 50. **Never returns `user_id`.** |
| `get_stop_review_stats(p_stop_ids text[])` | anon, authenticated | One row per stop id that has ≥1 visible review: `stop_id, review_count int, avg_overall, avg_lighting, avg_restroom, avg_cleanliness, avg_staff numeric(3,2), would_stop_again_count int, loitering_high_count int, night_count int, night_low_lighting_count int` (night visits with `lighting <= 2`), `last_review_month date`. Hidden, banned-author, and not-yet-published reviews excluded. `p_stop_ids` capped at 200. Stops with no reviews are simply absent. |
| `report_review(p_review_id uuid, p_reason text, p_note text default null)` | authenticated | Inserts a report as `auth.uid()`. Idempotent (duplicate → no error). Raises if unauthenticated or review not visible to caller. |
| `hide_review(p_review_id uuid)` | authenticated | Inserts `(auth.uid(), p_review_id)` if the caller can see that review. No-op if own or already hidden. Raises if unauthenticated. "Not found" and "not visible" use the same error text. |

Writing a review stays a direct table write: `upsert` on `reviews` with `onConflict: 'user_id,stop_id'`
(update path allowed by the existing author update policy), `delete` for removal. `user_id` always
comes from the session.

`rls:check` must be updated to the new reality: anon `select` on `reviews` returns 0 rows; anon can
call `get_stop_reviews` and `get_stop_review_stats`; anon calling `report_review` /
`hide_review` is rejected; anon cannot read `review_reports`, `hidden_reviews`, or `banned_users`.

## 2. Scoring (`apps/mobile/lib/scoring.ts`, pure, no I/O)

`scoreStop(stats | undefined) → { label, score, confidence, reasons }`
- `label`: `'recommended' | 'good' | 'caution' | 'limited'`
- `review_count < 3` or no stats → `limited`, `score: null`, `confidence: 'low'`.
- Community score = mean of the five rating averages (1–5).
- Confidence: 3–4 reviews `low` (0.4), 5–9 `medium` (0.7), ≥10 `high` (1.0).
  `score = 0.875 × community + 0.125 × (confidence × 5)` — the brief's 70/10 community/confidence
  weights renormalized because area context (20%) has no data source yet. Comment this.
- Downgrades (brief rules): night_low_lighting_count / night_count ≥ 0.3 (with night_count ≥ 2) → −0.5 and
  reason "Some travelers reported weak lighting at night"; loitering_high_count / review_count ≥ 0.25
  → −1.0 and reason "Some travelers reported loitering concerns".
- Label: `score ≥ 4.2` recommended · `≥ 3.4` good · else caution. v1 thresholds — named constants.
- Display names: Recommended Stop · Good Option · Use Caution · Limited Data.

## 3. Screens

**Explore (`app/(tabs)/index.tsx`, `StopCard`)**
- Label chip from `scoreStop`. Review line: `"N traveler reviews"` / `"1 traveler review"` / `"No reviews yet"`.
- Remove every display of the seeded `stops.rating`, `stops.review_count`, `stops.badge`, and any
  distance not computed from real location (there is none yet). Do not delete the DB columns.
- Subtitle "Better-reviewed stops within 5 miles" claims a distance filter that doesn't exist →
  `"Browse stops and recent traveler feedback"`.
- One `get_stop_review_stats` call for all loaded stops (not N calls).

**Stop detail (`app/stop/[id].tsx`)**
- Header label + `"Based on N traveler reviews"` (or the Limited Data line below).
- Limited Data: `"Fewer than 3 traveler reviews so far — not enough to make a recommendation yet."`
- When ≥3 reviews: averages for Lighting, Restroom, Cleanliness, Staff; `"X% would stop here alone again"`; scoring `reasons` as plain lines.
- Reviews section title `"Traveler Reviews"`. Replace the "verified women travelers" placeholder
  (we verify no one). Empty: `"No reviews yet. Stopped here? Your review helps the next traveler."`
- Each review: time-of-visit chip (Day / Night / Time not specified), overall ★, "Would stop again: Yes/No",
  "Loitering concern: Low/Medium/High", note, month ("Sep 2026"). Own review marked `"Your review"`,
  and if hidden: `"Hidden after a report — only you can see it."`; if under 24 hours old:
  `"Visible to other travelers 24 hours after posting."`
- On other travelers' reviews, a `⋯` menu: `"Report review"` → reason sheet (Spam · Offensive or
  harassing · Not about this stop · Shares personal info · Other) → `"Thanks — we'll take a look."`;
  `"Hide this review"` → confirm → list refreshes without it.
- Button `"Write a review"` (or `"Edit your review"` if `is_mine` exists). Guest → routed to Profile
  sign-in, returns to the stop (same pattern as guest save).

**Review form (new modal route, e.g. `app/review/[stopId].tsx`, registered in `app/_layout.tsx`)**
- Required: Overall feeling, Lighting, Restroom, Cleanliness, Staff kindness (1–5 each);
  Loitering concern (Low/Medium/High); Would you stop here alone again? (Yes/No);
  Time of visit (Day/Night/Not sure → `unknown`). Optional note, 280-char counter, helper text
  `"Describe the stop, not people. Don't include names or personal details."`
- Submit disabled until required fields set. Edit pre-fills; `"Delete review"` with confirmation.
- Success → back to detail, list + stats refreshed. Failure → inline error, form state preserved.

## 4. States
Loading skeleton/spinner for stats and reviews · empty (above) · error: `"Couldn't load traveler
feedback."` + Retry — an error must **never** render as Limited Data or as "No reviews yet" ·
Supabase not configured (mock mode): reviews `[]`, stats empty → Limited Data; log `MOCK`; never invent reviews.

## 5. Edge cases
RPCs missing (003 not run) → error state, no crash · signed out mid-form · double submit ·
note exactly 280 · editing after hidden · stop with 1–2 reviews · reporting twice · blocking then
reopening the stop · deleted stop · long notes wrap · product-language: no "safe"/"verified" claims.

## 6. Privacy / security
No `user_id` of other travelers ever reaches the client. Month-precision dates only. Anon key only.
No location data. Report notes and review notes ≤280. `security-reviewer` reviews 003 before the founder runs it.

## Acceptance criteria
- [ ] AC1 `tsc` and `lint` clean.
- [ ] AC2 No UI path displays `stops.rating`, `stops.review_count`, `stops.badge`, or a non-computed distance (grep + screenshots).
- [ ] AC3 Explore and detail show labels from `scoreStop`; with zero reviews every stop shows Limited Data.
- [ ] AC4 Signed-in user can create, edit, and delete their one review for a stop; detail stats/list update.
- [ ] AC5 Guest tapping "Write a review" is routed to sign-in and lands back on that stop.
- [ ] AC6 Report and hide-review work for another traveler's review; own review has no ⋯ menu.
- [ ] AC7 No response the client receives for other travelers' reviews contains a `user_id`.
- [ ] AC8 Error state (RPC failure) renders the error copy, not Limited Data / empty copy.
- [ ] AC9 `rls:check` updated and passing after 003 is applied.
- [ ] AC10 `scoreStop` thresholds/downgrades match §2 (spot-check at least: 0, 2, 3, 10 reviews; high loitering; night low lighting).
- [ ] AC11 No banned product language in new copy.
