import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function JourneysScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + Spacing.sm }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Journeys</Text>
      </View>

      {/* Planned feature preview — matches roadmap Phase 2 (route input + nearby stops) */}
      <View style={styles.previewState}>
        <View style={[styles.iconWrap, { backgroundColor: colors.surfaceAlt }]}>
          <IconSymbol name="map.fill" size={28} color={colors.tint} />
        </View>

        <View style={[styles.pill, { backgroundColor: colors.tintLight }]}>
          <Text style={[styles.pillText, { color: colors.tint }]}>COMING SOON</Text>
        </View>

        <Text style={[styles.previewTitle, { color: colors.text }]}>Route planning is on the way</Text>
        <Text style={[styles.previewBody, { color: colors.secondaryText }]}>
          Enter a route and see recommended stops for gas and restrooms mapped along the way —
          not just what&apos;s nearby right now.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.screen,
  },
  header: {
    marginBottom: Spacing.lg,
  },
  title: {
    ...Typography.title,
  },
  previewState: {
    flex: 1,
    alignItems: 'center',
    paddingTop: Spacing.xxl,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  pill: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.smd,
    borderRadius: Radius.full,
  },
  pillText: {
    fontSize: 10,
    fontWeight: '700' as const,
    letterSpacing: 0.6,
    lineHeight: 14,
  },
  previewTitle: {
    ...Typography.heading,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  previewBody: {
    ...Typography.body,
    textAlign: 'center',
  },
});
