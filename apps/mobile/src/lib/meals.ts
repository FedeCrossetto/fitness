import type { MealType } from '../types/database';

/** Sugiere comida según la hora del día. */
export function defaultMealTypeForNow(): MealType {
  const hour = new Date().getHours();
  if (hour < 11) return 'DES';
  if (hour < 15) return 'ALM';
  if (hour < 18) return 'MER';
  if (hour < 22) return 'CEN';
  return 'COL';
}

export function mealLabelKey(type: MealType): 'breakfast' | 'lunch' | 'snack' | 'dinner' | 'intermediate' {
  switch (type) {
    case 'DES':
      return 'breakfast';
    case 'ALM':
      return 'lunch';
    case 'MER':
      return 'snack';
    case 'CEN':
      return 'dinner';
    default:
      return 'intermediate';
  }
}

export const MEAL_TYPES: MealType[] = ['DES', 'ALM', 'MER', 'CEN', 'COL'];
