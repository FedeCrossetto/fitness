import React from 'react';
import { ActivityIndicator, Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, radius, spacing, layout, useTheme, useThemedStyles } from '../../theme';
import { hapticTap } from '../../lib/haptics';
import { AppText } from './AppText';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost';
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
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
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

  const inner = loading ? (
    <ActivityIndicator color={textColor} />
  ) : (
    <View style={styles.content}>
      {icon ? <Ionicons name={icon} size={18} color={textColor} /> : null}
      <AppText variant={size === 'lg' ? 'body16SemiBold' : 'body14SemiBold'} color={textColor}>
        {label}
      </AppText>
    </View>
  );

  const sizeStyle = size === 'lg' ? styles.lg : styles.md;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      onPress={handlePress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.pressable,
        fullWidth && styles.fullWidth,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {variant === 'primary' ? (
        <LinearGradient
          colors={colors.gradients.kinetic}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={[styles.base, sizeStyle, styles.primaryShell]}
        >
          {inner}
        </LinearGradient>
      ) : (
        <View
          style={[
            styles.base,
            sizeStyle,
            variant === 'secondary' && styles.secondary,
            variant === 'outline' && styles.outline,
            variant === 'ghost' && styles.ghost,
          ]}
        >
          {inner}
        </View>
      )}
    </Pressable>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    pressable: { alignSelf: 'flex-start' },
    base: {
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: layout.minHitTarget,
      overflow: 'hidden',
    },
    lg: { paddingVertical: spacing.md, paddingHorizontal: spacing.xl },
    md: { paddingVertical: spacing.sm, paddingHorizontal: spacing.lg },
    primaryShell: {
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.12)',
    },
    secondary: {
      backgroundColor: colors.primary.muted,
      borderWidth: 1,
      borderColor: colors.border.strong,
    },
    outline: {
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      borderColor: colors.primary.default,
    },
    ghost: { backgroundColor: 'transparent' },
    fullWidth: { alignSelf: 'stretch' },
    pressed: { opacity: 0.88, transform: [{ scale: 0.985 }] },
    disabled: { opacity: 0.45 },
    content: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  });
