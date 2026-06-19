import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { Ionicons } from '@expo/vector-icons';
import { Colors, spacing, useThemedStyles, useTheme } from '../../theme';
import { AppText } from '../common/AppText';
import { FoodIconThumb } from './FoodIconThumb';
import { formatServingLabel, kcalForDefaultServing } from '@reset-fitness/shared';
import { hapticWarning } from '../../lib/haptics';
import { useTranslation } from '../../stores/i18nStore';
import type { FoodRow } from '../../types/database';

const DELETE_ACTION_WIDTH = 72;

interface FoodSearchRowProps {
  food: FoodRow;
  onPress: () => void;
  onToggleFavorite?: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
  pendingApproval?: boolean;
}

export function FoodSearchRow({
  food,
  onPress,
  onToggleFavorite,
  onDelete,
  onEdit,
  pendingApproval = false,
}: FoodSearchRowProps): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();
  const swipeRef = useRef<Swipeable>(null);

  const amount = food.default_serving_grams ?? (food.serving_unit === 'unit' ? 1 : 100);
  const unit = food.serving_unit ?? 'g';
  const kcal = kcalForDefaultServing(food.kcal_100g, amount, unit);
  const portionLabel = formatServingLabel(amount, unit);

  const handleDelete = (): void => {
    hapticWarning();
    swipeRef.current?.close();
    onDelete?.();
  };

  const renderRightActions = (
    _progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>,
  ) => {
    const scale = dragX.interpolate({
      inputRange: [-DELETE_ACTION_WIDTH, 0],
      outputRange: [1, 0.85],
      extrapolate: 'clamp',
    });

    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Eliminar ${food.name}`}
        onPress={handleDelete}
        style={styles.deletePressable}
      >
        <Animated.View style={[styles.deleteAction, { transform: [{ scale }] }]}>
          <Ionicons name="trash-outline" size={22} color="#FFFFFF" />
        </Animated.View>
      </Pressable>
    );
  };

  const row = (
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
        </View>
        <AppText variant="body12" color={colors.text.tertiary} numberOfLines={1}>
          {food.brand?.trim() || 'Genérico'}
        </AppText>
        {pendingApproval ? (
          <AppText variant="body12" color={colors.states.warning}>
            {t.nutrition.pending_approval}
          </AppText>
        ) : null}
      </View>

      <View style={styles.meta}>
        <AppText variant="body13Medium" color={colors.text.primary} numberOfLines={1}>
          {portionLabel}
        </AppText>
        <AppText variant="body12" color={colors.text.tertiary} numberOfLines={1}>
          {kcal != null ? `${kcal} kcal` : '—'}
        </AppText>
      </View>

      {onEdit ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Editar ${food.name}`}
          onPress={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          hitSlop={8}
          style={styles.editBtn}
        >
          <Ionicons name="pencil-outline" size={16} color={colors.text.tertiary} />
        </Pressable>
      ) : null}

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
            color={food.is_favorite ? colors.states.error : colors.text.disabled}
          />
        </Pressable>
      ) : null}
    </Pressable>
  );

  if (!onDelete) return row;

  return (
    <Swipeable ref={swipeRef} renderRightActions={renderRightActions} overshootRight={false}>
      {row}
    </Swipeable>
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
    meta: {
      alignItems: 'flex-end',
      gap: 2,
      minWidth: 72,
    },
    starBtn: {
      paddingLeft: spacing.xxs,
    },
    editBtn: {
      paddingHorizontal: spacing.xxs,
    },
    deletePressable: {
      width: DELETE_ACTION_WIDTH,
      justifyContent: 'center',
      alignItems: 'stretch',
    },
    deleteAction: {
      flex: 1,
      backgroundColor: colors.states.error,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: spacing.sm,
      marginLeft: spacing.xs,
    },
  });
