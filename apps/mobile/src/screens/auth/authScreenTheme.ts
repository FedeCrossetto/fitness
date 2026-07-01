import { darkColors } from '../../theme/colors';

/**
 * Paleta de las pantallas de auth — deriva del tema central (theme/colors.ts)
 * para que login/onboarding y el resto de la app no puedan volver a desalinearse.
 * Los valores de texto acá usan rgba (opacidad sobre negro) en vez de los grises
 * sólidos del tema central; visualmente equivalen sobre el mismo fondo casi negro.
 */
export const authColors = {
  background:        darkColors.background,
  surface:           darkColors.surface.base,
  /** Verde lima de marca — antes redeclarado como `const LIMA = '#C1ED00'` en cada pantalla. */
  lima:              darkColors.primary.default,
  textPrimary:       darkColors.text.primary,
  textSecondary:     'rgba(255,255,255,0.55)',
  textTertiary:      'rgba(255,255,255,0.38)',
  textDisabled:      'rgba(255,255,255,0.22)',
  border:            darkColors.border.default,
  borderFocus:       darkColors.primary.default,
  buttonPrimary:     darkColors.primary.default,
  buttonPrimaryText: darkColors.background,
  buttonBrand:       darkColors.primary.default,
  buttonBrandText:   darkColors.background,
  errorBg:           'rgba(254,115,74,0.15)',
  errorText:         darkColors.states.error,
} as const;
