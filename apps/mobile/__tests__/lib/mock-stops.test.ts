import { MOCK_STOPS } from '@/data/mock-stops';

describe('MOCK_STOPS', () => {
  it('gives every stop finite, in-range coordinates', () => {
    for (const stop of MOCK_STOPS) {
      expect(Number.isFinite(stop.latitude)).toBe(true);
      expect(Number.isFinite(stop.longitude)).toBe(true);
      expect(Math.abs(stop.latitude)).toBeLessThanOrEqual(90);
      expect(Math.abs(stop.longitude)).toBeLessThanOrEqual(180);
    }
  });

  it('uses unique ids', () => {
    const ids = MOCK_STOPS.map((stop) => stop.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
