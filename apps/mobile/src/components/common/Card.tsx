import React from 'react';
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { Colors, radius, spacing, shadows, useThemedStyles } from '../../theme';
import { hapticSelect } from '../../lib/haptics';

interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  elevated?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

const SPRING = { damping: 18, stiffness: 280, mass: 0.7 };

export function Card({ children, onPress, elevated = false, style, accessibilityLabel }: CardProps): React.JSX.Element {
  const styles = useThemedStyles(createStyles);
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const baseStyle = [styles.base, elevated && styles.elevated, style];

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPressIn={() => { scale.value = withSpring(0.963, SPRING); }}
        onPressOut={() => { scale.value = withSpring(1, SPRING); }}
        onPress={() => { hapticSelect(); onPress(); }}
      >
        <Animated.View style={[...baseStyle, animatedStyle]}>
          {children}
        </Animated.View>
      </Pressable>
    );
  }

  return <View style={baseStyle}>{children}</View>;
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    base: {
      backgroundColor: colors.surface.base,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border.subtle,
      padding: spacing.md,
    },
    elevated: {
      backgroundColor: colors.surface.elevated,
      ...shadows.soft,
    },
  });
