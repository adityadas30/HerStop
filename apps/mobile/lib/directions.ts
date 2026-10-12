import { Linking } from 'react-native';

/** The parts of a stop we need to build a directions link. */
export interface DirectionsTarget {
  name: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

function hasCoords(stop: DirectionsTarget): stop is DirectionsTarget & { latitude: number; longitude: number } {
  return Number.isFinite(stop.latitude) && Number.isFinite(stop.longitude);
}

function hasAddress(stop: DirectionsTarget): boolean {
  return !!stop.address && stop.address.trim().length > 0;
}

/** True when we have something real to navigate to (coordinates or an address). */
export function canGetDirections(stop: DirectionsTarget): boolean {
  return hasCoords(stop) || hasAddress(stop);
}

/**
 * Apple Maps link: real coordinates when we have them, otherwise the address
 * as a search query. Null when the stop has neither.
 */
export function buildAppleMapsUrl(stop: DirectionsTarget): string | null {
  if (hasCoords(stop)) {
    return `http://maps.apple.com/?daddr=${stop.latitude},${stop.longitude}&q=${encodeURIComponent(stop.name)}`;
  }
  if (hasAddress(stop)) {
    return `http://maps.apple.com/?daddr=${encodeURIComponent(stop.address!.trim())}&q=${encodeURIComponent(stop.name)}`;
  }
  return null;
}

/** Google Maps web link, used only if Apple Maps can't be opened. */
export function buildGoogleMapsUrl(stop: DirectionsTarget): string | null {
  const destination = hasCoords(stop)
    ? `${stop.latitude},${stop.longitude}`
    : hasAddress(stop)
      ? stop.address!.trim()
      : null;
  if (!destination) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

/**
 * Open turn-by-turn directions to a stop. Tries Apple Maps, then Google Maps
 * on the web. Returns false if neither could be opened. Never logs the
 * destination — coordinates are sensitive.
 */
export async function openDirections(stop: DirectionsTarget): Promise<boolean> {
  const candidates = [buildAppleMapsUrl(stop), buildGoogleMapsUrl(stop)];
  for (const url of candidates) {
    if (!url) continue;
    try {
      await Linking.openURL(url);
      return true;
    } catch {
      // Try the next option.
    }
  }
  return false;
}
