import { StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { LABEL_DISPLAY_NAME, type ScoreLabel } from '@/lib/scoring';

interface ScoreBadgeProps {
  label: ScoreLabel;
}

/**
 * The recommendation chip shown on stop cards and the stop detail screen.
 * Recommended/Good use the brand accent; Caution/Limited stay neutral gray —
 * we never want the chip's color alone to read as a safety verdict.
 */
export function ScoreBadge({ label }: ScoreBadgeProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isPositive = label === 'recommended' || label === 'good';

  return (
    <View
      style={[styles.badge, { backgroundColor: isPositive ? colors.tintLight : colors.surfaceAlt }]}>
      <Text style={[styles.text, { color: isPositive ? colors.tint : colors.secondaryText }]}>
        {LABEL_DISPLAY_NAME[label].toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.smd,
    borderRadius: Radius.full,
  },
  text: {
    fontSize: 10,
    fontWeight: '700' as const,
    letterSpacing: 0.6,
    lineHeight: 14,
  },
});
