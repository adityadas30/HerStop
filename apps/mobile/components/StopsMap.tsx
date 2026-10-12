import { useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';

import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import type { StopData } from '@/data/mock-stops';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { Coords } from '@/lib/location';

interface StopsMapProps {
  stops: StopData[];
  /** Real device position, or null when permission is denied / not yet read. */
  userCoords: Coords | null;
  loading?: boolean;
  onSelectStop: (stopId: string) => void;
}

const EDGE_PADDING = { top: 60, right: 50, bottom: 110, left: 50 };

function hasRealCoords(stop: StopData): boolean {
  return Number.isFinite(stop.latitude) && Number.isFinite(stop.longitude);
}

function regionAround(points: Coords[]): Region | undefined {
  if (points.length === 0) return undefined;
  const lats = points.map((p) => p.latitude);
  const lngs = points.map((p) => p.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * 1.4, 0.02),
    longitudeDelta: Math.max((maxLng - minLng) * 1.4, 0.02),
  };
}

/**
 * Native map (Apple Maps on iOS) with one marker per stop that has real
 * coordinates. Stops without coordinates are skipped, never given a guessed
 * position. The user dot is shown only when a real foreground fix exists
 * (`userCoords` non-null); coordinates are used in-memory only.
 */
export function StopsMap({ stops, userCoords, loading = false, onSelectStop }: StopsMapProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const mapRef = useRef<MapView>(null);
  const mounted = useRef(false);

  const mappable = useMemo(() => stops.filter(hasRealCoords), [stops]);
  const signature = useMemo(() => mappable.map((s) => s.id).join('|'), [mappable]);

  // Initial view: around the user when we have a real fix, else fit the stops.
  const initialRegion = useMemo<Region | undefined>(() => {
    if (userCoords) {
      return { ...userCoords, latitudeDelta: 0.1, longitudeDelta: 0.1 };
    }
    return regionAround(mappable);
    // Intentionally computed once; later changes go through fitToCoordinates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-fit when search/filters change which stops are shown.
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (mappable.length === 0) return;
    mapRef.current?.fitToCoordinates(
      mappable.map((s) => ({ latitude: s.latitude, longitude: s.longitude })),
      { edgePadding: EDGE_PADDING, animated: true },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        showsUserLocation={userCoords !== null}
        showsMyLocationButton={false}
        pitchEnabled={false}
        rotateEnabled={false}>
        {mappable.map((stop) => (
          <Marker
            key={stop.id}
            coordinate={{ latitude: stop.latitude, longitude: stop.longitude }}
            title={stop.name}
            description={stop.address}
            pinColor={colors.tint}
            onCalloutPress={() => onSelectStop(stop.id)}
          />
        ))}
      </MapView>

      {loading && (
        <View style={[styles.badge, styles.topBadge, { backgroundColor: colors.card }]}>
          <ActivityIndicator size="small" color={colors.tint} />
          <Text style={[styles.badgeText, { color: colors.secondaryText }]}>Loading stops…</Text>
        </View>
      )}

      {!loading && mappable.length === 0 && (
        <View style={[styles.badge, styles.emptyBadge, { backgroundColor: colors.card }]}>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No stops to show</Text>
          <Text style={[styles.badgeText, { color: colors.secondaryText }]}>
            Try adjusting your search or filters.
          </Text>
        </View>
      )}

      {/* OSM data attribution (ODbL). Bottom-right, so it never collides with
          Apple's own legal label at bottom-left. */}
      <View style={[styles.attribution, { backgroundColor: colors.card }]}>
        <Text style={[styles.attributionText, { color: colors.secondaryText }]}>
          © OpenStreetMap contributors
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  badge: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
  },
  topBadge: {
    top: Spacing.md,
  },
  emptyBadge: {
    top: Spacing.xl,
    flexDirection: 'column',
    gap: Spacing.xs,
    borderRadius: Radius.lg,
  },
  emptyTitle: {
    ...Typography.heading,
    fontSize: 16,
  },
  badgeText: {
    ...Typography.small,
  },
  attribution: {
    position: 'absolute',
    right: Spacing.sm,
    bottom: 96,
    paddingVertical: 2,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.xs,
    opacity: 0.9,
  },
  attributionText: {
    ...Typography.small,
    fontSize: 10,
  },
});
