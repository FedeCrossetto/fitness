import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSpring,
  withSequence,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { useTheme } from '../../theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface ProgressRingProps {
  /** 0..1 */
  progress: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  children?: React.ReactNode;
  /** Show colored glow when progress >= 1 */
  glow?: boolean;
}

const SPRING = { damping: 6, stiffness: 280, mass: 0.5 };

export function ProgressRing({
  progress,
  size = 120,
  strokeWidth = 10,
  color,
  trackColor,
  children,
  glow = true,
}: ProgressRingProps): React.JSX.Element {
  const { colors, isDark } = useTheme();
  const strokeColor = color ?? colors.primary.default;
  const track = trackColor ?? (isDark ? colors.surface.elevated : colors.border.default);
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const animated = useSharedValue(0);
  const scale = useSharedValue(1);
  const glowOpacity = useSharedValue(0);

  const triggerBounce = () => {
    'worklet';
    scale.value = withSequence(
      withSpring(1.12, SPRING),
      withSpring(1, SPRING),
    );
    glowOpacity.value = withTiming(1, { duration: 300 });
  };

  useEffect(() => {
    const clamped = Math.min(Math.max(progress, 0), 1);
    animated.value = withTiming(clamped, { duration: 800, easing: Easing.out(Easing.cubic) }, (finished) => {
      if (finished && clamped >= 1) {
        runOnJS(triggerBounce)();
      }
    });
    if (clamped < 1) {
      glowOpacity.value = withTiming(0, { duration: 200 });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - animated.value),
  }));

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow ? glowOpacity.value : 0,
  }));

  const glowSize = size + strokeWidth * 3;

  return (
    <Animated.View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, containerStyle]}>
      {/* Colored glow ring behind SVG */}
      {glow ? (
        <Animated.View
          style={[
            styles.glow,
            {
              width: glowSize,
              height: glowSize,
              borderRadius: glowSize / 2,
              shadowColor: strokeColor,
            },
            glowStyle,
          ]}
        />
      ) : null}

      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={track}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children ? <View style={styles.center}>{children}</View> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 0,
  },
});
