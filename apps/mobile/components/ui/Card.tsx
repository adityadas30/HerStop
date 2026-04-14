import { StyleSheet, View, type ViewProps } from 'react-native';

import { Colors, Radius, Shadows, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface CardProps extends ViewProps {
  padded?: boolean;
}

export function Card({ padded = true, style, children, ...rest }: CardProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <View
      style={[
        styles.card,
        Shadows.sm,
        { backgroundColor: colors.card },
        padded && styles.padded,
        style,
      ]}
      {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
  },
  padded: {
    padding: Spacing.md,
  },
});
