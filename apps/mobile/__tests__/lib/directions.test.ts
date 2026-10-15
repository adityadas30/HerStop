import { Linking } from 'react-native';

import {
  buildAppleMapsUrl,
  buildGoogleMapsUrl,
  canGetDirections,
  openDirections,
} from '@/lib/directions';

const withCoords = { name: 'Rest & Go', latitude: 37.7749, longitude: -122.4194 };
const withAddress = { name: 'Rest & Go', address: ' 1 Main St, Oakland, CA ' };

describe('canGetDirections', () => {
  it('is true with coordinates', () => {
    expect(canGetDirections(withCoords)).toBe(true);
  });

  it('is true with only an address', () => {
    expect(canGetDirections(withAddress)).toBe(true);
  });

  it('is false with missing coordinates and no address', () => {
    expect(canGetDirections({ name: 'x' })).toBe(false);
    expect(canGetDirections({ name: 'x', latitude: null, longitude: null, address: null })).toBe(false);
  });

  it('is false with only one coordinate, NaN, or a blank address', () => {
    expect(canGetDirections({ name: 'x', latitude: 37.7 })).toBe(false);
    expect(canGetDirections({ name: 'x', latitude: NaN, longitude: NaN })).toBe(false);
    expect(canGetDirections({ name: 'x', address: '   ' })).toBe(false);
  });
});

describe('buildAppleMapsUrl', () => {
  it('navigates to the coordinates in driving mode', () => {
    expect(buildAppleMapsUrl(withCoords)).toBe(
      'http://maps.apple.com/?daddr=37.7749,-122.4194&dirflg=d',
    );
  });

  it('never adds a q= search term that could override the destination', () => {
    expect(buildAppleMapsUrl(withCoords)).not.toContain('q=');
    expect(buildAppleMapsUrl(withAddress)).not.toContain('q=');
    expect(buildAppleMapsUrl({ ...withCoords, address: '1 Main St' })).not.toContain('q=');
  });

  it('prefers coordinates over the address', () => {
    expect(buildAppleMapsUrl({ ...withCoords, address: '1 Main St' })).toBe(
      'http://maps.apple.com/?daddr=37.7749,-122.4194&dirflg=d',
    );
  });

  it('falls back to the trimmed, encoded address', () => {
    expect(buildAppleMapsUrl(withAddress)).toBe(
      'http://maps.apple.com/?daddr=1%20Main%20St%2C%20Oakland%2C%20CA&dirflg=d',
    );
  });

  it('is null with nothing to navigate to', () => {
    expect(buildAppleMapsUrl({ name: 'x' })).toBeNull();
  });
});

describe('buildGoogleMapsUrl', () => {
  it('uses coordinates', () => {
    expect(buildGoogleMapsUrl(withCoords)).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=37.7749%2C-122.4194',
    );
  });

  it('falls back to the address', () => {
    expect(buildGoogleMapsUrl(withAddress)).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=1%20Main%20St%2C%20Oakland%2C%20CA',
    );
  });

  it('is null with nothing to navigate to', () => {
    expect(buildGoogleMapsUrl({ name: 'x' })).toBeNull();
  });
});

describe('Apple and Google links agree on the destination', () => {
  function appleDestination(url: string): string {
    return decodeURIComponent(new URL(url).searchParams.get('daddr') ?? '');
  }
  function googleDestination(url: string): string {
    return new URL(url).searchParams.get('destination') ?? '';
  }

  it.each([
    ['coordinates', withCoords],
    ['address only', withAddress],
    ['coordinates and address', { ...withCoords, address: '1 Main St' }],
  ])('with %s', (_label, stop) => {
    const apple = buildAppleMapsUrl(stop)!;
    const google = buildGoogleMapsUrl(stop)!;
    expect(appleDestination(apple)).toBe(googleDestination(google));
  });
});

describe('openDirections', () => {
  let openURL: jest.SpyInstance;

  beforeEach(() => {
    openURL = jest.spyOn(Linking, 'openURL');
  });

  afterEach(() => {
    openURL.mockRestore();
  });

  it('opens Apple Maps first', async () => {
    openURL.mockResolvedValue(true);
    await expect(openDirections(withCoords)).resolves.toBe(true);
    expect(openURL).toHaveBeenCalledTimes(1);
    expect(openURL.mock.calls[0][0]).toMatch(/^http:\/\/maps\.apple\.com\//);
  });

  it('falls back to Google Maps when Apple Maps fails', async () => {
    openURL.mockRejectedValueOnce(new Error('nope')).mockResolvedValueOnce(true);
    await expect(openDirections(withCoords)).resolves.toBe(true);
    expect(openURL).toHaveBeenCalledTimes(2);
    expect(openURL.mock.calls[1][0]).toMatch(/^https:\/\/www\.google\.com\/maps\//);
  });

  it('returns false when both fail', async () => {
    openURL.mockRejectedValue(new Error('nope'));
    await expect(openDirections(withCoords)).resolves.toBe(false);
  });

  it('returns false without opening anything when there is no destination', async () => {
    await expect(openDirections({ name: 'x' })).resolves.toBe(false);
    expect(openURL).not.toHaveBeenCalled();
  });
});
