export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999,
} as const;

export const layout = {
  /** Padding horizontal estándar de pantalla */
  screenPadding: spacing.lg,
  /** Hit target mínimo accesible */
  minHitTarget: 44,
  /** Altura de la tab bar custom */
  tabBarHeight: 72,
  /** Margen de la tab bar flotante respecto a los bordes y al home indicator */
  tabBarFloatingMargin: spacing.sm,
} as const;

export const shadows = {
  soft: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  glow: {
    shadowColor: '#C1ED00',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
} as const;
