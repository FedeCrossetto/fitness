/**
 * Sistema monocromático Reset Fit: escala tonal verde lima sobre base oscura (dark)
 * o clara (light). PROHIBIDO usar colores fuera de esta escala (salvo warning/error).
 *
 * Para probar otra variedad de marca, alcanza con tocar `palette` (dark) y
 * `paletteLight` (light): todo el resto deriva de ahí.
 */

export const palette = {
  scale100: '#FFFFFF',
  scale200: '#B5B5B5',
  scale300: '#808084',
  scale400: '#5C5C5C',
  scale500: '#E1FF5C',
  scale600: '#C1ED00',
  scale700: '#90AE09',
  scale800: '#72890B',
  scale900: '#363F0D',
  scale1000: '#0C0C0C',
} as const;

/** Escala para modo light: lima vivo (no lavado) + neutros sobre blanco. */
export const paletteLight = {
  scale100: '#0C0C0C',
  scale200: '#4A4A4E',
  scale300: '#75757A',
  scale400: '#A3A3A8',
  scale500: '#BEF264',
  scale600: '#A3E635',
  scale700: '#84CC16',
  scale800: '#65A30D',
  scale900: '#3F6212',
  scale1000: '#F6F7F4',
} as const;

export const darkColors = {
  background: '#07090A',

  surface: {
    base: '#131618',
    elevated: '#1D2225',
    overlay: 'rgba(7,9,10,0.88)',
  },

  primary: {
    default: palette.scale600,
    light: palette.scale500,
    dark: palette.scale700,
    deep: palette.scale800,
    darkest: palette.scale900,
    muted: 'rgba(193,237,0,0.15)',
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
    error: '#FE734A',
    info: palette.scale300,
  },

  water: '#4FB0F7',

  gradients: {
    kinetic: ['#E1FF5C', '#C1ED00'] as readonly [string, string],
    deep: ['#C1ED00', '#363F0D'] as readonly [string, string],
    darkFade: ['rgba(7,9,10,0)', '#07090A'] as readonly [string, string],
  },

  pillars: {
    training: palette.scale600,
    nutrition: palette.scale700,
    progress: palette.scale800,
  },
} as const;

export type Colors = {
  background: string;
  surface: { base: string; elevated: string; overlay: string };
  primary: {
    default: string;
    light: string;
    dark: string;
    deep: string;
    darkest: string;
    muted: string;
    onText: string;
  };
  text: {
    primary: string;
    secondary: string;
    tertiary: string;
    disabled: string;
    inverse: string;
  };
  border: { subtle: string; default: string; strong: string };
  glass: { background: string; border: string };
  states: { success: string; warning: string; error: string; info: string };
  /** Color semántico de hidratación (agua). Fijo, no deriva de la marca. */
  water: string;
  gradients: {
    kinetic: readonly [string, string];
    deep: readonly [string, string];
    darkFade: readonly [string, string];
  };
  pillars: { training: string; nutrition: string; progress: string };
};

export const lightColors: Colors = {
  background: paletteLight.scale1000,

  surface: {
    base: '#FFFFFF',
    elevated: '#FFFFFF',
    overlay: 'rgba(246,247,244,0.88)',
  },

  primary: {
    default: paletteLight.scale600,
    light: paletteLight.scale500,
    dark: paletteLight.scale700,
    deep: paletteLight.scale800,
    darkest: paletteLight.scale900,
    muted: 'rgba(132,204,22,0.14)',
    onText: '#0C0C0C',
  },

  text: {
    primary: paletteLight.scale100,
    secondary: paletteLight.scale200,
    tertiary: paletteLight.scale300,
    disabled: paletteLight.scale400,
    inverse: '#FFFFFF',
  },

  border: {
    subtle: 'rgba(12,12,12,0.06)',
    default: 'rgba(12,12,12,0.10)',
    strong: 'rgba(12,12,12,0.18)',
  },

  glass: {
    background: 'rgba(255,255,255,0.7)',
    border: 'rgba(12,12,12,0.08)',
  },

  states: {
    success: paletteLight.scale700,
    warning: '#D97706',
    error: '#DC2626',
    info: paletteLight.scale300,
  },

  water: '#2D9CDB',

  gradients: {
    kinetic: ['#D9F99D', '#A3E635'],
    deep: ['#A3E635', '#3F6212'],
    darkFade: ['rgba(246,247,244,0)', '#F6F7F4'],
  },

  pillars: {
    training: paletteLight.scale600,
    nutrition: paletteLight.scale700,
    progress: paletteLight.scale800,
  },
};

// Verificación estructural: ambas paletas cumplen el mismo contrato.
const _check: Colors = darkColors;
void _check;
