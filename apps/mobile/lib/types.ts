/** Row shape returned by Supabase `stops` table. */
export interface Stop {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  badge: 'recommended' | 'good';
  categories: string[];
  tags: StopTag[];
  rating: number;
  review_count: number;
  image_url: string | null;
  image_color: string;
  created_at: string;
}

export interface StopTag {
  label: string;
  icon: string;
}

/** Matches the future `saved_stops` join table in Supabase. */
export interface SavedStop {
  id: string;
  user_id: string;
  stop_id: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Reviews — see docs/features/community-reviews/spec.md §1 for the DB contract
// (migration 003_reviews_privacy_and_moderation.sql, not yet applied to the
// live DB). All reads go through security-definer RPCs that never return a
// reviewer's user_id — see intent.md's privacy note.
// ---------------------------------------------------------------------------

export type LoiteringConcern = 'low' | 'medium' | 'high';
export type TimeOfVisit = 'day' | 'night' | 'unknown';
export type ReportReason = 'spam' | 'offensive' | 'not_about_stop' | 'personal_info' | 'other';

/** The five structured 1-5 ratings collected on every review. */
export interface ReviewRatings {
  overall_feeling: number;
  lighting: number;
  restroom_quality: number;
  cleanliness: number;
  staff_kindness: number;
}

/**
 * One row returned by the `get_stop_reviews` RPC. Never includes `user_id` —
 * `is_mine` is how the client knows a row is the caller's own.
 */
export interface Review extends ReviewRatings {
  id: string;
  stop_id: string;
  loitering_concern: LoiteringConcern;
  would_stop_again: boolean;
  time_of_visit: TimeOfVisit;
  note: string | null;
  /** Month precision only, e.g. "2026-09-01" — `date_trunc('month', created_at)`. */
  created_month: string;
  is_mine: boolean;
  is_hidden: boolean;
}

/** The fields the review form collects; written directly to the `reviews` table. */
export interface ReviewInput extends ReviewRatings {
  loitering_concern: LoiteringConcern;
  would_stop_again: boolean;
  time_of_visit: TimeOfVisit;
  note: string | null;
}

/** One row returned by the `get_stop_review_stats` RPC — aggregates only, no per-review data. */
export interface ReviewStats {
  stop_id: string;
  review_count: number;
  avg_overall: number;
  avg_lighting: number;
  avg_restroom: number;
  avg_cleanliness: number;
  avg_staff: number;
  would_stop_again_count: number;
  loitering_high_count: number;
  night_count: number;
  night_low_lighting_count: number;
  last_review_month: string;
}
