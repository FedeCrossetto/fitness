import React, { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, radius, spacing, useThemedStyles, useTheme } from '../../theme';
import { AppText } from '../common/AppText';
import { MealFoodRow } from './MealFoodRow';
import { computeSectionTotals, formatMacroSummaryLine } from './mealUiUtils';
import { nutritionCardStyle } from './nutritionTheme';
import type { FoodRow, MealLogRow, MealType } from '../../types/database';

interface MealSectionCardProps {
  title: string;
  mealType: MealType;
  meals: MealLogRow[];
  myFoods: FoodRow[];
  onAdd: () => void;
  onEditMeal: (meal: MealLogRow) => void;
  onToggleIncluded: (mealId: string) => void;
}

export function MealSectionCard({
  title,
  meals,
  myFoods,
  onAdd,
  onEditMeal,
  onToggleIncluded,
}: MealSectionCardProps): React.JSX.Element {
  const { colors, isDark } = useTheme();
  const styles = useThemedStyles(createStyles);

  const totals = useMemo(() => computeSectionTotals(meals), [meals]);
  const brandByFoodId = useMemo(() => new Map(myFoods.map((f) => [f.id, f.brand])), [myFoods]);

  return (
    <View style={[styles.card, nutritionCardStyle(colors, isDark)]}>
      <View style={styles.header}>
        <AppText variant="body16SemiBold" color={colors.text.primary}>
          {title}
        </AppText>
        <Ionicons name="nutrition-outline" size={16} color={colors.text.disabled} />
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
                onPress={() => onEditMeal(meal)}
                onToggleIncluded={() => onToggleIncluded(meal.id)}
              />
            </View>
          ))}
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Agregar a ${title}`}
        onPress={onAdd}
        style={({ pressed }) => [styles.addBtn, pressed && styles.addBtnPressed]}
      >
        <Ionicons name="add" size={22} color={colors.text.secondary} />
      </Pressable>
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
