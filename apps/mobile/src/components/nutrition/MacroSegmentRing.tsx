import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '../../theme';
import { MACRO_RING_SLOTS, macroGoalProgress } from './macroChartUtils';
import { NUTRITION_MACRO_COLORS } from './nutritionTheme';
import type { MacroTotals } from '../../stores/nutritionStore';

export { NUTRITION_MACRO_COLORS };

interface MacroSegmentRingProps {
  totals: MacroTotals;
  macroGoals: { protein: number; carbs: number; fat: number };
  size?: number;
  strokeWidth?: number;
  children?: React.ReactNode;
}

const SLOT_RENDER_ORDER = ['carbs', 'fat', 'protein'] as const;

export function MacroSegmentRing({
  totals,
  macroGoals,
  size = 168,
  strokeWidth = 8,
  children,
}: MacroSegmentRingProps): React.JSX.Element {
  const { colors } = useTheme();
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const cx = size / 2;

  const progress = macroGoalProgress(totals, macroGoals);

  const arcs = SLOT_RENDER_ORDER.map((key) => {
    const slot = MACRO_RING_SLOTS[key];
    const arcDeg = slot.maxArcDeg * progress[key];
    const length = (arcDeg / 360) * circumference;
    const rotation = -90 + slot.startDeg;
    return {
      key,
      color: NUTRITION_MACRO_COLORS[key],
      length,
      rotation,
    };
  });

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle
          cx={cx}
          cy={cx}
          r={r}
          stroke={colors.border.default}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {arcs.map((arc) =>
          arc.length > 0.5 ? (
            <Circle
              key={arc.key}
              cx={cx}
              cy={cx}
              r={r}
              stroke={arc.color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={`${arc.length} ${circumference - arc.length}`}
              transform={`rotate(${arc.rotation} ${cx} ${cx})`}
            />
          ) : null
        )}
      </Svg>
      {children ? <View style={styles.center}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
});
