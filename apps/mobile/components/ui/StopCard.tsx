import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { IconSymbol } from './icon-symbol';
import { ScoreBadge } from './ScoreBadge';
import { Colors, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { useSavedStops } from '@/contexts/saved-stops';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { StopData } from '@/data/mock-stops';
import { reviewCountLabel, scoreStop } from '@/lib/scoring';
import type { ReviewStats } from '@/lib/types';

export type { StopData };

interface StopCardProps {
  stop: StopData;
  /** This stop's aggregate review stats. Omit (or undefined) shows Limited Data,
   * which is what a screen that hasn't fetched stats yet should pass. */
  stats?: ReviewStats;
  onPress?: () => void;
}

export function StopCard({ stop, stats, onPress }: StopCardProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { isSaved, toggleSaved } = useSavedStops();
  const bookmarked = isSaved(stop.id);

  const { label } = scoreStop(stats);

  return (
    <TouchableOpacity testID={`stop-card-${stop.id}`} activeOpacity={0.95} onPress={onPress}>
      <View style={[styles.card, Shadows.md, { backgroundColor: colors.card }]}>
        {/* Image placeholder */}
        <View style={[styles.image, { backgroundColor: stop.imageColor }]}>
          <IconSymbol name="photo.fill" size={28} color="rgba(255,255,255,0.3)" />

          {/* Bookmark */}
          <TouchableOpacity
            testID={`stop-card-bookmark-${stop.id}`}
            style={[styles.bookmarkBtn, { backgroundColor: colors.tint }]}
            onPress={() => toggleSaved(stop.id)}
            activeOpacity={0.7}>
            <IconSymbol
              name={bookmarked ? 'bookmark.fill' : 'bookmark'}
              size={16}
              color="#FFFFFF"
            />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View style={styles.content}>
          {/* Badge + review count */}
          <View style={styles.metaRow}>
            <ScoreBadge label={label} />
            <Text style={[styles.reviewLine, { color: colors.secondaryText }]}>
              {reviewCountLabel(stats?.review_count ?? 0)}
            </Text>
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
            {stop.name}
          </Text>

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
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
  },
  image: {
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
  },
  bookmarkBtn: {
    position: 'absolute',
    top: Spacing.smd,
    right: Spacing.smd,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: Spacing.screen,
    gap: Spacing.smd,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reviewLine: {
    ...Typography.caption,
  },
  title: {
    ...Typography.subhead,
    fontSize: 19,
    letterSpacing: -0.3,
    lineHeight: 24,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
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
});
