/**
 * Sistema monocromático Habito: base oscura casi negra + escala tonal verde lima.
 * PROHIBIDO usar colores fuera de esta escala (salvo warning/error).
 */

export const palette = {
  scale100: '#FFFFFF',
  scale200: '#B5B5B5',
  scale300: '#808084',
  scale400: '#5C5C5C',
  scale500: '#D4FD7F',
  scale600: '#BEFC50',
  scale700: '#90BD3B',
  scale800: '#7DA433',
  scale900: '#3A4E15',
  scale1000: '#0C0C0C',
} as const;

export const colors = {
  background: palette.scale1000,

  surface: {
    base: '#141414',
    elevated: '#1C1C1C',
    overlay: 'rgba(12,12,12,0.85)',
  },

  primary: {
    default: palette.scale600,
    light: palette.scale500,
    dark: palette.scale700,
    deep: palette.scale800,
    darkest: palette.scale900,
    muted: 'rgba(190,252,80,0.15)',
    onText: palette.scale1000,
  },

  text: {
    primary: palette.scale100,
    secondary: palette.scale200,
    tertiary: palette.scale300,
    disabled: palette.scale400,
    inverse: palette.scale1000,
  },

  border: {
    subtle: 'rgba(255,255,255,0.06)',
    default: 'rgba(255,255,255,0.10)',
    strong: 'rgba(255,255,255,0.18)',
  },

  glass: {
    background: 'rgba(28,28,28,0.6)',
    border: 'rgba(255,255,255,0.08)',
  },

  states: {
    success: palette.scale600,
    warning: '#FBBF24',
    error: '#EF4444',
    info: palette.scale300,
  },

  gradients: {
    kinetic: ['#D4FD7F', '#BEFC50'] as const,
    deep: ['#BEFC50', '#3A4E15'] as const,
    darkFade: ['rgba(12,12,12,0)', '#0C0C0C'] as const,
  },

  pillars: {
    training: palette.scale600,
    nutrition: palette.scale700,
    progress: palette.scale800,
  },
} as const;

export type Colors = typeof colors;
