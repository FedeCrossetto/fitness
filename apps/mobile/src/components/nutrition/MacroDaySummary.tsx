import React, { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, spacing, useThemedStyles, useTheme } from '../../theme';
import { useTranslation } from '../../stores/i18nStore';
import { AppText } from '../common/AppText';
import { MacroSegmentBar } from './MacroSegmentBar';
import { MacroSegmentRing, NUTRITION_MACRO_COLORS } from './MacroSegmentRing';
import { NUTRITION_MOCK } from './nutritionTheme';
import type { MacroTotals } from '../../stores/nutritionStore';

interface MacroDaySummaryProps {
  totals: MacroTotals;
  kcalGoal: number;
  macroGoals: { protein: number; carbs: number; fat: number };
  onCheckCalories?: () => void;
  useMockWhenEmpty?: boolean;
}

function isEmptyTotals(totals: MacroTotals): boolean {
  return totals.kcal === 0 && totals.protein === 0 && totals.carbs === 0 && totals.fat === 0;
}

export function MacroDaySummary({
  totals,
  kcalGoal,
  macroGoals,
  onCheckCalories,
  useMockWhenEmpty = true,
}: MacroDaySummaryProps): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { t, i18n } = useTranslation();

  const macroRows = useMemo(
    () => [
      { key: 'carbs' as const, label: t.nutrition.carbs_label, color: NUTRITION_MACRO_COLORS.carbs, goalKey: 'carbs' as const },
      { key: 'protein' as const, label: t.nutrition.proteins_label, color: NUTRITION_MACRO_COLORS.protein, goalKey: 'protein' as const },
      { key: 'fat' as const, label: t.nutrition.fats_label, color: NUTRITION_MACRO_COLORS.fat, goalKey: 'fat' as const },
    ],
    [t],
  );

  const display = useMemo(() => {
    if (useMockWhenEmpty && isEmptyTotals(totals)) {
      return {
        totals: NUTRITION_MOCK.totals,
        kcalGoal: NUTRITION_MOCK.kcalGoal,
        macroGoals: NUTRITION_MOCK.macroGoals,
      };
    }
    return { totals, kcalGoal, macroGoals };
  }, [totals, kcalGoal, macroGoals, useMockWhenEmpty]);

  return (
    <View style={styles.module}>
      <View style={styles.row}>
        <MacroSegmentRing
          totals={display.totals}
          macroGoals={display.macroGoals}
          size={168}
          strokeWidth={8}
        >
          <View style={styles.dayPill}>
            <AppText variant="caps11" color={colors.text.tertiary}>
              {t.ui.today}
            </AppText>
          </View>
          <View style={styles.kcalRow}>
            <Ionicons name="nutrition-outline" size={20} color={colors.text.primary} />
            <AppText variant="metricMedium" color={colors.text.primary} style={styles.kcalValue}>
              {Math.round(display.totals.kcal)}
            </AppText>
          </View>
          <AppText variant="body12" color={colors.text.secondary}>
            {i18n(t.nutrition.kcal_goal, { n: display.kcalGoal })}
          </AppText>
        </MacroSegmentRing>

        <View style={styles.macrosCol}>
          {macroRows.map((row) => {
            const value = display.totals[row.key];
            const goal = display.macroGoals[row.goalKey];
            const progress = goal > 0 ? value / goal : 0;
            return (
              <View key={row.key} style={styles.macroItem}>
                <MacroSegmentBar progress={progress} color={row.color} trackColor={colors.border.default} />
                <View style={styles.macroText}>
                  <AppText variant="body14SemiBold" color={colors.text.primary}>
                    {Math.round(value)}/{goal}g
                  </AppText>
                  <AppText variant="body13Medium" color={row.color}>
                    {row.label}
                  </AppText>
                </View>
              </View>
            );
          })}
        </View>
      </View>

      {onCheckCalories ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.nutrition.check_calories}
          onPress={onCheckCalories}
          style={({ pressed }) => [styles.searchBar, pressed && styles.searchPressed]}
        >
          <AppText variant="body13" color={colors.text.tertiary}>
            {t.nutrition.check_calories}
          </AppText>
          <Ionicons name="scan-outline" size={20} color={colors.text.secondary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    module: {
      backgroundColor: colors.surface.base,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border.subtle,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      gap: spacing.md,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.lg,
    },
    dayPill: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
      borderRadius: 999,
      backgroundColor: colors.surface.elevated,
      marginBottom: spacing.xxs,
    },
    kcalRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xxs,
      marginBottom: 2,
    },
    kcalValue: {
      lineHeight: 36,
    },
    macrosCol: {
      flex: 1,
      gap: 10,
      justifyContent: 'center',
    },
    macroItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    macroText: {
      flex: 1,
      gap: 2,
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: 44,
      paddingHorizontal: spacing.md,
      borderRadius: 10,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border.subtle,
      borderStyle: 'dashed',
    },
    searchPressed: { opacity: 0.75 },
  });
