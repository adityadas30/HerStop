import type { ReviewStats } from './types';

// ---------------------------------------------------------------------------
// scoreStop — pure function, no I/O. Turns a stop's aggregate review stats
// into a recommendation label. See docs/features/community-reviews/spec.md §2
// for the brief this implements.
// ---------------------------------------------------------------------------

export type ScoreLabel = 'recommended' | 'good' | 'caution' | 'limited';
export type Confidence = 'low' | 'medium' | 'high';

export interface ScoreResult {
  label: ScoreLabel;
  /** Null when there isn't enough data to score (Limited Data). */
  score: number | null;
  confidence: Confidence;
  /** Plain-language reasons for any downgrade applied, empty when none apply. */
  reasons: string[];
}

/** The only copy the UI should show for each label — never invent other wording. */
export const LABEL_DISPLAY_NAME: Record<ScoreLabel, string> = {
  recommended: 'Recommended Stop',
  good: 'Good Option',
  caution: 'Use Caution',
  limited: 'Limited Data',
};

// Fewer than this many reviews and we don't have enough signal to say anything
// beyond "Limited Data" — showing a confident-looking label off 1-2 reviews
// would overstate what travelers have actually told us.
const MIN_REVIEWS_FOR_SCORE = 3;

// Confidence bands by review count (spec §2).
const CONFIDENCE_LOW_MAX_REVIEWS = 4; // 3-4 reviews -> low
const CONFIDENCE_MEDIUM_MAX_REVIEWS = 9; // 5-9 reviews -> medium, 10+ -> high
const CONFIDENCE_MULTIPLIER: Record<Confidence, number> = {
  low: 0.4,
  medium: 0.7,
  high: 1.0,
};

// The product brief scores stops on three inputs: community reviews (70%),
// confidence in the sample size (10%), and area safety context (20%). Area
// context has no data source yet (see intent.md "out of scope"), so we
// renormalize across the two inputs we actually have: 70/(70+10) = 0.875 and
// 10/(70+10) = 0.125. When area context ships, these weights — and this
// comment — need to be revisited.
const COMMUNITY_WEIGHT = 0.875;
const CONFIDENCE_WEIGHT = 0.125;

// Downgrade thresholds (spec §2, "brief rules").
// Weak lighting reported on a meaningful share of night visits.
const NIGHT_LIGHTING_RATIO_THRESHOLD = 0.3;
const NIGHT_LIGHTING_MIN_NIGHT_VISITS = 2;
const NIGHT_LIGHTING_PENALTY = 0.5;
// Loitering concerns reported "high" on a meaningful share of all reviews.
const LOITERING_RATIO_THRESHOLD = 0.25;
const LOITERING_PENALTY = 1.0;

// Label thresholds — v1, named constants so they're easy to retune later.
const RECOMMENDED_THRESHOLD = 4.2;
const GOOD_THRESHOLD = 3.4;

/** Turns a stop's aggregate stats into a recommendation label. No I/O. */
export function scoreStop(stats: ReviewStats | undefined): ScoreResult {
  if (!stats || stats.review_count < MIN_REVIEWS_FOR_SCORE) {
    return { label: 'limited', score: null, confidence: 'low', reasons: [] };
  }

  const confidence: Confidence =
    stats.review_count <= CONFIDENCE_LOW_MAX_REVIEWS
      ? 'low'
      : stats.review_count <= CONFIDENCE_MEDIUM_MAX_REVIEWS
        ? 'medium'
        : 'high';

  // Community score: the plain mean of the five 1-5 category averages.
  const community =
    (stats.avg_overall +
      stats.avg_lighting +
      stats.avg_restroom +
      stats.avg_cleanliness +
      stats.avg_staff) /
    5;

  let score =
    COMMUNITY_WEIGHT * community + CONFIDENCE_WEIGHT * (CONFIDENCE_MULTIPLIER[confidence] * 5);

  const reasons: string[] = [];

  if (
    stats.night_count >= NIGHT_LIGHTING_MIN_NIGHT_VISITS &&
    stats.night_low_lighting_count / stats.night_count >= NIGHT_LIGHTING_RATIO_THRESHOLD
  ) {
    score -= NIGHT_LIGHTING_PENALTY;
    reasons.push('Some travelers reported weak lighting at night');
  }

  if (stats.loitering_high_count / stats.review_count >= LOITERING_RATIO_THRESHOLD) {
    score -= LOITERING_PENALTY;
    reasons.push('Some travelers reported loitering concerns');
  }

  const label: ScoreLabel =
    score >= RECOMMENDED_THRESHOLD ? 'recommended' : score >= GOOD_THRESHOLD ? 'good' : 'caution';

  return { label, score, confidence, reasons };
}

/** Shared copy for the "N traveler reviews" line shown on cards and stop detail. */
export function reviewCountLabel(count: number): string {
  if (count === 0) return 'No reviews yet';
  if (count === 1) return '1 traveler review';
  return `${count} traveler reviews`;
}
