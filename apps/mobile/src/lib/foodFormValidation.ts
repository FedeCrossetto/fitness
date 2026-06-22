import type { StoredMacros } from '@reset-fitness/shared';

export interface FoodFormValidationInput {
  name: string;
  portionAmount: number;
  offStatus: 'idle' | 'loading' | 'error' | 'notfound' | 'done';
  hasCatalogMacros: boolean;
  storedMacros: StoredMacros | null;
  computedKcal: number;
  computedProtein: number;
  computedCarbs: number;
  computedFat: number;
  requiresMacroInput: boolean;
}

export type FoodFormValidationMessageKey =
  | 'validation_title'
  | 'validation_name_required'
  | 'validation_portion_required'
  | 'validation_macros_required'
  | 'validation_scan_loading'
  | 'save_food_error'
  | 'save_meal_error';

export function validateFoodForm(input: FoodFormValidationInput): FoodFormValidationMessageKey | null {
  if (input.offStatus === 'loading') return 'validation_scan_loading';

  if (!input.name.trim()) return 'validation_name_required';

  if (!(input.portionAmount > 0)) return 'validation_portion_required';

  if (input.hasCatalogMacros) return null;

  const hasManualMacros =
    input.computedKcal > 0 ||
    input.computedProtein > 0 ||
    input.computedCarbs > 0 ||
    input.computedFat > 0;

  const hasStored =
    input.storedMacros != null &&
    ((input.storedMacros.kcal ?? 0) > 0 ||
      (input.storedMacros.protein ?? 0) > 0 ||
      (input.storedMacros.carbs ?? 0) > 0 ||
      (input.storedMacros.fat ?? 0) > 0);

  if (hasManualMacros || hasStored) return null;

  if (input.requiresMacroInput) return 'validation_macros_required';

  return null;
}

export function storedMacrosFromPer100(per100: {
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
} | null): StoredMacros | null {
  if (!per100) return null;
  return {
    kcal: per100.kcal,
    protein: per100.protein,
    carbs: per100.carbs,
    fat: per100.fat,
  };
}
