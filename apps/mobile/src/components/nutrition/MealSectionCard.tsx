import React, { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, radius, spacing, useThemedStyles, useTheme } from '../../theme';
import { AppText } from '../common/AppText';
import { MealFoodRow } from './MealFoodRow';
import { computeSectionTotals, formatMacroSummaryLine } from './mealUiUtils';
import { nutritionCardStyle } from './nutritionTheme';
import { useTranslation } from '../../stores/i18nStore';
import type { FoodRow, MealLogRow, MealType } from '../../types/database';

interface MealSectionCardProps {
  title: string;
  mealType: MealType;
  meals: MealLogRow[];
  myFoods: FoodRow[];
  readOnly?: boolean;
  onAdd: () => void;
  onMenuPress: () => void;
  onEditMeal: (meal: MealLogRow) => void;
  onToggleIncluded: (mealId: string) => void;
  onDeleteMeal: (mealId: string) => void;
}

export function MealSectionCard({
  title,
  readOnly = false,
  onAdd,
  onMenuPress,
  onEditMeal,
  onToggleIncluded,
  onDeleteMeal,
  meals,
  myFoods,
}: MealSectionCardProps): React.JSX.Element {
  const { colors, isDark } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();

  const totals = useMemo(() => computeSectionTotals(meals), [meals]);
  const brandByFoodId = useMemo(() => new Map(myFoods.map((f) => [f.id, f.brand])), [myFoods]);
  const iconKeyByFoodId = useMemo(() => new Map(myFoods.map((f) => [f.id, f.icon_key])), [myFoods]);

  return (
    <View style={[styles.card, nutritionCardStyle(colors, isDark)]}>
      <View style={styles.header}>
        <AppText variant="body16SemiBold" color={colors.text.primary}>
          {title}
        </AppText>
        {!readOnly ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t.nutrition.meal_actions_subtitle}
            onPress={onMenuPress}
            hitSlop={8}
            style={({ pressed }) => [styles.menuBtn, pressed && styles.menuBtnPressed]}
          >
            <Ionicons name="ellipsis-horizontal" size={18} color={colors.text.secondary} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.summaryRow}>
        <Ionicons name="flame" size={14} color={colors.text.tertiary} />
        <AppText variant="body13" color={colors.text.secondary}>
          {formatMacroSummaryLine(totals)}
        </AppText>
      </View>

      {meals.length > 0 ? (
        <View style={styles.itemsBlock}>
          {meals.map((meal, index) => (
            <View key={meal.id}>
              {index > 0 ? <View style={styles.divider} /> : null}
              <MealFoodRow
                meal={meal}
                brand={meal.food_id ? brandByFoodId.get(meal.food_id) : null}
                iconKey={meal.icon_key ?? (meal.food_id ? iconKeyByFoodId.get(meal.food_id) : null)}
                readOnly={readOnly}
                onPress={() => onEditMeal(meal)}
                onToggleIncluded={() => onToggleIncluded(meal.id)}
                onDelete={() => onDeleteMeal(meal.id)}
              />
            </View>
          ))}
        </View>
      ) : null}

      {!readOnly ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Agregar a ${title}`}
          onPress={onAdd}
          style={({ pressed }) => [styles.addBtn, pressed && styles.addBtnPressed]}
        >
          <Ionicons name="add" size={22} color={colors.text.secondary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    card: {
      borderRadius: radius.lg,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
      gap: spacing.sm,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    menuBtn: {
      width: 32,
      height: 32,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface.elevated,
    },
    menuBtnPressed: { opacity: 0.75 },
    summaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xxs,
    },
    itemsBlock: {
      marginTop: spacing.xxs,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border.subtle,
    },
    addBtn: {
      marginTop: spacing.xxs,
      height: 44,
      borderRadius: radius.md,
      backgroundColor: colors.surface.elevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addBtnPressed: { opacity: 0.8 },
  });
