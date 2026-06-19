import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, radius, spacing, useThemedStyles, useTheme } from '../../theme';
import { AppText } from '../common/AppText';

interface FoodSearchBarProps {
  placeholder: string;
  onPress: () => void;
}

export function FoodSearchBar({ placeholder, onPress }: FoodSearchBarProps): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={placeholder}
      onPress={onPress}
      style={({ pressed }) => [styles.bar, pressed && styles.pressed]}
    >
      <Ionicons name="search-outline" size={20} color={colors.text.tertiary} />
      <AppText variant="body14" color={colors.text.tertiary} style={styles.label}>
        {placeholder}
      </AppText>
    </Pressable>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    bar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      height: 48,
      paddingHorizontal: spacing.md,
      borderRadius: radius.lg,
      backgroundColor: colors.surface.base,
      borderWidth: 1,
      borderColor: colors.border.subtle,
    },
    label: { flex: 1 },
    pressed: { opacity: 0.75 },
  });
