import React, { useEffect } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, Easing } from 'react-native-reanimated';
import { colors, radius } from '../../theme';

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
  color = colors.primary.default,
  trackColor = colors.surface.elevated,
  style,
}: ProgressBarProps): React.JSX.Element {
  const animated = useSharedValue(0);

  useEffect(() => {
    animated.value = withTiming(Math.min(Math.max(progress, 0), 1), {
      duration: 600,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress, animated]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${animated.value * 100}%`,
  }));

  return (
    <View style={[styles.track, { height, backgroundColor: trackColor }, style]}>
      <Animated.View style={[styles.fill, { backgroundColor: color }, fillStyle]} />
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
  },
});
