import React, { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
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
import { isAppleSignInEnabled } from '../../config/authConfig';
import type { OAuthProvider } from '../../stores/authStore';

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

export function AppleBrandIcon({ size = 18, color = '#000000' }: { size?: number; color?: string }): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill={color}
        d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"
      />
    </Svg>
  );
}

// ── Inputs & buttons ─────────────────────────────────────────────────────────

interface AuthInputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string | null;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Reemplaza el ícono por un elemento custom (ej. la bandera del país elegido). */
  leftElement?: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
}

export function AuthInput({
  label,
  error,
  icon,
  leftElement,
  secureTextEntry,
  containerStyle,
  ...rest
}: AuthInputProps): React.JSX.Element {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(Boolean(secureTextEntry));
  const { onFocus: onFocusProp, onBlur: onBlurProp, ...textInputRest } = rest;

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
        {leftElement ?? (icon ? <Ionicons name={icon} size={18} color={authColors.textTertiary} /> : null)}
        <TextInput
          placeholderTextColor={authColors.textDisabled}
          selectionColor={authColors.textPrimary}
          style={styles.input}
          secureTextEntry={hidden}
          onFocus={(e) => { setFocused(true); onFocusProp?.(e); }}
          onBlur={(e) => { setFocused(false); onBlurProp?.(e); }}
          {...textInputRest}
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

interface AuthSocialButtonProps {
  provider: OAuthProvider;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
}

function AuthSocialButton({
  provider,
  onPress,
  loading = false,
  disabled = false,
  fullWidth = false,
  style,
}: AuthSocialButtonProps): React.JSX.Element {
  const isApple = provider === 'apple';
  const isDisabled = disabled || loading;
  const label = isApple ? 'Apple' : 'Google';
  const textColor = isApple ? '#000000' : authColors.textPrimary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Continuar con ${label}`}
      accessibilityState={{ disabled: isDisabled }}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.socialBtn,
        isApple ? styles.socialBtnApple : styles.socialBtnGoogle,
        fullWidth && styles.fullWidth,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <>
          {isApple ? <AppleBrandIcon /> : <GoogleBrandIcon />}
          <AppText variant="body14SemiBold" color={textColor}>
            {label}
          </AppText>
        </>
      )}
    </Pressable>
  );
}

interface AuthSocialLoginCardProps {
  onGoogle: () => void;
  onApple: () => void;
  loadingProvider?: OAuthProvider | null;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Card con acceso rápido vía Google y Apple (Apple solo iOS/web). */
export function AuthSocialLoginCard({
  onGoogle,
  onApple,
  loadingProvider = null,
  disabled = false,
  style,
}: AuthSocialLoginCardProps): React.JSX.Element {
  // Apple: visible en iOS siempre que el flag esté activo, pero funcional solo en prod
  const showApple = isAppleSignInEnabled && (Platform.OS === 'ios' || Platform.OS === 'web');
  const appleReady = showApple && process.env.EXPO_PUBLIC_APPLE_SIGN_IN_READY === 'true';
  const anyLoading = loadingProvider !== null;

  return (
    <View style={[styles.socialCard, style]}>
      <AppText variant="caps12" color={authColors.textTertiary} style={styles.socialCardLabel}>
        ACCESO RÁPIDO
      </AppText>
      <View style={[styles.socialRow, !showApple && styles.socialRowSingle]}>
        <AuthSocialButton
          provider="google"
          onPress={onGoogle}
          loading={loadingProvider === 'google'}
          disabled={disabled || (anyLoading && loadingProvider !== 'google')}
          style={showApple ? styles.socialBtnHalf : undefined}
          fullWidth={!showApple}
        />
        {showApple ? (
          <AuthSocialButton
            provider="apple"
            onPress={appleReady ? onApple : () => undefined}
            loading={loadingProvider === 'apple'}
            disabled={!appleReady || disabled || (anyLoading && loadingProvider !== 'apple')}
            style={styles.socialBtnHalf}
          />
        ) : null}
      </View>
      <AppText variant="caps11" color={authColors.textDisabled} align="center" style={styles.socialHint}>
        CONTINUÁ CON GOOGLE{showApple ? ' O APPLE' : ''}
      </AppText>
    </View>
  );
}

/** @deprecated Usar AuthSocialLoginCard */
export function AuthGoogleButton({ onPress, style }: { onPress: () => void; style?: StyleProp<ViewStyle> }): React.JSX.Element {
  return (
    <AuthSocialButton provider="google" onPress={onPress} fullWidth style={style} />
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
    backgroundColor: authColors.surface,
    borderWidth: 1,
    borderColor: authColors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: 52,
  },
  fieldFocused: { borderColor: authColors.borderFocus },
  fieldError: { borderColor: authColors.errorText },
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
  socialCard: {
    padding: spacing.md,
    backgroundColor: authColors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: authColors.border,
    gap: spacing.sm,
  },
  socialCardLabel: {
    textAlign: 'center',
    letterSpacing: 0.6,
  },
  socialRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  socialRowSingle: {
    flexDirection: 'column',
  },
  socialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: layout.minHitTarget,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  socialBtnHalf: {
    flex: 1,
  },
  socialBtnGoogle: {
    backgroundColor: authColors.background,
    borderWidth: 1,
    borderColor: authColors.border,
  },
  socialBtnApple: {
    backgroundColor: '#FFFFFF',
  },
  socialHint: {
    lineHeight: 18,
    paddingHorizontal: spacing.xxs,
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
