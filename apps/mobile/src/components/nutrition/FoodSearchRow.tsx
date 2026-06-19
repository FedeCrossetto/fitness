import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, radius, spacing, useThemedStyles, useTheme } from '../../theme';
import { AppText } from '../common/AppText';
import type { FoodRow } from '../../types/database';

interface FoodSearchRowProps {
  food: FoodRow;
  onPress: () => void;
  onToggleFavorite?: () => void;
}

export function FoodSearchRow({ food, onPress, onToggleFavorite }: FoodSearchRowProps): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  const grams = food.default_serving_grams ?? 100;
  const kcal =
    food.kcal_100g != null ? Math.round((food.kcal_100g * grams) / 100) : null;
  const portionLabel = `${Math.round(grams)} g`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Elegir ${food.name}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.thumb}>
        <Ionicons
          name={food.openfoodfacts_code ? 'barcode-outline' : 'restaurant-outline'}
          size={18}
          color={colors.text.tertiary}
        />
      </View>

      <View style={styles.main}>
        <View style={styles.titleRow}>
          <AppText variant="body14SemiBold" color={colors.text.primary} numberOfLines={1} style={styles.title}>
            {food.name}
          </AppText>
          {food.openfoodfacts_code ? (
            <View style={styles.verified}>
              <Ionicons name="checkmark" size={10} color={colors.primary.onText} />
            </View>
          ) : null}
        </View>
        <AppText variant="body12" color={colors.text.tertiary} numberOfLines={1}>
          {food.brand?.trim() || 'Genérico'}
        </AppText>
      </View>

      <View style={styles.meta}>
        <AppText variant="body13Medium" color={colors.text.primary} numberOfLines={1}>
          {portionLabel}
        </AppText>
        <AppText variant="body12" color={colors.text.tertiary} numberOfLines={1}>
          {kcal != null ? `${kcal} kcal` : '—'}
        </AppText>
      </View>

      {onToggleFavorite ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={food.is_favorite ? 'Quitar de favoritos' : 'Marcar como favorito'}
          onPress={(e) => {
            e.stopPropagation();
            onToggleFavorite();
          }}
          hitSlop={8}
          style={styles.starBtn}
        >
          <Ionicons
            name={food.is_favorite ? 'heart' : 'heart-outline'}
            size={18}
            color={food.is_favorite ? colors.primary.default : colors.text.disabled}
          />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
    },
    pressed: { opacity: 0.75 },
    thumb: {
      width: 44,
      height: 44,
      borderRadius: radius.md,
      backgroundColor: colors.surface.elevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    main: {
      flex: 1,
      gap: 2,
      minWidth: 0,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xxs,
    },
    title: { flexShrink: 1 },
    verified: {
      width: 16,
      height: 16,
      borderRadius: radius.pill,
      backgroundColor: colors.text.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    meta: {
      alignItems: 'flex-end',
      gap: 2,
      minWidth: 72,
    },
    starBtn: {
      paddingLeft: spacing.xxs,
    },
  });
