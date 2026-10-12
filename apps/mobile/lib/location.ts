import * as Location from 'expo-location';

export interface Coords {
  latitude: number;
  longitude: number;
}

export type LocationResult =
  | { status: 'granted'; coords: Coords }
  | { status: 'denied' }
  | { status: 'unavailable' };

/**
 * Request foreground location permission and return the device's current
 * position, or why there isn't one: `denied` (user declined) or `unavailable`
 * (permission fine but the read failed).
 *
 * Foreground-only, one-shot — never watched, stored, or logged. Callers use
 * the result purely in-memory to sort/display distance; nothing here persists
 * a location anywhere (see CLAUDE.md: "no precise travel history stored or
 * logged without an approved spec").
 */
export async function getLocation(): Promise<LocationResult> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== Location.PermissionStatus.GRANTED) return { status: 'denied' };

    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return {
      status: 'granted',
      coords: { latitude: position.coords.latitude, longitude: position.coords.longitude },
    };
  } catch (e) {
    if (__DEV__) console.warn('[getLocation] failed', e);
    return { status: 'unavailable' };
  }
}

/** Convenience for callers that only need the coordinates (null if denied/unavailable). */
export async function getCurrentCoords(): Promise<Coords | null> {
  const result = await getLocation();
  return result.status === 'granted' ? result.coords : null;
}

const EARTH_RADIUS_MILES = 3958.8;

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance between two real coordinate pairs, in miles. */
export function distanceMiles(a: Coords, b: Coords): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return EARTH_RADIUS_MILES * c;
}

/** Plain-language "X.X mi away" / "< 0.1 mi away" copy for a real computed distance. */
export function formatDistance(miles: number): string {
  if (miles < 0.1) return '< 0.1 mi away';
  return `${miles.toFixed(1)} mi away`;
}
