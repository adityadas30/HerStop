import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function OnboardingScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  function handleGetStarted() {
    router.replace('/(tabs)');
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <Text style={styles.logo}>📍</Text>
        <Text style={[styles.appName, { color: colors.tint }]}>HerStop</Text>
        <Text style={[styles.headline, { color: colors.text }]}>
          Find better stops.{'\n'}Travel with more confidence.
        </Text>
        <Text style={[styles.body, { color: colors.secondaryText }]}>
          Discover gas stations and rest stops along your route — reviewed by women, for women driving alone.
        </Text>
      </View>

      <View style={styles.footer}>
        <Button label="Get Started" variant="primary" fullWidth onPress={handleGetStarted} />
        <Text style={[styles.disclaimer, { color: colors.secondaryText }]}>
          HerStop provides decision support — not safety guarantees.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.screen + 8,
    paddingTop: Spacing.xxl + Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
  },
  logo: {
    fontSize: 56,
    marginBottom: Spacing.sm,
  },
  appName: {
    ...Typography.display,
    fontSize: 38,
  },
  headline: {
    ...Typography.title,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  body: {
    ...Typography.body,
    textAlign: 'center',
    maxWidth: 320,
  },
  footer: {
    gap: Spacing.md,
    alignItems: 'center',
  },
  disclaimer: {
    ...Typography.caption,
    textAlign: 'center',
  },
});
