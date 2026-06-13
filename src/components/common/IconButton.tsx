import React from 'react';
import { Pressable, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, radius, layout, useTheme, useThemedStyles } from '../../theme';
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
  color,
  backgroundColor,
  accessibilityLabel,
  style,
}: IconButtonProps): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

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
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: backgroundColor ?? colors.surface.elevated },
        pressed && styles.pressed,
        style,
      ]}
    >
      <Ionicons name={icon} size={size} color={color ?? colors.text.primary} />
    </Pressable>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
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
