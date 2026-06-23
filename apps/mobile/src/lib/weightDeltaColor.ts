import { NUTRITION_MACRO_COLORS } from '../components/nutrition/nutritionTheme';
import type { Colors } from '../theme';

/**
 * Color por signo del delta de peso.
 * + mismo verde que los toggles de perfil (#31F37B), − rojo de error.
 */
export function weightDeltaColor(delta: number, colors: Colors): string {
  if (delta > 0) return NUTRITION_MACRO_COLORS.carbs;
  if (delta < 0) return colors.states.error;
  return colors.text.tertiary;
}
