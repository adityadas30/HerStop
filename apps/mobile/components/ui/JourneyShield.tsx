import { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { Colors, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function JourneyShield() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [enabled, setEnabled] = useState(true);

  return (
    <View style={[styles.container, Shadows.lg, { backgroundColor: colors.card }]}>
      <View style={styles.textWrap}>
        <Text style={[styles.label, { color: colors.tint }]}>JOURNEY SHIELD</Text>
        <Text style={[styles.title, { color: colors.text }]}>Active Monitoring</Text>
      </View>
      <Switch
        value={enabled}
        onValueChange={setEnabled}
        trackColor={{ false: colors.border, true: colors.tint }}
        thumbColor="#FFFFFF"
      />
    </View>
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
    gap: 2,
  },
  label: {
    fontSize: 10,
    fontWeight: '700' as const,
    letterSpacing: 0.8,
    lineHeight: 14,
  },
  title: {
    ...Typography.body,
    fontWeight: '500',
  },
});
