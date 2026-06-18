import type { MacroTotals } from '../../stores/nutritionStore';

/** kcal atribuibles a cada macro (4/4/9). */
export function macroKcalBreakdown(totals: MacroTotals): { carbs: number; protein: number; fat: number } {
  return {
    carbs: totals.carbs * 4,
    protein: totals.protein * 4,
    fat: totals.fat * 9,
  };
}

export function macroKcalTotal(totals: MacroTotals): number {
  const b = macroKcalBreakdown(totals);
  return b.carbs + b.protein + b.fat;
}

/** Fracciones 0..1 de cada macro sobre el total consumido. */
export function macroConsumedFractions(totals: MacroTotals): { carbs: number; protein: number; fat: number } {
  const b = macroKcalBreakdown(totals);
  const sum = b.carbs + b.protein + b.fat;
  if (sum <= 0) return { carbs: 0, protein: 0, fat: 0 };
  return { carbs: b.carbs / sum, protein: b.protein / sum, fat: b.fat / sum };
}

/** Posición fija de cada macro en el anillo (grados desde las 12 en sentido horario). */
export const MACRO_RING_SLOTS = {
  /** Verde — arriba/derecha (~1–3 h) */
  carbs: { startDeg: 18, maxArcDeg: 62 },
  /** Lima — abajo (~4–7 h) */
  protein: { startDeg: 118, maxArcDeg: 88 },
  /** Magenta — izquierda (~8–10 h) */
  fat: { startDeg: 232, maxArcDeg: 48 },
} as const;

export function macroGoalProgress(
  totals: MacroTotals,
  macroGoals: { protein: number; carbs: number; fat: number },
): { carbs: number; protein: number; fat: number } {
  return {
    carbs: macroGoals.carbs > 0 ? Math.min(totals.carbs / macroGoals.carbs, 1) : 0,
    protein: macroGoals.protein > 0 ? Math.min(totals.protein / macroGoals.protein, 1) : 0,
    fat: macroGoals.fat > 0 ? Math.min(totals.fat / macroGoals.fat, 1) : 0,
  };
}
