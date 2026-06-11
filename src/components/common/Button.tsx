import React from 'react';
import { ActivityIndicator, Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, layout } from '../../theme';
import { hapticTap } from '../../lib/haptics';
import { AppText } from './AppText';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';
type ButtonSize = 'md' | 'lg';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  icon,
  loading = false,
  disabled = false,
  fullWidth = false,
  style,
}: ButtonProps): React.JSX.Element {
  const isDisabled = disabled || loading;

  const handlePress = () => {
    hapticTap();
    onPress();
  };

  const textColor =
    variant === 'primary'
      ? colors.primary.onText
      : variant === 'secondary'
        ? colors.text.primary
        : colors.primary.default;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      onPress={handlePress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        size === 'lg' ? styles.lg : styles.md,
        variant === 'primary' && styles.primary,
        variant === 'secondary' && styles.secondary,
        variant === 'ghost' && styles.ghost,
        fullWidth && styles.fullWidth,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <View style={styles.content}>
          {icon ? <Ionicons name={icon} size={18} color={textColor} /> : null}
          <AppText variant={size === 'lg' ? 'body16SemiBold' : 'body14SemiBold'} color={textColor}>
            {label}
          </AppText>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: layout.minHitTarget,
  },
  lg: { paddingVertical: spacing.md, paddingHorizontal: spacing.xl },
  md: { paddingVertical: spacing.sm, paddingHorizontal: spacing.lg },
  primary: { backgroundColor: colors.primary.default },
  secondary: {
    backgroundColor: colors.surface.elevated,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  ghost: { backgroundColor: 'transparent' },
  fullWidth: { alignSelf: 'stretch' },
  pressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.45 },
  content: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
