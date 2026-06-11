import React, { useEffect } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { colors, radius, spacing } from '../../theme';

interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

export function Skeleton({
  width = '100%',
  height = 16,
  borderRadius = radius.sm,
  style,
}: SkeletonProps): React.JSX.Element {
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(withTiming(0.9, { duration: 700 }), withTiming(0.4, { duration: 700 })),
      -1
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[styles.base, { width, height, borderRadius }, animatedStyle, style]}
    />
  );
}

/** Skeleton de tarjeta estándar para listas. */
export function CardSkeleton(): React.JSX.Element {
  return (
    <View style={styles.card}>
      <Skeleton width="40%" height={12} />
      <Skeleton width="70%" height={24} style={styles.gap} />
      <Skeleton width="55%" height={12} style={styles.gap} />
    </View>
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: colors.surface.elevated },
  card: {
    backgroundColor: colors.surface.base,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  gap: { marginTop: spacing.sm },
});
