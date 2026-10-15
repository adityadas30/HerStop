import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { IconSymbol } from './icon-symbol';
import { Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface StarRatingInputProps {
  /** 1-5, or undefined when the traveler hasn't picked a value yet. */
  value: number | undefined;
  onChange: (next: number) => void;
}

const STARS = [1, 2, 3, 4, 5];

/** A row of five tappable stars, reused for each 1-5 rating on the review form. */
export function StarRatingInput({ value, onChange }: StarRatingInputProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <View style={styles.row}>
      {STARS.map((star) => (
        <TouchableOpacity key={star} hitSlop={6} onPress={() => onChange(star)} activeOpacity={0.7}>
          <IconSymbol
            name={value !== undefined && star <= value ? 'star.fill' : 'star'}
            size={26}
            color={value !== undefined && star <= value ? colors.tint : colors.secondaryText}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
});
