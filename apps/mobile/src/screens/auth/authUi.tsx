import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { radius, spacing, typography, layout } from '../../theme';
import { AppText } from '../../components/common';
import { authColors } from './authScreenTheme';

// ── Brand icons (color original solo acá) ────────────────────────────────────

export function GoogleBrandIcon({ size = 18 }: { size?: number }): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <Path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <Path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <Path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </Svg>
  );
}

// ── Inputs & buttons ─────────────────────────────────────────────────────────

interface AuthInputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string | null;
  icon?: keyof typeof Ionicons.glyphMap;
  containerStyle?: StyleProp<ViewStyle>;
}

export function AuthInput({
  label,
  error,
  icon,
  secureTextEntry,
  containerStyle,
  ...rest
}: AuthInputProps): React.JSX.Element {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(Boolean(secureTextEntry));

  return (
    <View style={containerStyle}>
      {label ? (
        <AppText variant="caps12" color={authColors.textTertiary} style={styles.label}>
          {label}
        </AppText>
      ) : null}
      <View
        style={[
          styles.field,
          focused && styles.fieldFocused,
          error ? styles.fieldError : null,
        ]}
      >
        {icon ? <Ionicons name={icon} size={18} color={authColors.textTertiary} /> : null}
        <TextInput
          placeholderTextColor={authColors.textDisabled}
          selectionColor={authColors.textPrimary}
          style={styles.input}
          secureTextEntry={hidden}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...rest}
        />
        {secureTextEntry ? (
          <Pressable
            onPress={() => setHidden((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Mostrar contraseña' : 'Ocultar contraseña'}
            hitSlop={8}
          >
            <Ionicons
              name={hidden ? 'eye-outline' : 'eye-off-outline'}
              size={18}
              color={authColors.textTertiary}
            />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <AppText variant="body12" color={authColors.errorText} style={styles.inputError}>
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

interface AuthButtonProps {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  variant?: 'default' | 'brand';
  style?: StyleProp<ViewStyle>;
}

export function AuthButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  fullWidth = false,
  variant = 'default',
  style,
}: AuthButtonProps): React.JSX.Element {
  const isDisabled = disabled || loading;
  const isBrand = variant === 'brand';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.primaryBtn,
        isBrand && styles.primaryBtnBrand,
        fullWidth && styles.fullWidth,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isBrand ? authColors.buttonBrandText : authColors.buttonPrimaryText} />
      ) : (
        <AppText
          variant="body16SemiBold"
          color={isBrand ? authColors.buttonBrandText : authColors.buttonPrimaryText}
        >
          {label}
        </AppText>
      )}
    </Pressable>
  );
}

interface AuthGoogleButtonProps {
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

export function AuthGoogleButton({ onPress, style }: AuthGoogleButtonProps): React.JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.oauthBtn, pressed && styles.pressed, style]}
    >
      <GoogleBrandIcon />
      <AppText variant="body14SemiBold" color={authColors.textPrimary}>
        Google
      </AppText>
    </Pressable>
  );
}

export function AuthErrorBox({ message }: { message: string }): React.JSX.Element {
  return (
    <View style={styles.errorBox}>
      <Ionicons name="alert-circle" size={16} color={authColors.errorText} />
      <AppText variant="body13" color={authColors.errorText} style={styles.errorText}>
        {message}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { marginBottom: spacing.xs },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: authColors.background,
    borderWidth: 1,
    borderColor: authColors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: 52,
  },
  fieldFocused: { borderColor: authColors.borderFocus },
  fieldError: { borderColor: authColors.textSecondary },
  input: {
    flex: 1,
    ...typography.body16,
    color: authColors.textPrimary,
    paddingVertical: spacing.sm,
    minHeight: layout.minHitTarget,
  },
  inputError: { marginTop: spacing.xxs },
  primaryBtn: {
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: layout.minHitTarget,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    backgroundColor: authColors.buttonPrimary,
  },
  primaryBtnBrand: {
    backgroundColor: authColors.buttonBrand,
  },
  oauthBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    alignSelf: 'stretch',
    minHeight: layout.minHitTarget,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: authColors.background,
    borderWidth: 1,
    borderColor: authColors.border,
    borderRadius: radius.md,
  },
  fullWidth: { alignSelf: 'stretch' },
  pressed: { opacity: 0.82 },
  disabled: { opacity: 0.45 },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: authColors.errorBg,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  errorText: { flexShrink: 1 },
});
