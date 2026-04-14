import { StyleSheet, Text, View, type ViewProps } from 'react-native';

import { Colors, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface SectionProps extends ViewProps {
  title?: string;
}

export function Section({ title, style, children, ...rest }: SectionProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <View style={[styles.section, style]} {...rest}>
      {title ? (
        <Text style={[styles.title, { color: colors.secondaryText }]}>{title.toUpperCase()}</Text>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.sm,
  },
  title: {
    ...Typography.label,
  },
});
