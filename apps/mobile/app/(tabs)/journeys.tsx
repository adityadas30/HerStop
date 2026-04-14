import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Spacing, Typography } from '@/constants/theme';
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

      <View style={styles.emptyState}>
        <Text style={styles.emptyIcon}>🛣️</Text>
        <Text style={[styles.emptyTitle, { color: colors.text }]}>No journeys yet</Text>
        <Text style={[styles.emptyBody, { color: colors.secondaryText }]}>
          Plan a trip to see your route with recommended stops along the way.
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
  emptyState: {
    flex: 1,
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
    textAlign: 'center',
  },
  emptyBody: {
    ...Typography.body,
    textAlign: 'center',
  },
});
