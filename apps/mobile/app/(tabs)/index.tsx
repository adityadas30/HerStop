import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FilterChip } from '@/components/ui/FilterChip';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { JourneyShield } from '@/components/ui/JourneyShield';
import { StopCard } from '@/components/ui/StopCard';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { FILTERS, MOCK_STOPS, type StopData } from '@/data/mock-stops';
import { getStopReviewStats, getStops } from '@/lib/api';
import { distanceMiles, getCurrentCoords, type Coords } from '@/lib/location';
import type { ReviewStats } from '@/lib/types';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function DiscoverScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [stops, setStops] = useState<StopData[]>(MOCK_STOPS);
  const [stats, setStats] = useState<Map<string, ReviewStats>>(new Map());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilters, setSelectedFilters] = useState<Set<string>>(new Set());
  // Null until a real device fix comes back (or permission is denied, in which
  // case it stays null forever — the list just isn't distance-sorted). Never
  // guessed, never defaulted to a fake coordinate.
  const [coords, setCoords] = useState<Coords | null>(null);

  useEffect(() => {
    getStops().then((loadedStops) => {
      setStops(loadedStops);
      // One call for every loaded stop's stats, not one call per stop.
      getStopReviewStats(loadedStops.map((s) => s.id)).then(({ stats: loadedStats }) => {
        setStats(loadedStats);
      });
    });
    getCurrentCoords().then(setCoords);
  }, []);

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
    let result = stops;

    // Search by name or address
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (s) => s.name.toLowerCase().includes(q) || s.address.toLowerCase().includes(q),
      );
    }

    // Filter by selected categories (OR logic — match any)
    if (selectedFilters.size > 0) {
      result = result.filter((s) => s.categories.some((c) => selectedFilters.has(c)));
    }

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

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + Spacing.sm }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">

        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity activeOpacity={0.6} hitSlop={8}>
            <IconSymbol name="line.3.horizontal" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>HERSTOP</Text>
          <View style={styles.headerRight}>
            <TouchableOpacity activeOpacity={0.6} hitSlop={8}>
              <IconSymbol name="map.fill" size={20} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.6} hitSlop={8}>
              <IconSymbol name="person.circle.fill" size={22} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Search bar ── */}
        <View style={[styles.searchBar, { backgroundColor: colors.surface }]}>
          <IconSymbol name="magnifyingglass" size={16} color={colors.secondaryText} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Where are you heading?"
            placeholderTextColor={colors.secondaryText}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={8}>
              <IconSymbol name="xmark" size={16} color={colors.secondaryText} />
            </TouchableOpacity>
          )}
        </View>

        {/* ── Filter chips ── */}
        <ScrollView
          horizontal
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

        {/* ── Section header ── */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Recommended near you
          </Text>
          <Text style={[styles.sectionSubtitle, { color: colors.secondaryText }]}>
            {filteredStops.length !== stops.length
              ? `${filteredStops.length} stop${filteredStops.length !== 1 ? 's' : ''} found`
              : coords
                ? 'Sorted by distance from you'
                : 'Browse stops and recent traveler feedback'}
          </Text>
        </View>

        {/* ── Stop cards ── */}
        {filteredStops.length > 0 ? (
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
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🔍</Text>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No stops found</Text>
            <Text style={[styles.emptyBody, { color: colors.secondaryText }]}>
              Try adjusting your search or filters to find stops nearby.
            </Text>
          </View>
        )}

        {/* ── OSM attribution (ODbL requires this wherever the data is shown) ── */}
        <Text style={[styles.attribution, { color: colors.secondaryText }]}>
          © OpenStreetMap contributors
        </Text>
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
    paddingHorizontal: Spacing.screen,
    paddingBottom: 100,
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
    marginLeft: Spacing.smd,
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
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

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingTop: Spacing.xxl,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: Spacing.sm,
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
