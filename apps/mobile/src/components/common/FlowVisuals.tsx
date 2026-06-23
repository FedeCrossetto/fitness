import React from 'react';
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AppText } from './AppText';
import { radius, spacing, useTheme } from '../../theme';

/** Sombra suave para tarjetas del flujo onboarding / activación. */
export function flowShadowStyle(isDark: boolean): ViewStyle {
  return Platform.select({
    ios: {
      shadowColor: isDark ? '#000000' : '#3A4E15',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: isDark ? 0.28 : 0.1,
      shadowRadius: 18,
    },
    android: { elevation: 5 },
    default: {},
  }) ?? {};
}

interface FlowBackdropProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** Fondo con degradé sutil y orbes de luz en la parte superior. */
export function FlowBackdrop({ children, style }: FlowBackdropProps): React.JSX.Element {
  const { colors, isDark } = useTheme();

  return (
    <View style={[styles.backdropRoot, { backgroundColor: colors.background }, style]}>
      <LinearGradient
        colors={
          isDark
            ? (['rgba(190,252,80,0.14)', 'rgba(190,252,80,0.04)', 'transparent'] as const)
            : (['rgba(163,230,53,0.2)', 'rgba(163,230,53,0.06)', 'transparent'] as const)
        }
        locations={[0, 0.35, 0.7]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View
        pointerEvents="none"
        style={[
          styles.glowOrb,
          styles.glowOrbLeft,
          { backgroundColor: isDark ? 'rgba(190,252,80,0.07)' : 'rgba(163,230,53,0.12)' },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.glowOrb,
          styles.glowOrbRight,
          { backgroundColor: isDark ? 'rgba(190,252,80,0.05)' : 'rgba(132,204,22,0.08)' },
        ]}
      />
      {children}
    </View>
  );
}

interface FlowCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  selected?: boolean;
}

/** Tarjeta elevada con borde y sombra. */
export function FlowCard({ children, style, selected = false }: FlowCardProps): React.JSX.Element {
  const { colors, isDark } = useTheme();

  return (
    <View
      style={[
        {
          backgroundColor: colors.surface.base,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: selected ? colors.primary.default : colors.border.subtle,
        },
        flowShadowStyle(isDark),
        selected && { backgroundColor: colors.primary.muted },
        style,
      ]}
    >
      {children}
    </View>
  );
}

interface FlowGradientBannerProps {
  icon: React.ReactNode;
  title: string;
  body: string;
}

/** Banner superior con degradé de marca (deslinde, consentimiento, etc.). */
export function FlowGradientBanner({ icon, title, body }: FlowGradientBannerProps): React.JSX.Element {
  const { colors } = useTheme();

  return (
    <LinearGradient
      colors={[colors.primary.light, colors.primary.default, colors.primary.dark]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.banner}
    >
      <View style={styles.bannerIcon}>{icon}</View>
      <View style={styles.bannerText}>
        <AppText variant="body14SemiBold" color={colors.primary.onText}>
          {title}
        </AppText>
        <AppText variant="body13" color={colors.primary.onText} style={styles.bannerSub}>
          {body}
        </AppText>
      </View>
    </LinearGradient>
  );
}

interface FlowHeroIconProps {
  icon: React.ReactNode;
}

/** Ícono hero con anillo degradé (pantalla de activación / paso 1 onboarding). */
export function FlowHeroIcon({ icon }: FlowHeroIconProps): React.JSX.Element {
  const { colors, isDark } = useTheme();

  return (
    <View style={[styles.heroOuter, flowShadowStyle(isDark)]}>
      <LinearGradient
        colors={[colors.primary.light, colors.primary.default]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroGradient}
      >
        {icon}
      </LinearGradient>
    </View>
  );
}

interface FlowStepDotsProps {
  total: number;
  current: number;
}

/** Indicador de pasos con puntos y barra degradé en el paso activo. */
export function FlowStepDots({ total, current }: FlowStepDotsProps): React.JSX.Element {
  const { colors } = useTheme();

  return (
    <View style={styles.dotsRow}>
      {Array.from({ length: total }, (_, i) => {
        const active = i === current;
        const done = i < current;
        if (active) {
          return (
            <LinearGradient
              key={i}
              colors={[colors.primary.light, colors.primary.default]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.dotActive}
            />
          );
        }
        return (
          <View
            key={i}
            style={[
              styles.dot,
              {
                backgroundColor: done ? colors.primary.default : colors.border.default,
                opacity: done ? 0.55 : 0.35,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  backdropRoot: { flex: 1 },
  glowOrb: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
  },
  glowOrbLeft: { top: -80, left: -60 },
  glowOrbRight: { top: 40, right: -90 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: spacing.lg,
    paddingVertical: 16,
  },
  bannerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerText: { flex: 1 },
  bannerSub: { marginTop: 2, opacity: 0.92, lineHeight: 18 },
  heroOuter: {
    alignSelf: 'flex-start',
    borderRadius: radius.lg + 4,
    marginBottom: spacing.lg,
  },
  heroGradient: {
    width: 60,
    height: 60,
    borderRadius: radius.lg + 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    width: 28,
    height: 8,
    borderRadius: 4,
  },
});
