import { distanceMiles, formatDistance } from '@/lib/location';

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  PermissionStatus: { GRANTED: 'granted', DENIED: 'denied' },
  Accuracy: { Balanced: 3 },
}));

describe('distanceMiles', () => {
  it('is zero for identical points', () => {
    const p = { latitude: 37.7749, longitude: -122.4194 };
    expect(distanceMiles(p, p)).toBe(0);
  });

  it('matches a known real-world pair (SF City Hall to Oakland City Hall, ~8.4 mi)', () => {
    const sf = { latitude: 37.7793, longitude: -122.4193 };
    const oakland = { latitude: 37.8053, longitude: -122.2729 };
    const d = distanceMiles(sf, oakland);
    expect(d).toBeGreaterThan(8.0);
    expect(d).toBeLessThan(9.0);
  });

  it('matches New York to Los Angeles (~2445 mi) within 1%', () => {
    const nyc = { latitude: 40.7128, longitude: -74.006 };
    const la = { latitude: 34.0522, longitude: -118.2437 };
    expect(Math.abs(distanceMiles(nyc, la) - 2445)).toBeLessThan(2445 * 0.01);
  });

  it('is symmetric', () => {
    const a = { latitude: 40.7128, longitude: -74.006 };
    const b = { latitude: 34.0522, longitude: -118.2437 };
    expect(distanceMiles(a, b)).toBeCloseTo(distanceMiles(b, a), 8);
  });
});

describe('formatDistance', () => {
  it('formats short and normal distances', () => {
    expect(formatDistance(0.04)).toBe('< 0.1 mi away');
    expect(formatDistance(2.345)).toBe('2.3 mi away');
  });
});
