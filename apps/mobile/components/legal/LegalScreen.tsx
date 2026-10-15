import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import type { LegalDocument } from '@/constants/legal-content';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { backAction } from '@/lib/back-navigation';

/** Scrolling read-only text screen shared by Privacy, Support and Safety Disclosure. */
export function LegalScreen({ document }: { document: LegalDocument }) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // A back control that always works, in addition to the header's back
  // button: if this screen has nothing underneath it, go to Profile (where the
  // legal links live) instead of doing nothing.
  function handleBackPress() {
    const action = backAction(router.canGoBack(), '/(tabs)/profile');
    if (action.type === 'back') router.back();
    else router.replace(action.href);
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + Spacing.xl },
      ]}>
      {document.intro && (
        <Text style={[styles.body, { color: colors.secondaryText }]}>{document.intro}</Text>
      )}
      {document.sections.map((section) => (
        <View key={section.heading} style={styles.section}>
          <Text style={[styles.heading, { color: colors.text }]}>{section.heading}</Text>
          {section.paragraphs.map((paragraph) => (
            <Text key={paragraph} style={[styles.body, { color: colors.text }]}>
              {paragraph}
            </Text>
          ))}
        </View>
      ))}
      <Button
        testID="legal-back"
        accessibilityRole="button"
        accessibilityLabel="Go back"
        label="Back"
        variant="ghost"
        onPress={handleBackPress}
        fullWidth
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.screen,
    gap: Spacing.lg,
  },
  section: {
    gap: Spacing.sm,
  },
  heading: {
    ...Typography.subhead,
  },
  body: {
    ...Typography.body,
  },
});
