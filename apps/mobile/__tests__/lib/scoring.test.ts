import { LABEL_DISPLAY_NAME, reviewCountLabel, scoreStop } from '@/lib/scoring';
import type { ReviewStats } from '@/lib/types';

function stats(overrides: Partial<ReviewStats> = {}): ReviewStats {
  return {
    stop_id: 'stop-1',
    review_count: 10,
    avg_overall: 5,
    avg_lighting: 5,
    avg_restroom: 5,
    avg_cleanliness: 5,
    avg_staff: 5,
    would_stop_again_count: 10,
    loitering_high_count: 0,
    night_count: 0,
    night_low_lighting_count: 0,
    last_review_month: '2026-09',
    ...overrides,
  };
}

function allAvgs(n: number): Partial<ReviewStats> {
  return { avg_overall: n, avg_lighting: n, avg_restroom: n, avg_cleanliness: n, avg_staff: n };
}

describe('scoreStop', () => {
  describe('limited data', () => {
    it('is limited with no stats', () => {
      expect(scoreStop(undefined)).toEqual({ label: 'limited', score: null, confidence: 'low', reasons: [] });
    });

    it('is limited at 0, 1 and 2 reviews even with perfect averages', () => {
      for (const n of [0, 1, 2]) {
        const r = scoreStop(stats({ review_count: n }));
        expect(r.label).toBe('limited');
        expect(r.score).toBeNull();
        expect(r.reasons).toEqual([]);
      }
    });

    it('is scored at exactly 3 reviews', () => {
      const r = scoreStop(stats({ review_count: 3 }));
      expect(r.label).not.toBe('limited');
      expect(r.score).not.toBeNull();
      expect(r.confidence).toBe('low');
    });
  });

  describe('labels', () => {
    it('recommended for strong high-confidence stats', () => {
      const r = scoreStop(stats());
      expect(r.label).toBe('recommended');
      expect(r.confidence).toBe('high');
      expect(r.score).toBeCloseTo(5, 5);
      expect(r.reasons).toEqual([]);
    });

    it('good for middling averages', () => {
      const r = scoreStop(stats(allAvgs(4)));
      // 0.875*4 + 0.125*5 = 4.125 -> between 3.4 and 4.2
      expect(r.score).toBeCloseTo(4.125, 5);
      expect(r.label).toBe('good');
    });

    it('caution for weak averages', () => {
      const r = scoreStop(stats(allAvgs(2)));
      expect(r.label).toBe('caution');
      expect(r.score as number).toBeLessThan(3.4);
    });

    it('confidence bands follow review count', () => {
      expect(scoreStop(stats({ review_count: 4 })).confidence).toBe('low');
      expect(scoreStop(stats({ review_count: 5 })).confidence).toBe('medium');
      expect(scoreStop(stats({ review_count: 9 })).confidence).toBe('medium');
      expect(scoreStop(stats({ review_count: 10 })).confidence).toBe('high');
    });

    it('low sample size lowers the score for identical averages', () => {
      const few = scoreStop(stats({ review_count: 3 }));
      const many = scoreStop(stats({ review_count: 10 }));
      expect(few.score as number).toBeLessThan(many.score as number);
    });
  });

  describe('reasons come only from real stats', () => {
    it('no reasons when no concerns are present', () => {
      expect(scoreStop(stats()).reasons).toEqual([]);
    });

    it('weak night lighting adds its reason and a penalty', () => {
      const base = scoreStop(stats());
      const r = scoreStop(stats({ night_count: 4, night_low_lighting_count: 2 }));
      expect(r.reasons).toEqual(['Some travelers reported weak lighting at night']);
      expect(r.score as number).toBeCloseTo((base.score as number) - 0.5, 5);
    });

    it('night lighting needs at least 2 night visits', () => {
      const r = scoreStop(stats({ night_count: 1, night_low_lighting_count: 1 }));
      expect(r.reasons).toEqual([]);
    });

    it('night lighting below the 30% ratio adds nothing', () => {
      const r = scoreStop(stats({ night_count: 10, night_low_lighting_count: 2 }));
      expect(r.reasons).toEqual([]);
    });

    it('loitering at 25% of reviews adds its reason and a penalty', () => {
      const base = scoreStop(stats());
      const r = scoreStop(stats({ review_count: 10, loitering_high_count: 3 }));
      expect(r.reasons).toEqual(['Some travelers reported loitering concerns']);
      expect(r.score as number).toBeCloseTo((base.score as number) - 1, 5);
    });

    it('loitering below 25% adds nothing', () => {
      expect(scoreStop(stats({ review_count: 10, loitering_high_count: 2 })).reasons).toEqual([]);
    });

    it('both concerns can apply and can downgrade the label', () => {
      const r = scoreStop(
        stats({ ...allAvgs(4), night_count: 4, night_low_lighting_count: 4, loitering_high_count: 5 }),
      );
      expect(r.reasons).toHaveLength(2);
      // 4.125 - 0.5 - 1.0 = 2.625
      expect(r.score).toBeCloseTo(2.625, 5);
      expect(r.label).toBe('caution');
    });
  });

  it('exposes the approved label copy only', () => {
    expect(LABEL_DISPLAY_NAME).toEqual({
      recommended: 'Recommended Stop',
      good: 'Good Option',
      caution: 'Use Caution',
      limited: 'Limited Data',
    });
  });
});

describe('reviewCountLabel', () => {
  it('handles 0, 1 and many', () => {
    expect(reviewCountLabel(0)).toBe('No reviews yet');
    expect(reviewCountLabel(1)).toBe('1 traveler review');
    expect(reviewCountLabel(7)).toBe('7 traveler reviews');
  });
});
