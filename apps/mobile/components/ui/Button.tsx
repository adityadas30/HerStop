import { StyleSheet, Text, TouchableOpacity, type TouchableOpacityProps } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type Variant = 'primary' | 'ghost' | 'destructive';

const DESTRUCTIVE_COLOR = '#C0392B';

interface ButtonProps extends TouchableOpacityProps {
  label: string;
  variant?: Variant;
  fullWidth?: boolean;
}

export function Button({ label, variant = 'primary', fullWidth = false, style, ...rest }: ButtonProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const isPrimary = variant === 'primary';
  const accent = variant === 'destructive' ? DESTRUCTIVE_COLOR : colors.tint;

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      style={[
        styles.base,
        fullWidth && styles.fullWidth,
        isPrimary
          ? { backgroundColor: colors.tint }
          : { backgroundColor: 'transparent', borderWidth: 1, borderColor: accent },
        style,
      ]}
      {...rest}>
      <Text
        style={[
          styles.label,
          { color: isPrimary ? '#FFFFFF' : accent },
        ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: Spacing.smd,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: {
    width: '100%',
  },
  label: {
    fontSize: 16,
    fontWeight: '600' as const,
    letterSpacing: -0.2,
    lineHeight: 22,
  },
});
