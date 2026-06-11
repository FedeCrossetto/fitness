import React from 'react';
import { Pressable, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, layout } from '../../theme';
import { hapticSelect } from '../../lib/haptics';

interface IconButtonProps {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  size?: number;
  color?: string;
  backgroundColor?: string;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
}

export function IconButton({
  icon,
  onPress,
  size = 20,
  color = colors.text.primary,
  backgroundColor = colors.surface.elevated,
  accessibilityLabel,
  style,
}: IconButtonProps): React.JSX.Element {
  const handlePress = () => {
    hapticSelect();
    onPress();
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={handlePress}
      hitSlop={8}
      style={({ pressed }) => [styles.base, { backgroundColor }, pressed && styles.pressed, style]}
    >
      <Ionicons name={icon} size={size} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: layout.minHitTarget,
    height: layout.minHitTarget,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  pressed: { opacity: 0.7 },
});
