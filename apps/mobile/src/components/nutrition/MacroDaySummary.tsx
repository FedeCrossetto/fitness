import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, spacing, useThemedStyles, useTheme } from '../../theme';
import { useTranslation } from '../../stores/i18nStore';
import { AppText } from '../common/AppText';
import { MacroSegmentBar } from './MacroSegmentBar';
import { MacroSegmentRing, NUTRITION_MACRO_COLORS } from './MacroSegmentRing';
import { nutritionCardStyle } from './nutritionTheme';
import type { MacroTotals } from '../../stores/nutritionStore';

interface MacroDaySummaryProps {
  totals: MacroTotals;
  kcalGoal: number;
  macroGoals: { protein: number; carbs: number; fat: number };
}

export function MacroDaySummary({
  totals,
  kcalGoal,
  macroGoals,
}: MacroDaySummaryProps): React.JSX.Element {
  const { colors, isDark } = useTheme();
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

  return (
    <View style={[styles.module, nutritionCardStyle(colors, isDark)]}>
      <View style={styles.row}>
        <MacroSegmentRing totals={totals} macroGoals={macroGoals} size={168} strokeWidth={8}>
          <View style={styles.dayPill}>
            <AppText variant="caps11" color={colors.text.tertiary}>
              {t.ui.today}
            </AppText>
          </View>
          <View style={styles.kcalRow}>
            <Ionicons name="nutrition-outline" size={20} color={colors.text.primary} />
            <AppText variant="metricMedium" color={colors.text.primary} style={styles.kcalValue}>
              {Math.round(totals.kcal)}
            </AppText>
          </View>
          <AppText variant="body12" color={colors.text.secondary}>
            {i18n(t.nutrition.kcal_goal, { n: kcalGoal })}
          </AppText>
        </MacroSegmentRing>

        <View style={styles.macrosCol}>
          {macroRows.map((row) => {
            const value = totals[row.key];
            const goal = macroGoals[row.goalKey];
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
    </View>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    module: {
      borderRadius: 14,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      gap: spacing.md,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
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
      marginLeft: spacing.xxl,
      paddingLeft: spacing.xl,
      paddingRight: spacing.xxs,
      gap: 12,
      justifyContent: 'center',
      alignItems: 'flex-end',
    },
    macroItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    macroText: {
      gap: 2,
      minWidth: 88,
    },
  });
