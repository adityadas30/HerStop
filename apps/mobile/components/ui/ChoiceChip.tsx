import { StyleSheet, Text, TouchableOpacity } from 'react-native';

import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface ChoiceChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

/** A single-select text pill — used in the review form for loitering concern,
 * would-stop-again, and time-of-visit. Like FilterChip but no icon, since
 * these options don't have one. */
export function ChoiceChip({ label, selected, onPress }: ChoiceChipProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={[
        styles.chip,
        selected
          ? { backgroundColor: colors.tint }
          : { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
      ]}>
      <Text style={[styles.label, { color: selected ? '#FFFFFF' : colors.text }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
  },
  label: {
    ...Typography.caption,
    fontWeight: '500' as const,
  },
});
