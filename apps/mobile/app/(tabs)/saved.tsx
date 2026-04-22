import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StopCard } from '@/components/ui/StopCard';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { useSavedStops } from '@/contexts/saved-stops';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function SavedScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { savedStops } = useSavedStops();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + Spacing.sm }]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Saved Stops</Text>
          {savedStops.length > 0 && (
            <Text style={[styles.subtitle, { color: colors.secondaryText }]}>
              {savedStops.length} stop{savedStops.length !== 1 ? 's' : ''} saved
            </Text>
          )}
        </View>

        {savedStops.length > 0 ? (
          <View style={styles.cardsList}>
            {savedStops.map((stop) => (
              <StopCard
                key={stop.id}
                stop={stop}
                onPress={() => router.push(`/stop/${stop.id}`)}
              />
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🔖</Text>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No saved stops yet</Text>
            <Text style={[styles.emptyBody, { color: colors.secondaryText }]}>
              Stops you bookmark will appear here so you can find them again on your next trip.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.screen,
    paddingBottom: Spacing.xxl,
  },
  header: {
    gap: Spacing.xs + 2,
    marginBottom: Spacing.md,
  },
  title: {
    ...Typography.title,
  },
  subtitle: {
    ...Typography.body,
    fontSize: 14,
  },
  cardsList: {
    gap: Spacing.screen,
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
    textAlign: 'center' as const,
  },
  emptyBody: {
    ...Typography.body,
    textAlign: 'center' as const,
  },
});
