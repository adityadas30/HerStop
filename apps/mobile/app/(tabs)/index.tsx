import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolViewProps } from 'expo-symbols';

import { FilterChip } from '@/components/ui/FilterChip';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { JourneyShield } from '@/components/ui/JourneyShield';
import { StopCard, type StopData } from '@/components/ui/StopCard';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

// ---------- Mock data ----------

const FILTERS: { label: string; icon: SymbolViewProps['name'] }[] = [
  { label: 'Gas', icon: 'fuelpump.fill' },
  { label: 'Restroom', icon: 'drop.fill' },
  { label: 'Open Now', icon: 'clock.fill' },
  { label: 'Well Lit', icon: 'lightbulb.fill' },
];

const MOCK_STOPS: StopData[] = [
  {
    id: '1',
    name: 'Willow Creek Plaza',
    distance: '2.5 miles away',
    badge: 'recommended',
    imageColor: '#C9B8A8',
    tags: [
      { label: 'Well Lit', icon: 'lightbulb.fill' },
      { label: 'Clean Restroom', icon: 'sparkles' },
    ],
  },
  {
    id: '2',
    name: 'The Atlas Point',
    distance: '3.1 miles away',
    badge: 'good',
    imageColor: '#B8A898',
    tags: [
      { label: 'Staffed 24/7', icon: 'person.fill' },
      { label: 'CCTV Monitored', icon: 'video.fill' },
    ],
  },
  {
    id: '3',
    name: 'Meridian Transit Hub',
    distance: '4.8 miles away',
    badge: 'recommended',
    imageColor: '#8B9DAF',
    tags: [
      { label: 'Safety Help Point', icon: 'shield.fill' },
      { label: 'High Visibility', icon: 'lightbulb.fill' },
    ],
  },
];

// ---------- Component ----------

export default function DiscoverScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const [selectedFilters, setSelectedFilters] = useState<Set<string>>(new Set(['Gas']));

  function toggleFilter(label: string) {
    setSelectedFilters((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + Spacing.sm }]}
        showsVerticalScrollIndicator={false}>

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
          />
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
            Verified safe stops within 5 miles
          </Text>
        </View>

        {/* ── Stop cards ── */}
        <View style={styles.cardsList}>
          {MOCK_STOPS.map((stop) => (
            <StopCard key={stop.id} stop={stop} />
          ))}
        </View>
      </ScrollView>

      {/* ── Journey Shield (floating) ── */}
      <View style={[styles.shieldWrap, { paddingBottom: Spacing.sm }]}>
        <JourneyShield />
      </View>
    </View>
  );
}

// ---------- Styles ----------

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

  // Shield
  shieldWrap: {
    position: 'absolute',
    bottom: 0,
    left: Spacing.screen,
    right: Spacing.screen,
  },
});
