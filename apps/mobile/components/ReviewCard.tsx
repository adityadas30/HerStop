import { ActionSheetIOS, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { IconSymbol } from './ui/icon-symbol';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { Review } from '@/lib/types';

interface ReviewCardProps {
  review: Review;
  /** True when this traveler wrote or edited this review earlier in the current app session. */
  justReviewedThisSession: boolean;
  onReport: () => void;
  onHide: () => void;
}

const TIME_OF_VISIT_LABEL: Record<Review['time_of_visit'], string> = {
  day: 'Day',
  night: 'Night',
  unknown: 'Time not specified',
};

const LOITERING_LABEL: Record<Review['loitering_concern'], string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

/** "2026-09-01" (month-precision, per privacy rule) -> "Sep 2026". UTC on purpose —
 * the date has no real day/time component, so a local-timezone read could shift it
 * into the wrong month. */
function formatMonth(createdMonth: string): string {
  const date = new Date(createdMonth);
  const month = date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
  return `${month} ${date.getUTCFullYear()}`;
}

/** One traveler's structured review, shown on the stop detail screen. */
export function ReviewCard({ review, justReviewedThisSession, onReport, onHide }: ReviewCardProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  function openMenu() {
    ActionSheetIOS.showActionSheetWithOptions(
      { options: ['Report review', 'Hide this review', 'Cancel'], cancelButtonIndex: 2 },
      (buttonIndex) => {
        if (buttonIndex === 0) onReport();
        else if (buttonIndex === 1) onHide();
      },
    );
  }

  return (
    <View style={[styles.card, { borderColor: colors.border }]}>
      <View style={styles.topRow}>
        <View style={[styles.timeChip, { backgroundColor: colors.surfaceAlt }]}>
          <Text style={[styles.timeChipText, { color: colors.secondaryText }]}>
            {TIME_OF_VISIT_LABEL[review.time_of_visit]}
          </Text>
        </View>
        <Text style={[styles.stars, { color: colors.tint }]}>
          {'★'.repeat(review.overall_feeling)}
          {'☆'.repeat(5 - review.overall_feeling)}
        </Text>
        <View style={{ flex: 1 }} />
        {!review.is_mine && (
          <TouchableOpacity testID={`review-menu-${review.id}`} hitSlop={8} onPress={openMenu}>
            <IconSymbol name="ellipsis" size={18} color={colors.secondaryText} />
          </TouchableOpacity>
        )}
      </View>

      <Text style={[styles.detailLine, { color: colors.secondaryText }]}>
        Would stop again: {review.would_stop_again ? 'Yes' : 'No'}
      </Text>
      <Text style={[styles.detailLine, { color: colors.secondaryText }]}>
        Loitering concern: {LOITERING_LABEL[review.loitering_concern]}
      </Text>

      {review.note && <Text style={[styles.note, { color: colors.text }]}>{review.note}</Text>}

      <View style={styles.footerRow}>
        <Text style={[styles.month, { color: colors.secondaryText }]}>
          {formatMonth(review.created_month)}
        </Text>
        {review.is_mine && (
          <Text style={[styles.mineTag, { color: colors.tint }]}>Your review</Text>
        )}
      </View>

      {review.is_mine && review.is_hidden && (
        <Text style={[styles.noteBelow, { color: colors.secondaryText }]}>
          Hidden after a report — only you can see it.
        </Text>
      )}
      {review.is_mine && !review.is_hidden && justReviewedThisSession && (
        <Text style={[styles.noteBelow, { color: colors.secondaryText }]}>
          Visible to other travelers 24 hours after posting.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.xs + 2,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.smd,
  },
  timeChip: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.full,
  },
  timeChipText: {
    ...Typography.small,
  },
  stars: {
    fontSize: 14,
    letterSpacing: 1,
  },
  detailLine: {
    ...Typography.caption,
  },
  note: {
    ...Typography.body,
    fontSize: 14,
    marginTop: Spacing.xs,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.xs,
  },
  month: {
    ...Typography.small,
  },
  mineTag: {
    ...Typography.small,
    fontWeight: '600' as const,
  },
  noteBelow: {
    ...Typography.small,
    fontStyle: 'italic' as const,
  },
});
