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
 * Where to navigate: the stop's own coordinates when we have them, otherwise
 * its address. Apple and Google links both use this, so they always agree.
 */
function destinationFor(stop: DirectionsTarget): string | null {
  if (hasCoords(stop)) return `${stop.latitude},${stop.longitude}`;
  if (hasAddress(stop)) return stop.address!.trim();
  return null;
}

/**
 * Apple Maps driving directions to the stop. Null when there is nowhere to go.
 *
 * Deliberately no `q=` (search) parameter: Apple Maps treats `q` as text typed
 * into its search box, so a stop name like "Willow Creek Plaza" got searched
 * near the user and could replace the real destination with a different place.
 */
export function buildAppleMapsUrl(stop: DirectionsTarget): string | null {
  const destination = destinationFor(stop);
  if (!destination) return null;
  // Coordinates stay readable ("40.5,-74.2"); an address is URL-encoded.
  const daddr = hasCoords(stop) ? destination : encodeURIComponent(destination);
  return `http://maps.apple.com/?daddr=${daddr}&dirflg=d`;
}

/** Google Maps web link, used only if Apple Maps can't be opened. */
export function buildGoogleMapsUrl(stop: DirectionsTarget): string | null {
  const destination = destinationFor(stop);
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
