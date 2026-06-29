import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { spacing } from '../../theme';
import { AppText } from '../../components/common';
import { useAuthStore } from '../../stores/authStore';
import { useLogoSource } from '../../hooks/useLogoSource';
import { readPendingInviteCode } from '../../services/invite';
import type { AuthStackParamList } from '../../types/navigation';
import { authColors } from './authScreenTheme';
import { AuthButton, AuthErrorBox, AuthInput, AuthSocialLoginCard } from './authUi';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export function LoginScreen({ navigation, route }: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { signIn, signInWithOAuth, loading, oauthProvider, error, clearError } = useAuthStore();
  const logoSource = useLogoSource();
  const [email, setEmail]       = useState(route.params?.prefillEmail ?? '');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [prefillError] = useState(route.params?.prefillError ?? null);
  const [trainerCode, setTrainerCode] = useState(route.params?.code ?? '');

  useEffect(() => {
    void (async () => {
      if (route.params?.code) return;
      const pending = await readPendingInviteCode();
      if (pending) setTrainerCode(pending);
    })();
  }, [route.params?.code]);

  const handleLogin = async () => {
    if (!email.includes('@')) {
      setEmailError('Ingresá un email válido.');
      return;
    }
    setEmailError(null);
    const ok = await signIn(email, password);
    if (!ok) setPassword('');
  };


  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          {/* Brand row: logo + MÉTODO R3SET */}
          <View style={styles.brandRow}>
            <View style={styles.logoShell}>
              <Image
                source={logoSource}
                style={styles.logo}
                contentFit="cover"
                accessibilityLabel="Reset Fit"
                priority="high"
              />
            </View>
            <AppText variant="caps11" color="#C1ED00" style={styles.brandName}>
              MÉTODO R3SET
            </AppText>
          </View>

          <AppText variant="body14SemiBold" color={authColors.textPrimary} style={styles.welcome}>
            BIENVENIDO
          </AppText>
          <AppText variant="caps11" color={authColors.textTertiary} style={styles.tagline}>
            INGRESÁ TUS CREDENCIALES PARA CONTINUAR
          </AppText>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <AuthInput
            label="EMAIL"
            icon="mail-outline"
            placeholder="tu@email.com"
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            value={email}
            onChangeText={(v) => {
              setEmail(v);
              if (error) clearError();
              if (emailError) setEmailError(null);
            }}
            error={emailError}
            containerStyle={styles.field}
          />

          <AuthInput
            label="CONTRASEÑA"
            icon="lock-closed-outline"
            placeholder="••••••••"
            secureTextEntry
            autoComplete="off"
            textContentType="none"
            value={password}
            onChangeText={(v) => {
              setPassword(v);
              if (error) clearError();
            }}
            containerStyle={styles.field}
          />

          {/* Forgot password */}
          <View style={styles.forgotRow}>
            <Pressable
              onPress={() => navigation.navigate('ForgotPassword')}
              accessibilityRole="button"
              hitSlop={8}
            >
              <AppText variant="caps11" color={authColors.textTertiary}>
                ¿OLVIDASTE TU CONTRASEÑA?
              </AppText>
            </Pressable>
          </View>

          {(prefillError && !error) ? <AuthErrorBox message={prefillError} /> : null}
          {error ? <AuthErrorBox message={error} /> : null}

          <AuthButton
            label="INICIAR SESIÓN"
            onPress={handleLogin}
            loading={loading}
            disabled={!email || !password}
            fullWidth
            style={styles.cta}
          />

          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <AppText variant="caps11" color={authColors.textDisabled}>
              O
            </AppText>
            <View style={styles.divider} />
          </View>

          <AuthSocialLoginCard
            onGoogle={() => void signInWithOAuth('google', trainerCode, 'login')}
            onApple={() => void signInWithOAuth('apple', trainerCode, 'login')}
            loadingProvider={oauthProvider}
            disabled={loading && !oauthProvider}
          />

          <Pressable
            onPress={() => navigation.navigate('SignUp', trainerCode ? { code: trainerCode } : undefined)}
            style={styles.footer}
            accessibilityRole="button"
          >
            <AppText variant="caps11" color={authColors.textSecondary}>
              ¿NO TENÉS CUENTA?{' '}
              <AppText variant="caps11" color="#C1ED00">
                REGISTRATE
              </AppText>
            </AppText>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: authColors.background },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
  },

  // Header
  header: {
    marginBottom: spacing.xxl,
    gap: spacing.xs,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  logoShell: {
    width: 28,
    height: 28,
    borderRadius: 6,
    overflow: 'hidden',
  },
  logo: {
    width: 28,
    height: 28,
  },
  brandName: {
    letterSpacing: 2,
    fontStyle: 'italic',
  },
  welcome: {
    fontSize: 36,
    lineHeight: 42,
    letterSpacing: -0.5,
  },
  tagline: {
    letterSpacing: 1.2,
  },

  // Form
  form: {
    gap: 0,
  },
  field: { marginBottom: spacing.md },
  forgotRow: {
    alignItems: 'flex-end',
    marginTop: -spacing.xs,
    marginBottom: spacing.lg,
  },
  cta: { marginTop: spacing.xs },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  divider: { flex: 1, height: 1, backgroundColor: authColors.border },
  footer: {
    alignItems: 'center',
    marginTop: spacing.xxl,
    minHeight: 44,
    justifyContent: 'center',
  },
});
