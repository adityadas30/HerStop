import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StopCard } from '@/components/ui/StopCard';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { useAuth } from '@/contexts/auth';
import { useSavedStops } from '@/contexts/saved-stops';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function SavedScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isGuest } = useAuth();
  const { savedStops, loading, syncError } = useSavedStops();

  const hasStops = savedStops.length > 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + Spacing.sm }]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Saved Stops</Text>
          {hasStops && (
            <Text style={[styles.subtitle, { color: colors.secondaryText }]}>
              {savedStops.length} stop{savedStops.length !== 1 ? 's' : ''} saved
            </Text>
          )}
        </View>

        {syncError && (
          <Text style={[styles.syncError, { color: colors.secondaryText }]}>{syncError}</Text>
        )}

        {/* Signed out: invite sign-in, but never block browsing. Anything saved
            as a guest still shows below — it just doesn't outlive the session. */}
        {isGuest && (
          <Card style={styles.signInCard}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              {hasStops ? 'Keep these stops' : 'Save stops for later'}
            </Text>
            <Text style={[styles.cardBody, { color: colors.secondaryText }]}>
              {hasStops
                ? 'Sign in to keep these stops after you close the app, and to reach them from any device.'
                : 'Bookmark a stop while you browse. Sign in to keep your list across trips and devices.'}
            </Text>
            <Button
              label="Sign in"
              onPress={() => router.push('/profile')}
              style={styles.actionButton}
            />
          </Card>
        )}

        {loading && !hasStops ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color={colors.tint} />
          </View>
        ) : hasStops ? (
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
          !isGuest && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🔖</Text>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No saved stops yet</Text>
              <Text style={[styles.emptyBody, { color: colors.secondaryText }]}>
                Stops you bookmark will appear here so you can find them again on your next trip.
              </Text>
            </View>
          )
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
  syncError: {
    ...Typography.caption,
    marginBottom: Spacing.sm,
  },
  signInCard: {
    padding: Spacing.screen,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  cardTitle: {
    ...Typography.bodyMed,
    fontWeight: '600',
  },
  cardBody: {
    ...Typography.body,
    lineHeight: 22,
  },
  actionButton: {
    marginTop: Spacing.xs,
  },
  loadingState: {
    paddingTop: Spacing.xl,
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
