import React, { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import Animated, { useSharedValue, withTiming, useAnimatedProps, Easing } from 'react-native-reanimated';
import { Colors, radius, spacing, useThemedStyles, useTheme } from '../../theme';
import { useTranslation } from '../../stores/i18nStore';
import { AppText } from '../common/AppText';
import { formatMacroDisplay } from '@reset-fitness/shared';
import { NUTRITION_MACRO_COLORS } from '../nutrition/nutritionTheme';
import { CountUp } from '../common/CountUp';

const AnimatedPath = Animated.createAnimatedComponent(Path);

const CALORIES_ICON_COLOR = '#F97316';

type MacroIconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

interface MacroTotals {
  kcal: number;
  protein: number;
  carbs: number;
}

interface HomeMacroProgressCardProps {
  totals: MacroTotals;
  kcalGoal: number;
  macroGoals: { protein: number; carbs: number };
  title?: string;
  onPress?: () => void;
}

const GAUGE_STROKE = 14;
const GAUGE_RADIUS = 78;
const GAUGE_PAD_H = 14;
const GAUGE_PAD_TOP = 8;
const GAUGE_PAD_BOTTOM = 14;

const GAUGE_VIEW_WIDTH = 260 + GAUGE_PAD_H * 2;
const GAUGE_VIEW_HEIGHT = GAUGE_PAD_TOP + GAUGE_RADIUS + GAUGE_STROKE / 2 + GAUGE_PAD_BOTTOM;
const GAUGE_ASPECT = GAUGE_VIEW_WIDTH / GAUGE_VIEW_HEIGHT;

const GAUGE_CX = GAUGE_VIEW_WIDTH / 2;
const GAUGE_CY = GAUGE_PAD_TOP + GAUGE_RADIUS;

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  'worklet';
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function upperSemiArcPath(cx: number, cy: number, r: number, progress = 1): string {
  'worklet';
  const start = polar(cx, cy, r, 180);
  if (progress <= 0) return '';
  const endAngle = 180 + 180 * Math.min(progress, 1);
  const end = polar(cx, cy, r, endAngle);
  return `M ${start.x} ${start.y} A ${r} ${r} 0 0 1 ${end.x} ${end.y}`;
}

export function HomeMacroProgressCard({
  totals,
  kcalGoal,
  macroGoals,
  title,
  onPress,
}: HomeMacroProgressCardProps): React.JSX.Element {
  const { colors, isDark } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();

  const kcalProgress = kcalGoal > 0 ? Math.min(totals.kcal / kcalGoal, 1) : 0;
  const percent = Math.round(kcalProgress * 100);

  const animProgress = useSharedValue(0);

  useEffect(() => {
    animProgress.value = withTiming(kcalProgress, {
      duration: 900,
      easing: Easing.out(Easing.cubic),
    });
  }, [kcalProgress]);

  const animPathProps = useAnimatedProps(() => ({
    d: upperSemiArcPath(GAUGE_CX, GAUGE_CY, GAUGE_RADIUS, animProgress.value),
  }));

  const gauge = useMemo(() => ({
    trackPath: upperSemiArcPath(GAUGE_CX, GAUGE_CY, GAUGE_RADIUS, 1),
  }), []);

  const trackColor = isDark ? colors.surface.elevated : colors.border.default;

  const metrics: Array<{
    key: string;
    icon: MacroIconName;
    color: string;
    label: string;
    consumed: string;
    goal: string;
  }> = [
    {
      key: 'kcal',
      icon: 'fire',
      color: CALORIES_ICON_COLOR,
      label: t.home.calories,
      consumed: String(Math.round(totals.kcal)),
      goal: String(kcalGoal),
    },
    {
      key: 'protein',
      icon: 'egg-outline',
      color: NUTRITION_MACRO_COLORS.protein,
      label: t.home.proteins,
      consumed: `${formatMacroDisplay(totals.protein)}g`,
      goal: `${macroGoals.protein}g`,
    },
    {
      key: 'carbs',
      icon: 'bread-slice-outline',
      color: NUTRITION_MACRO_COLORS.carbs,
      label: t.home.carbs,
      consumed: `${formatMacroDisplay(totals.carbs)}g`,
      goal: `${macroGoals.carbs}g`,
    },
  ];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t.home.macro_progress_title}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <AppText variant="body14SemiBold" color={colors.text.primary}>
        {title ?? t.home.macro_progress_title}
      </AppText>

      <View style={styles.gaugeWrap}>
        <Svg width="100%" height="100%" viewBox={`0 0 ${GAUGE_VIEW_WIDTH} ${GAUGE_VIEW_HEIGHT}`}>
          <Path
            d={gauge.trackPath}
            stroke={trackColor}
            strokeWidth={GAUGE_STROKE}
            fill="none"
            strokeLinecap="round"
          />
          {kcalProgress > 0 ? (
            <AnimatedPath
              animatedProps={animPathProps}
              stroke={colors.primary.default}
              strokeWidth={GAUGE_STROKE}
              fill="none"
              strokeLinecap="round"
            />
          ) : null}
        </Svg>
        <View style={styles.gaugeCenter} pointerEvents="none">
          <CountUp
            value={percent}
            suffix="%"
            duration={900}
            style={{ fontFamily: 'Inter_600SemiBold', fontSize: 16, lineHeight: 22, color: colors.text.primary }}
          />
          <AppText variant="body12" color={colors.text.secondary}>
            {t.home.macro_progress_completed}
          </AppText>
        </View>
      </View>

      <View style={styles.metricsRow}>
        {metrics.map((item) => (
          <View key={item.key} style={styles.metricItem}>
            <MaterialCommunityIcons name={item.icon} size={18} color={item.color} />
            <AppText variant="body12" color={colors.text.tertiary} numberOfLines={1}>
              {item.label}
            </AppText>
            <View style={styles.metricValueRow}>
              <AppText variant="body13SemiBold" color={colors.text.primary} numberOfLines={1}>
                {item.consumed}
              </AppText>
              <AppText variant="body12" color={colors.text.disabled} numberOfLines={1}>
                {' / '}
                {item.goal}
              </AppText>
            </View>
          </View>
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
      paddingVertical: spacing.sm,
      gap: spacing.xs,
    },
    pressed: { opacity: 0.9 },
    gaugeWrap: {
      width: '100%',
      aspectRatio: GAUGE_ASPECT,
      alignSelf: 'center',
    },
    gaugeCenter: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      paddingBottom: GAUGE_RADIUS * 0.2,
      gap: 0,
    },
    metricsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingTop: spacing.xxs,
    },
    metricItem: {
      flex: 1,
      alignItems: 'center',
      gap: 2,
    },
    metricValueRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'center',
      flexWrap: 'nowrap',
    },
  });
