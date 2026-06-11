import { TextStyle } from 'react-native';

export const fontFamily = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semiBold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

type Variant = Pick<TextStyle, 'fontFamily' | 'fontSize' | 'lineHeight' | 'letterSpacing' | 'textTransform'>;

const caps = (fontSize: number, lineHeight: number): Variant => ({
  fontFamily: fontFamily.semiBold,
  fontSize,
  lineHeight,
  letterSpacing: 0.6,
  textTransform: 'uppercase',
});

export const typography = {
  // Headings (SemiBold)
  h1: { fontFamily: fontFamily.semiBold, fontSize: 24, lineHeight: 30 },
  h2: { fontFamily: fontFamily.semiBold, fontSize: 22, lineHeight: 28 },
  h3: { fontFamily: fontFamily.semiBold, fontSize: 20, lineHeight: 26 },

  // Body
  body17: { fontFamily: fontFamily.regular, fontSize: 17, lineHeight: 24 },
  body17Medium: { fontFamily: fontFamily.medium, fontSize: 17, lineHeight: 24 },
  body17SemiBold: { fontFamily: fontFamily.semiBold, fontSize: 17, lineHeight: 24 },
  body16: { fontFamily: fontFamily.regular, fontSize: 16, lineHeight: 22 },
  body16Medium: { fontFamily: fontFamily.medium, fontSize: 16, lineHeight: 22 },
  body16SemiBold: { fontFamily: fontFamily.semiBold, fontSize: 16, lineHeight: 22 },
  body14: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20 },
  body14Medium: { fontFamily: fontFamily.medium, fontSize: 14, lineHeight: 20 },
  body14SemiBold: { fontFamily: fontFamily.semiBold, fontSize: 14, lineHeight: 20 },
  body13: { fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 18 },
  body13Medium: { fontFamily: fontFamily.medium, fontSize: 13, lineHeight: 18 },
  body13SemiBold: { fontFamily: fontFamily.semiBold, fontSize: 13, lineHeight: 18 },
  body12: { fontFamily: fontFamily.regular, fontSize: 12, lineHeight: 16 },
  body12Medium: { fontFamily: fontFamily.medium, fontSize: 12, lineHeight: 16 },
  body12SemiBold: { fontFamily: fontFamily.semiBold, fontSize: 12, lineHeight: 16 },

  // Labels CAPS
  caps14: caps(14, 18),
  caps13: caps(13, 16),
  caps12: caps(12, 16),
  caps11: caps(11, 14),

  // Métricas / números grandes (tracking negativo)
  metricLarge: { fontFamily: fontFamily.bold, fontSize: 48, lineHeight: 52, letterSpacing: -1.2 },
  metricMedium: { fontFamily: fontFamily.semiBold, fontSize: 32, lineHeight: 36, letterSpacing: -0.8 },
  metricSmall: { fontFamily: fontFamily.semiBold, fontSize: 20, lineHeight: 24, letterSpacing: -0.4 },
} as const satisfies Record<string, Variant>;

export type TypographyVariant = keyof typeof typography;
