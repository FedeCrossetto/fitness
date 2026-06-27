import React, { useEffect } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle, useWindowDimensions } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, radius, spacing, useThemedStyles, useTheme } from '../../theme';

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
  const { width: screenW } = useWindowDimensions();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const translateX = useSharedValue(-screenW);

  useEffect(() => {
    translateX.value = withRepeat(
      withTiming(screenW, { duration: 1200, easing: Easing.linear }),
      -1,
    );
  }, [translateX, screenW]);

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const base = colors.surface.elevated;
  const highlight = colors.surface.base + 'CC';

  return (
    <View style={[styles.base, { width, height, borderRadius }, style]}>
      <Animated.View style={[StyleSheet.absoluteFill, shimmerStyle]}>
        <LinearGradient
          colors={[base, highlight, base]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ flex: 1, width: screenW * 0.6 }}
        />
      </Animated.View>
    </View>
  );
}

/** Skeleton de tarjeta estándar para listas. */
export function CardSkeleton(): React.JSX.Element {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.card}>
      <Skeleton width="40%" height={12} />
      <Skeleton width="70%" height={24} style={styles.gap} />
      <Skeleton width="55%" height={12} style={styles.gap} />
    </View>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    base: {
      backgroundColor: colors.surface.elevated,
      overflow: 'hidden',
    },
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
