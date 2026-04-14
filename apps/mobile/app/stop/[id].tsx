import { useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function StopDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}>
      {/* Stop identity */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.stopName, { color: colors.text }]}>Stop #{id}</Text>
        <Text style={[styles.stopMeta, { color: colors.secondaryText }]}>
          Details coming soon
        </Text>
      </View>

      {/* Score placeholder */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Community Score</Text>
        <Text style={[styles.placeholder, { color: colors.secondaryText }]}>
          Score and review data will appear here.
        </Text>
      </View>

      {/* Reviews placeholder */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Traveler Reviews</Text>
        <Text style={[styles.placeholder, { color: colors.secondaryText }]}>
          No reviews yet for this stop.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.md,
    gap: Spacing.md,
  },
  card: {
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
  },
  stopName: {
    ...Typography.heading,
    fontSize: 22,
    marginBottom: Spacing.xs,
  },
  stopMeta: {
    ...Typography.caption,
    fontSize: 14,
  },
  sectionTitle: {
    ...Typography.bodyMed,
    fontWeight: '600',
    fontSize: 17,
    marginBottom: Spacing.sm,
  },
  placeholder: {
    ...Typography.body,
    fontSize: 15,
    lineHeight: 22,
  },
});
