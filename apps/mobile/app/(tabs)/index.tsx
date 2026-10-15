import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { FilterChip } from '@/components/ui/FilterChip';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { JourneyShield } from '@/components/ui/JourneyShield';
import { StopCard } from '@/components/ui/StopCard';
import { StopsMap } from '@/components/StopsMap';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { FILTERS, type StopData } from '@/data/mock-stops';
import { getStopReviewStats, getStops } from '@/lib/api';
import { filterStops, getExploreLocationNote, getExploreResultCount, type ExploreLocationState } from '@/lib/explore';
import { distanceMiles, getLocation } from '@/lib/location';
import type { ReviewStats } from '@/lib/types';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function DiscoverScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [stops, setStops] = useState<StopData[]>([]);
  const [stats, setStats] = useState<Map<string, ReviewStats>>(new Map());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilters, setSelectedFilters] = useState<Set<string>>(new Set());
  const [location, setLocation] = useState<ExploreLocationState>({ status: 'loading' });
  const coords = location.status === 'granted' ? location.coords : null;
  const [loadError, setLoadError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [loading, setLoading] = useState(true);
  const searchInputRef = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView>(null);

  const loadStops = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    getStops().then(({ stops: loadedStops, error }) => {
      setStops(loadedStops);
      setLoadError(error);
      setLoading(false);
      if (loadedStops.length === 0) return;
      // One call for every loaded stop's stats, not one call per stop.
      getStopReviewStats(loadedStops.map((s) => s.id)).then(({ stats: loadedStats }) => {
        setStats(loadedStats);
      });
    });
  }, []);

  useEffect(() => {
    loadStops();
    let active = true;
    getLocation().then((result) => {
      if (active) setLocation(result);
    });
    return () => { active = false; };
  }, [loadStops]);

  function toggleFilter(label: string) {
    setSelectedFilters((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  // Real distance from the device's current position to each stop's real
  // coordinates — undefined (not 0, not a guess) for every stop until coords
  // are available.
  const distances = useMemo(() => {
    const next = new Map<string, number>();
    if (!coords) return next;
    for (const stop of stops) {
      next.set(stop.id, distanceMiles(coords, { latitude: stop.latitude, longitude: stop.longitude }));
    }
    return next;
  }, [stops, coords]);

  const filteredStops = useMemo(() => {
    let result = filterStops({ stops, query: searchQuery, selectedFilters });

    // Sort by real distance once we have a real position; otherwise leave the
    // catalog's own order (alphabetical from the `stops` query) alone rather
    // than inventing an order that looks location-aware but isn't.
    if (coords) {
      result = [...result].sort(
        (a, b) => (distances.get(a.id) ?? Infinity) - (distances.get(b.id) ?? Infinity),
      );
    }

    return result;
  }, [stops, searchQuery, selectedFilters, coords, distances]);

  const controls = (
    <>
      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>HERSTOP</Text>
        <View style={[styles.segmented, { backgroundColor: colors.surface }]}>
          {(['list', 'map'] as const).map((mode) => {
            const active = viewMode === mode;
            return (
              <TouchableOpacity
                key={mode}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={mode === 'list' ? 'List view' : 'Map view'}
                onPress={() => {
                  scrollRef.current?.scrollTo({ y: 0, animated: false });
                  setViewMode(mode);
                }}
                style={[styles.segment, active && { backgroundColor: colors.tint }]}>
                <Text style={[styles.segmentText, { color: active ? '#FFFFFF' : colors.text }]}>
                  {mode === 'list' ? 'List' : 'Map'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* ── Search bar ── */}
      <View style={[styles.searchBar, { backgroundColor: colors.surface }]}>
        <IconSymbol name="magnifyingglass" size={16} color={colors.secondaryText} />
        <TextInput
          ref={searchInputRef}
          testID="explore-search-input"
          accessibilityLabel="Search stops by name or address"
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Where are you heading?"
          placeholderTextColor={colors.secondaryText}
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity
            testID="explore-search-clear"
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            onPress={() => {
              setSearchQuery('');
              searchInputRef.current?.focus();
            }}
            hitSlop={12}>
            <IconSymbol name="xmark" size={16} color={colors.secondaryText} />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Filter chips ── */}
      <ScrollView
        horizontal
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="none"
        style={styles.chipsScroll}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsRow}>
        {FILTERS.map((f) => (
          <FilterChip
            key={f.label}
            label={f.label}
            icon={f.icon}
            selected={selectedFilters.has(f.label)}
            onPress={() => toggleFilter(f.label)}
          />
        ))}
      </ScrollView>
    </>
  );

  // One place decides which state the catalog is in, so list and map agree.
  const catalogState: 'loading' | 'error' | 'empty' | 'no-matches' | 'ready' = loading
    ? 'loading'
    : loadError
      ? 'error'
      : stops.length === 0
        ? 'empty'
        : filteredStops.length === 0
          ? 'no-matches'
          : 'ready';

  const stateView =
    catalogState === 'ready' ? null : (
      <View style={styles.emptyState}>
        {catalogState === 'loading' ? (
          <>
            <ActivityIndicator color={colors.tint} />
            <Text style={[styles.emptyBody, { color: colors.secondaryText }]}>Loading stops…</Text>
          </>
        ) : catalogState === 'error' ? (
          <>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Couldn&apos;t load stops</Text>
            <Text style={[styles.emptyBody, { color: colors.secondaryText }]}>{loadError}</Text>
            <Button label="Retry" onPress={loadStops} />
          </>
        ) : catalogState === 'empty' ? (
          <>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No stops listed yet</Text>
            <Text style={[styles.emptyBody, { color: colors.secondaryText }]}>
              We don&apos;t have any stops to show right now. Check back soon.
            </Text>
          </>
        ) : (
          <>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No matching stops</Text>
            <Text style={[styles.emptyBody, { color: colors.secondaryText }]}>
              Try adjusting your search or filters.
            </Text>
          </>
        )}
      </View>
    );

  const locationMessage = getExploreLocationNote(location);
  const resultCount = getExploreResultCount({
    query: searchQuery,
    selectedFilters,
    count: filteredStops.length,
  });
  const showResultCount = catalogState !== 'loading' && catalogState !== 'error' && resultCount !== null;
  const locationNote = locationMessage ? (
    <Text style={[styles.locationNote, { color: colors.secondaryText }]}>
      {locationMessage}
    </Text>
  ) : null;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Keep one controls tree mounted while the mode or catalog state changes. */}
      <ScrollView
        ref={scrollRef}
        style={styles.content}
        contentContainerStyle={[
          viewMode === 'map' ? styles.mapScreen : styles.scrollContent,
          { paddingTop: insets.top + Spacing.sm },
        ]}
        scrollEnabled={viewMode === 'list'}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={viewMode === 'list' ? 'on-drag' : 'none'}>
        <View style={styles.controls}>
          {controls}
          {locationNote}
          {showResultCount && (viewMode === 'map' || catalogState !== 'ready') ? (
            <Text style={[styles.resultCount, { color: colors.secondaryText }]}>{resultCount}</Text>
          ) : null}
        </View>
        {viewMode === 'map' ? (
          <View style={styles.content}>
            {stateView ? (
              <View style={styles.mapState}>
                {stateView}
                <Text style={[styles.attribution, { color: colors.secondaryText }]}>
                  © OpenStreetMap contributors
                </Text>
              </View>
            ) : (
              <StopsMap
                stops={filteredStops}
                userCoords={coords}
                onSelectStop={(id) => router.push(`/stop/${id}`)}
              />
            )}
          </View>
        ) : (
          <View style={styles.listContent}>
            {stateView ?? (
              <>
                {/* ── Section header ── */}
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    Recommended near you
                  </Text>
                  <Text style={[styles.sectionSubtitle, { color: colors.secondaryText }]}>
                    {resultCount ?? (coords
                      ? 'Sorted by distance from you'
                      : 'Browse stops and recent traveler feedback')}
                  </Text>
                </View>

                {/* ── Stop cards ── */}
                <View style={styles.cardsList}>
                  {filteredStops.map((stop) => (
                    <StopCard
                      key={stop.id}
                      stop={stop}
                      stats={stats.get(stop.id)}
                      distanceMiles={distances.get(stop.id)}
                      onPress={() => router.push(`/stop/${stop.id}`)}
                    />
                  ))}
                </View>
              </>
            )}

            {/* ── OSM attribution (ODbL requires this wherever the data is shown) ── */}
            <Text style={[styles.attribution, { color: colors.secondaryText }]}>
              © OpenStreetMap contributors
            </Text>
          </View>
        )}
      </ScrollView>

      {/* ── Journey Shield (floating) ── */}
      <View style={[styles.shieldWrap, { paddingBottom: Spacing.sm }]}>
        <JourneyShield />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  content: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.screen,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    letterSpacing: 1.5,
    flex: 1,
  },

  segmented: {
    flexDirection: 'row',
    borderRadius: Radius.full,
    padding: 2,
  },
  segment: {
    paddingVertical: Spacing.xs + 2,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  mapScreen: {
    flex: 1,
  },
  controls: {
    paddingHorizontal: Spacing.screen,
    flexShrink: 0,
  },

  // Search
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.smd,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    marginBottom: Spacing.md,
  },
  searchInput: {
    ...Typography.body,
    flex: 1,
    padding: 0,
  },

  // Chips
  chipsScroll: {
    flexGrow: 0,
  },
  chipsRow: {
    gap: Spacing.sm,
    paddingBottom: Spacing.lg,
  },

  // Section
  sectionHeader: {
    gap: Spacing.xs + 2,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    letterSpacing: -0.5,
    lineHeight: 30,
  },
  sectionSubtitle: {
    ...Typography.body,
    fontSize: 14,
  },

  // Cards
  cardsList: {
    gap: Spacing.screen,
  },

  locationNote: {
    ...Typography.small,
    marginBottom: Spacing.md,
  },
  resultCount: {
    ...Typography.body,
    fontSize: 14,
    marginBottom: Spacing.md,
  },
  mapState: {
    flex: 1,
    paddingHorizontal: Spacing.screen,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingTop: Spacing.xxl,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  emptyTitle: {
    ...Typography.heading,
    textAlign: 'center' as const,
  },
  emptyBody: {
    ...Typography.body,
    textAlign: 'center' as const,
  },

  // Attribution
  attribution: {
    ...Typography.small,
    textAlign: 'center' as const,
    marginTop: Spacing.lg,
  },

  // Shield
  shieldWrap: {
    position: 'absolute',
    bottom: 0,
    left: Spacing.screen,
    right: Spacing.screen,
  },
});
