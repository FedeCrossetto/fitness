import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Colors, radius, spacing, useThemedStyles, useTheme } from '../../theme';
import { AppText } from '../common/AppText';
import { formatPortionLabel } from './mealUiUtils';
import { NUTRITION_MACRO_COLORS } from './nutritionTheme';
import type { MacroSource, MealLogRow } from '../../types/database';

const CHECK_ON_GREEN = '#111111';

interface MealFoodRowProps {
  meal: MealLogRow;
  brand?: string | null;
  onPress: () => void;
  onToggleIncluded: () => void;
}

function sourcePlaceholder(source: MacroSource | null): keyof typeof Ionicons.glyphMap {
  switch (source) {
    case 'openfoodfacts':
    case 'barcode':
      return 'barcode-outline';
    case 'voice':
      return 'mic-outline';
    case 'user_food':
    case 'catalog':
      return 'bookmark-outline';
    default:
      return 'restaurant-outline';
  }
}

export function MealFoodRow({ meal, brand, onPress, onToggleIncluded }: MealFoodRowProps): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  const title = meal.title ?? meal.product_display_name ?? 'Comida';
  const subtitle = brand?.trim() || (meal.macro_source === 'openfoodfacts' ? 'Open Food Facts' : 'Manual');
  const kcal = Math.round(meal.energy_kcal ?? 0);
  const portion = formatPortionLabel(meal.portion_grams);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Editar ${title}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, !meal.is_included && styles.excluded, pressed && styles.pressed]}
    >
      <View style={styles.thumbWrap}>
        {meal.photo_url ? (
          <Image source={{ uri: meal.photo_url }} style={styles.thumb} contentFit="cover" />
        ) : (
          <View style={styles.thumbPlaceholder}>
            <Ionicons name={sourcePlaceholder(meal.macro_source)} size={15} color={colors.text.tertiary} />
          </View>
        )}
      </View>

      <View style={styles.main}>
        <AppText variant="body13SemiBold" color={colors.text.primary} numberOfLines={1}>
          {title}
        </AppText>
        <AppText variant="body12" color={colors.text.tertiary} numberOfLines={1} style={styles.subtitle}>
          {subtitle}
        </AppText>
      </View>

      <View style={styles.meta}>
        <AppText variant="body12Medium" color={colors.text.primary} numberOfLines={1}>
          {portion}
        </AppText>
        <AppText variant="body12" color={colors.text.tertiary} numberOfLines={1}>
          {kcal} kcal
        </AppText>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={meal.is_included ? 'Excluir de los totales' : 'Incluir en los totales'}
        onPress={(e) => {
          e.stopPropagation();
          onToggleIncluded();
        }}
        hitSlop={10}
        style={styles.checkWrap}
      >
        <View style={[styles.checkCircle, meal.is_included && styles.checkCircleActive]}>
          {meal.is_included ? <Ionicons name="checkmark" size={9} color={CHECK_ON_GREEN} /> : null}
        </View>
      </Pressable>
    </Pressable>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingVertical: 6,
    },
    excluded: { opacity: 0.5 },
    pressed: { opacity: 0.75 },
    thumbWrap: {
      width: 36,
      height: 36,
      borderRadius: radius.sm,
      overflow: 'hidden',
    },
    thumb: {
      width: '100%',
      height: '100%',
    },
    thumbPlaceholder: {
      flex: 1,
      backgroundColor: colors.surface.elevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    main: {
      flex: 1,
      gap: 0,
      minWidth: 0,
    },
    subtitle: {
      lineHeight: 15,
    },
    meta: {
      alignItems: 'flex-end',
      gap: 0,
      minWidth: 64,
    },
    checkWrap: {
      paddingLeft: 2,
    },
    checkCircle: {
      width: 16,
      height: 16,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.border.default,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface.base,
    },
    checkCircleActive: {
      backgroundColor: NUTRITION_MACRO_COLORS.carbs,
      borderColor: NUTRITION_MACRO_COLORS.carbs,
    },
  });
