import { formatMacroDisplay, formatServingLabel } from '@reset-fitness/shared';
import type { MacroTotals } from '../../stores/nutritionStore';
import type { MealLogRow, ServingUnit } from '../../types/database';

export function computeSectionTotals(meals: MealLogRow[]): MacroTotals {
  return meals.reduce<MacroTotals>(
    (acc, meal) => {
      if (!meal.is_included) return acc;
      return {
        kcal: acc.kcal + (meal.energy_kcal ?? 0),
        protein: acc.protein + (meal.protein_g ?? 0),
        carbs: acc.carbs + (meal.carbs_g ?? 0),
        fat: acc.fat + (meal.fat_g ?? 0),
      };
    },
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

export function formatPortionLabel(
  amount: number | null,
  unit?: ServingUnit | null,
): string {
  return formatServingLabel(amount, unit ?? 'g');
}

export function formatMacroSummaryLine(totals: MacroTotals): string {
  return `${Math.round(totals.kcal)} kcal • ${formatMacroDisplay(totals.protein)} P | ${formatMacroDisplay(totals.carbs)} C | ${formatMacroDisplay(totals.fat)} G`;
}
