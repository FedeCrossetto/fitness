import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { Ionicons } from '@expo/vector-icons';
import { Colors, radius, spacing, useThemedStyles, useTheme } from '../../theme';
import { AppText } from '../common/AppText';
import { formatPortionLabel } from './mealUiUtils';
import { FoodIconThumb } from './FoodIconThumb';
import { NUTRITION_MACRO_COLORS } from './nutritionTheme';
import { hapticMedium, hapticWarning } from '../../lib/haptics';
import type { MealLogRow } from '../../types/database';

const CHECK_ON_GREEN = '#111111';
const DELETE_ACTION_WIDTH = 72;

interface MealFoodRowProps {
  meal: MealLogRow;
  brand?: string | null;
  iconKey?: string | null;
  onPress: () => void;
  onToggleIncluded: () => void;
  onDelete: () => void;
}

export function MealFoodRow({
  meal,
  brand,
  iconKey,
  onPress,
  onToggleIncluded,
  onDelete,
}: MealFoodRowProps): React.JSX.Element {
  const { colors, isDark } = useTheme();
  const styles = useThemedStyles(createStyles);
  const swipeRef = useRef<Swipeable>(null);

  const title = meal.title ?? meal.product_display_name ?? 'Comida';
  const subtitle = brand?.trim() || (meal.macro_source === 'openfoodfacts' ? 'Open Food Facts' : 'Manual');
  const kcal = Math.round(meal.energy_kcal ?? 0);
  const portion = formatPortionLabel(meal.portion_grams, meal.portion_unit);
  const rowBackground = isDark ? colors.surface.elevated : colors.surface.base;

  const handleToggle = (): void => {
    onToggleIncluded();
  };

  const handleDelete = (): void => {
    hapticWarning();
    swipeRef.current?.close();
    onDelete();
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
        accessibilityLabel={`Eliminar ${title}`}
        onPress={handleDelete}
        style={styles.deletePressable}
      >
        <Animated.View style={[styles.deleteAction, { transform: [{ scale }] }]}>
          <Ionicons name="trash-outline" size={22} color="#FFFFFF" />
        </Animated.View>
      </Pressable>
    );
  };

  return (
    <Swipeable
      ref={swipeRef}
      renderRightActions={renderRightActions}
      overshootRight={false}
      friction={2}
      rightThreshold={40}
      activeOffsetX={[-20, 20]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Editar ${title}`}
        onPress={onPress}
        style={({ pressed }) => [
          styles.row,
          { backgroundColor: rowBackground },
          !meal.is_included && styles.excluded,
          pressed && styles.pressed,
        ]}
      >
        <FoodIconThumb iconKey={iconKey ?? meal.icon_key} remoteUrl={meal.photo_url} size={36} />

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
          onPressIn={() => hapticMedium()}
          onPress={(e) => {
            e.stopPropagation();
            handleToggle();
          }}
          hitSlop={10}
          style={styles.checkWrap}
        >
          <View style={[styles.checkCircle, meal.is_included && styles.checkCircleActive]}>
            {meal.is_included ? <Ionicons name="checkmark" size={9} color={CHECK_ON_GREEN} /> : null}
          </View>
        </Pressable>
      </Pressable>
    </Swipeable>
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
    deletePressable: {
      width: DELETE_ACTION_WIDTH,
      marginLeft: spacing.xxs,
    },
    deleteAction: {
      flex: 1,
      backgroundColor: colors.states.error,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
