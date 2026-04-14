import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function ProfileScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + Spacing.sm }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Profile</Text>
      </View>

      <View style={[styles.guestCard, Shadows.sm, { backgroundColor: colors.card }]}>
        <Text style={[styles.guestTitle, { color: colors.text }]}>You're browsing as a guest</Text>
        <Text style={[styles.guestBody, { color: colors.secondaryText }]}>
          Sign in to save stops and leave reviews for other travelers.
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
  guestCard: {
    borderRadius: Radius.lg,
    padding: Spacing.screen,
    gap: Spacing.xs,
  },
  guestTitle: {
    ...Typography.bodyMed,
    fontWeight: '600',
  },
  guestBody: {
    ...Typography.body,
    fontSize: 15,
    lineHeight: 22,
  },
});
