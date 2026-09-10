import { useRouter } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { IconSymbol } from './icon-symbol';
import { Colors, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

// A preview of the planned Journeys/route feature, surfaced on Explore.
// It does not arm, activate, or monitor anything — it just opens the Journeys tab.
export function JourneyShield() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();

  return (
    <TouchableOpacity
      testID="journey-shield-preview"
      activeOpacity={0.8}
      onPress={() => router.push('/(tabs)/journeys')}
      style={[styles.container, Shadows.lg, { backgroundColor: colors.card }]}>
      <View style={styles.textWrap}>
        <View style={styles.labelRow}>
          <Text style={[styles.label, { color: colors.tint }]}>JOURNEY SHIELD</Text>
          <View style={[styles.pill, { backgroundColor: colors.tintLight }]}>
            <Text style={[styles.pillText, { color: colors.tint }]}>COMING SOON</Text>
          </View>
        </View>
        <Text style={[styles.title, { color: colors.text }]}>Plan your route ahead of time</Text>
      </View>
      <IconSymbol name="chevron.right" size={18} color={colors.secondaryText} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.smd,
    paddingHorizontal: Spacing.screen,
    borderRadius: Radius.lg,
    gap: Spacing.smd,
  },
  textWrap: {
    flex: 1,
    gap: Spacing.xs,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
  },
  label: {
    fontSize: 10,
    fontWeight: '700' as const,
    letterSpacing: 0.8,
    lineHeight: 14,
  },
  pill: {
    paddingVertical: 2,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.full,
  },
  pillText: {
    fontSize: 9,
    fontWeight: '700' as const,
    letterSpacing: 0.5,
    lineHeight: 12,
  },
  title: {
    ...Typography.body,
    fontWeight: '500',
  },
});
