import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { SymbolViewProps } from 'expo-symbols';

import { IconSymbol } from './icon-symbol';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface FilterChipProps {
  label: string;
  icon: SymbolViewProps['name'];
  selected?: boolean;
  onPress?: () => void;
}

export function FilterChip({ label, icon, selected = false, onPress }: FilterChipProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <TouchableOpacity
      testID={`filter-chip-${label}`}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      activeOpacity={0.7}
      onPress={onPress}
      style={[
        styles.chip,
        selected
          ? { backgroundColor: colors.tint }
          : { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
      ]}>
      <IconSymbol
        name={icon}
        size={14}
        color={selected ? '#FFFFFF' : colors.secondaryText}
      />
      <Text
        style={[
          styles.label,
          { color: selected ? '#FFFFFF' : colors.text },
        ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
  },
  label: {
    ...Typography.caption,
    fontWeight: '500',
  },
});
