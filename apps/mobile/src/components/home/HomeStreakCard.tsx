import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { Colors, radius, spacing, useThemedStyles, useTheme } from '../../theme';
import { AppText } from '../common';
import { addDays, getDayInfo, todayISO } from '../../lib/dates';
import { useTranslation } from '../../stores/i18nStore';

const FIRE_COLOR = '#F97316';

interface HomeStreakCardProps {
  /** Días consecutivos de actividad. */
  current: number;
  /** Últimos 7 días (índice 6 = hoy). */
  lastWeek: boolean[];
  onPress?: () => void;
}

function StreakDot({
  active,
  isToday,
  label,
  index,
}: {
  active: boolean;
  isToday: boolean;
  label: string;
  index: number;
}): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const scale = useSharedValue(0.6);

  useEffect(() => {
    scale.value = withDelay(
      index * 55,
      withTiming(1, { duration: 320, easing: Easing.out(Easing.back(1.6)) }),
    );
  }, [index, scale]);

  const dotAnim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <View style={styles.dotCol}>
      <Animated.View
        style={[
          styles.dot,
          active ? styles.dotActive : styles.dotInactive,
          isToday && active && styles.dotToday,
          dotAnim,
        ]}
      >
        {active ? (
          <Ionicons name="flame" size={13} color="#FFFFFF" />
        ) : (
          <View style={styles.dotEmpty} />
        )}
      </Animated.View>
      <AppText
        variant="caps11"
        color={isToday ? colors.text.secondary : colors.text.tertiary}
        style={styles.dotLabel}
      >
        {label}
      </AppText>
    </View>
  );
}

export function HomeStreakCard({ current, lastWeek, onPress }: HomeStreakCardProps): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();

  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.14, { duration: 900, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
    );
  }, [pulse]);
  const fireAnim = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  const dayLabels = lastWeek.map((_, i) => {
    const iso = addDays(todayISO(), -(6 - i));
    return getDayInfo(iso).dayAbbr.charAt(0);
  });

  const message =
    current <= 0
      ? t.home.streak_empty
      : current === 1
        ? t.home.streak_one
        : t.home.streak_active;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t.home.streak_title}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.topRow}>
        <Animated.View style={[styles.fireWrap, fireAnim]}>
          <Ionicons name="flame" size={26} color={FIRE_COLOR} />
        </Animated.View>
        <View style={styles.headText}>
          <View style={styles.countRow}>
            <AppText variant="h1" color={colors.text.primary} style={styles.count}>
              {current}
            </AppText>
            <AppText variant="body13" color={colors.text.tertiary}>
              {current === 1 ? t.home.streak_day_unit : t.home.streak_day_unit_plural}
            </AppText>
          </View>
          <AppText variant="body12" color={colors.text.tertiary}>
            {message}
          </AppText>
        </View>
      </View>

      <View style={styles.dotsRow}>
        {lastWeek.map((active, i) => (
          <StreakDot
            key={i}
            active={active}
            isToday={i === lastWeek.length - 1}
            label={dayLabels[i] ?? ''}
            index={i}
          />
        ))}
      </View>
    </Pressable>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface.base,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border.subtle,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      gap: spacing.md,
    },
    pressed: { opacity: 0.9 },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    fireWrap: {
      width: 44,
      height: 44,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(249,115,22,0.12)',
    },
    headText: { flex: 1, gap: 2 },
    countRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs },
    count: { fontFamily: 'Inter_700Bold' },
    dotsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    dotCol: { alignItems: 'center', gap: 5, flex: 1 },
    dot: {
      width: 26,
      height: 26,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dotActive: { backgroundColor: FIRE_COLOR },
    dotInactive: {
      backgroundColor: colors.surface.elevated,
      borderWidth: 1,
      borderColor: colors.border.subtle,
    },
    dotToday: {
      borderWidth: 2,
      borderColor: colors.text.primary,
    },
    dotEmpty: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.text.disabled,
    },
    dotLabel: { letterSpacing: 0.4 },
  });
