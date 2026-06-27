import React, { useEffect } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, Easing } from 'react-native-reanimated';
import { radius, useTheme } from '../../theme';

interface ProgressBarProps {
  /** 0..1 */
  progress: number;
  height?: number;
  color?: string;
  trackColor?: string;
  style?: StyleProp<ViewStyle>;
}

export function ProgressBar({
  progress,
  height = 8,
  color,
  trackColor,
  style,
}: ProgressBarProps): React.JSX.Element {
  const { colors, isDark } = useTheme();
  const fillColor = color ?? colors.primary.default;
  const track = trackColor ?? (isDark ? colors.surface.elevated : colors.border.default);
  const animated = useSharedValue(0);

  useEffect(() => {
    animated.value = withTiming(Math.min(Math.max(progress, 0), 1), {
      duration: 600,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress, animated]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${animated.value * 100}%` as `${number}%`,
  }));

  return (
    <View style={[styles.track, { height, backgroundColor: track }, style]}>
      <Animated.View style={[styles.fill, fillStyle]}>
        <LinearGradient
          colors={[fillColor, fillColor + 'AA']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    borderRadius: radius.pill,
    overflow: 'hidden',
    alignSelf: 'stretch',
  },
  fill: {
    height: '100%',
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
});
