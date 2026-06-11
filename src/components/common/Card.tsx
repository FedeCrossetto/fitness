import React from 'react';
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { colors, radius, spacing, shadows } from '../../theme';
import { hapticSelect } from '../../lib/haptics';

interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  elevated?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export function Card({ children, onPress, elevated = false, style, accessibilityLabel }: CardProps): React.JSX.Element {
  const baseStyle = [styles.base, elevated && styles.elevated, style];

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={() => {
          hapticSelect();
          onPress();
        }}
        style={({ pressed }) => [...baseStyle, pressed && styles.pressed]}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={baseStyle}>{children}</View>;
}

const styles = StyleSheet.create({
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
  pressed: { opacity: 0.85 },
});
