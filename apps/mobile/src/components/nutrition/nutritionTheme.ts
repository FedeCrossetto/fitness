import type { ViewStyle } from 'react-native';
import type { Colors } from '../../theme';

/** Estilo de card de nutrición con más contraste vs el fondo de pantalla (light + dark). */
export function nutritionCardStyle(colors: Colors, isDark: boolean): ViewStyle {
  return {
    backgroundColor: isDark ? colors.surface.elevated : colors.surface.base,
    borderWidth: 1,
    borderColor: colors.border.default,
    ...(isDark
      ? {}
      : {
          shadowColor: '#0C0C0C',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 10,
          elevation: 3,
        }),
  };
}
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
