import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, spacing, useThemedStyles, useTheme } from '../../theme';
import { AppText } from '../common/AppText';
import { FoodIconThumb } from './FoodIconThumb';
import { formatServingLabel, kcalForDefaultServing } from '@reset-fitness/shared';
import type { TrainerFoodRow } from '../../types/database';

interface CatalogFoodRowProps {
  food: TrainerFoodRow;
  onPress: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
}

export function CatalogFoodRow({
  food,
  onPress,
  isFavorite = false,
  onToggleFavorite,
}: CatalogFoodRowProps): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  const amount = food.default_serving_grams ?? (food.serving_unit === 'unit' ? 1 : 100);
  const unit = food.serving_unit ?? 'g';
  const kcal = kcalForDefaultServing(food.kcal_100g, amount, unit);
  const portionLabel = formatServingLabel(amount, unit);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Elegir ${food.name}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <FoodIconThumb iconKey={food.icon_key} size={44} />

      <View style={styles.main}>
        <View style={styles.titleRow}>
          <AppText variant="body14SemiBold" color={colors.text.primary} numberOfLines={1} style={styles.title}>
            {food.name}
          </AppText>
          <View style={styles.badge}>
            <Ionicons name="shield-checkmark-outline" size={10} color={colors.primary.onText} />
          </View>
        </View>
        <AppText variant="body12" color={colors.text.tertiary} numberOfLines={1}>
          {food.brand?.trim() || 'Catálogo del entrenador'}
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
          accessibilityLabel={isFavorite ? 'Quitar de favoritos' : 'Marcar como favorito'}
          onPress={(e) => {
            e.stopPropagation();
            onToggleFavorite();
          }}
          hitSlop={8}
          style={styles.starBtn}
        >
          <Ionicons
            name={isFavorite ? 'heart' : 'heart-outline'}
            size={18}
            color={isFavorite ? colors.states.error : colors.text.disabled}
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
    badge: {
      width: 16,
      height: 16,
      borderRadius: 999,
      backgroundColor: colors.primary.default,
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
