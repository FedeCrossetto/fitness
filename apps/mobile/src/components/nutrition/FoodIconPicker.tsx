import React from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Colors, radius, spacing, useThemedStyles, useTheme } from '../../theme';
import { AppText } from '../common/AppText';
import { DEFAULT_FOOD_ICON_KEY, FOOD_ICON_ITEMS, getFoodIconSource, type FoodIconKey } from './foodIconCatalog';

interface FoodIconPickerProps {
  value: FoodIconKey;
  onChange: (key: FoodIconKey) => void;
}

const ICON_CELL = 56;

export function FoodIconPicker({ value, onChange }: FoodIconPickerProps): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {FOOD_ICON_ITEMS.map((item) => {
        const active = value === item.key;
        return (
          <Pressable
            key={item.key}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={item.label}
            onPress={() => onChange(item.key)}
            style={({ pressed }) => [
              styles.cell,
              active && styles.cellActive,
              pressed && styles.pressed,
            ]}
          >
            <Image source={getFoodIconSource(item.key)} style={styles.icon} contentFit="cover" />
            <AppText
              variant="body12"
              color={active ? colors.primary.default : colors.text.tertiary}
              numberOfLines={1}
              align="center"
            >
              {item.label}
            </AppText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export { DEFAULT_FOOD_ICON_KEY };

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    row: {
      gap: spacing.sm,
      paddingVertical: spacing.xxs,
    },
    cell: {
      width: ICON_CELL + 8,
      alignItems: 'center',
      gap: 4,
      padding: spacing.xxs,
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderColor: 'transparent',
    },
    cellActive: {
      borderColor: colors.primary.default,
      backgroundColor: colors.primary.muted,
    },
    pressed: { opacity: 0.85 },
    icon: {
      width: ICON_CELL,
      height: ICON_CELL,
      borderRadius: radius.sm,
    },
  });
