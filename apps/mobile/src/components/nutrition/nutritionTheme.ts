/** Paleta visual del widget de Nutrición (referencia compacta). */
export const nutritionPalette = {
  background: '#0B0B0B',
  module: '#101010',
  track: '#2E2935',
  inactiveBlock: '#302D34',
  inputBorder: '#252525',
  textPrimary: '#FFFFFF',
  textSecondary: '#A0A0A0',
  placeholder: '#8A8A8A',
  iconMuted: '#BDBDBD',
  carbs: '#31F37B',
  protein: '#D7FF35',
  fat: '#EF6CFF',
  buttonText: '#111111',
} as const;

export const NUTRITION_MACRO_COLORS = {
  carbs: nutritionPalette.carbs,
  protein: nutritionPalette.protein,
  fat: nutritionPalette.fat,
} as const;

/** Valores temporales para previsualizar el diseño cuando no hay registros. */
export const NUTRITION_MOCK = {
  totals: { kcal: 764, protein: 68, carbs: 80, fat: 10 },
  kcalGoal: 1500,
  macroGoals: { protein: 158, carbs: 174, fat: 83 },
} as const;
