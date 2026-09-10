import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { useAuth } from '@/contexts/auth';
import { useSavedStops } from '@/contexts/saved-stops';
import type { StopData } from '@/data/mock-stops';
import { getStopById } from '@/lib/api';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function StopDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();
  const { isGuest } = useAuth();
  const { isSaved, toggleSaved, loading: savedLoading, syncError } = useSavedStops();

  const [stop, setStop] = useState<StopData | null>(null);
  const [loading, setLoading] = useState(true);
  // Set when a guest taps save: what they wanted to save, held until they're back
  // from signing in.
  const [pendingSaveId, setPendingSaveId] = useState<string | null>(null);

  useEffect(() => {
    getStopById(id ?? '').then((s) => {
      setStop(s);
      setLoading(false);
    });
  }, [id]);

  function handleSavePress(stopId: string) {
    if (isGuest) {
      // Browsing stays open to everyone; only saving needs an account. Send them
      // to the sign-in flow on Profile and finish the save when they return.
      // `push` (not `navigate`) on purpose: it keeps this screen mounted underneath,
      // which is what lets the effect below complete the save afterwards.
      setPendingSaveId(stopId);
      router.push('/profile');
      return;
    }
    toggleSaved(stopId);
  }

  // Finish a guest's save once they're signed in — but only after their existing
  // saved list has loaded, so this save isn't overwritten by the restore.
  useEffect(() => {
    if (!pendingSaveId || isGuest || savedLoading) return;
    setPendingSaveId(null);
    if (!isSaved(pendingSaveId)) toggleSaved(pendingSaveId);
  }, [pendingSaveId, isGuest, savedLoading, isSaved, toggleSaved]);

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.tint} />
      </View>
    );
  }

  if (!stop) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Text style={[Typography.heading, { color: colors.text }]}>Stop not found</Text>
      </View>
    );
  }

  const isRecommended = stop.badge === 'recommended';

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.scrollContent}>

      {/* Image placeholder */}
      <View style={[styles.imageHero, { backgroundColor: stop.imageColor }]}>
        <IconSymbol name="photo.fill" size={32} color="rgba(255,255,255,0.3)" />

        {/* Bookmark */}
        <TouchableOpacity
          testID="stop-detail-bookmark"
          style={[styles.bookmarkBtn, { backgroundColor: colors.tint }]}
          onPress={() => handleSavePress(stop.id)}
          activeOpacity={0.7}>
          <IconSymbol
            name={isSaved(stop.id) ? 'bookmark.fill' : 'bookmark'}
            size={18}
            color="#FFFFFF"
          />
        </TouchableOpacity>
      </View>

      {/* Main info */}
      <View style={styles.body}>
        {/* Badge + distance */}
        <View style={styles.metaRow}>
          <View
            style={[
              styles.badge,
              { backgroundColor: isRecommended ? colors.tintLight : colors.surfaceAlt },
            ]}>
            <Text
              style={[
                styles.badgeText,
                { color: isRecommended ? colors.tint : colors.secondaryText },
              ]}>
              {isRecommended ? 'RECOMMENDED STOP' : 'GOOD OPTION'}
            </Text>
          </View>
          <Text style={[styles.distance, { color: colors.secondaryText }]}>{stop.distance}</Text>
        </View>

        {/* Name + address */}
        <Text style={[styles.stopName, { color: colors.text }]}>{stop.name}</Text>
        <Text style={[styles.address, { color: colors.secondaryText }]}>{stop.address}</Text>

        {syncError && (
          <Text style={[styles.syncError, { color: colors.secondaryText }]}>{syncError}</Text>
        )}

        {/* Tags */}
        <View style={styles.tagsRow}>
          {stop.tags.map((tag) => (
            <View key={tag.label} style={[styles.tag, { borderColor: colors.border }]}>
              <IconSymbol name={tag.icon} size={12} color={colors.secondaryText} />
              <Text style={[styles.tagText, { color: colors.secondaryText }]}>
                {tag.label.toUpperCase()}
              </Text>
            </View>
          ))}
        </View>

        {/* Community Score */}
        <View style={[styles.card, Shadows.sm, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Community Score</Text>
          <View style={styles.scoreRow}>
            <Text style={[styles.scoreValue, { color: colors.tint }]}>{stop.rating}</Text>
            <View style={styles.scoreDetail}>
              <Text style={[styles.scoreStars, { color: colors.tint }]}>
                {'★'.repeat(Math.round(stop.rating))}
                {'☆'.repeat(5 - Math.round(stop.rating))}
              </Text>
              <Text style={[styles.reviewCount, { color: colors.secondaryText }]}>
                {stop.reviewCount} review{stop.reviewCount !== 1 ? 's' : ''}
              </Text>
            </View>
          </View>
        </View>

        {/* Reviews placeholder */}
        <View style={[styles.card, Shadows.sm, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Traveler Reviews</Text>
          <Text style={[styles.placeholder, { color: colors.secondaryText }]}>
            Reviews from verified women travelers will appear here.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingBottom: Spacing.xxl,
  },
  imageHero: {
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookmarkBtn: {
    position: 'absolute',
    top: Spacing.smd,
    right: Spacing.smd,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    paddingHorizontal: Spacing.screen,
    paddingTop: Spacing.screen,
    gap: Spacing.smd,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.smd,
  },
  badge: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.smd,
    borderRadius: Radius.full,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
    letterSpacing: 0.6,
    lineHeight: 14,
  },
  distance: {
    ...Typography.caption,
  },
  stopName: {
    ...Typography.title,
  },
  address: {
    ...Typography.body,
    marginTop: -Spacing.xs,
  },
  syncError: {
    ...Typography.caption,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
    paddingVertical: Spacing.xs + 2,
    paddingHorizontal: Spacing.smd,
    borderRadius: Radius.xs,
    borderWidth: 1,
  },
  tagText: {
    fontSize: 10,
    fontWeight: '600' as const,
    letterSpacing: 0.5,
    lineHeight: 14,
  },
  card: {
    borderRadius: Radius.lg,
    padding: Spacing.screen,
    marginTop: Spacing.sm,
    gap: Spacing.smd,
  },
  cardTitle: {
    ...Typography.subhead,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.smd,
  },
  scoreValue: {
    fontSize: 36,
    fontWeight: '700' as const,
    letterSpacing: -1,
    lineHeight: 40,
  },
  scoreDetail: {
    gap: Spacing.xs,
  },
  scoreStars: {
    fontSize: 16,
    letterSpacing: 2,
  },
  reviewCount: {
    ...Typography.caption,
  },
  placeholder: {
    ...Typography.body,
  },
});
