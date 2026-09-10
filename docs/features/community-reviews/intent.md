# Intent — community-reviews

**Why:** Structured traveler reviews are HerStop's core signal. Today the app shows seeded
`rating` / `review_count` / `badge` values from the `stops` table ("128 reviews") that no traveler
ever wrote — a direct violation of "never fabricate reviews, ratings, or metrics as if real."

**What:** Signed-in travelers can write one structured review per stop, read other travelers'
reviews, report or hide abusive ones, and see a recommendation label (Recommended Stop · Good
Option · Use Caution · Limited Data) **computed from real reviews only**.

**Also closes a privacy gap in migration 002:** its public `select` policy on `reviews` exposes
each reviewer's `user_id` next to stop + time of visit + date — a linkable travel trail for a
woman driving alone. Public reads move behind functions that never return author identity.

**MVP-critical:** yes — reviews, labels, and UGC reporting/blocking (App Store Guideline 1.2) are
required for a credible beta.

**Out of scope:** area safety context data (the 20% term — no data source yet), Google Maps,
real stop data sourcing, moderation UI (founder moderates in the Supabase dashboard), unblock UI,
photo uploads, profanity filtering, display names on reviews.
