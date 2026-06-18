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
import { brandAssets } from '../../theme/brand';
import { AppText } from '../../components/common';
import { useAuthStore } from '../../stores/authStore';
import { readPendingInviteCode } from '../../services/invite';
import type { AuthStackParamList } from '../../types/navigation';
import { authColors } from './authScreenTheme';
import { AuthButton, AuthErrorBox, AuthGoogleButton, AuthInput } from './authUi';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export function LoginScreen({ navigation, route }: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { signIn, signInWithOAuth, loading, error, clearError } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [trainerCode, setTrainerCode] = useState(route.params?.code ?? '');

  useEffect(() => {
    void (async () => {
      if (route.params?.code) return;
      const pending = await readPendingInviteCode();
      if (pending) setTrainerCode(pending);
    })();
  }, [route.params?.code]);

  const handleLogin = () => {
    if (!email.includes('@')) {
      setEmailError('Ingresá un email válido.');
      return;
    }
    setEmailError(null);
    void signIn(email, password);
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.hero, { paddingTop: insets.top + spacing.xl }]}>
          <View style={styles.logoShell}>
            <Image
              source={brandAssets.logo}
              style={styles.logo}
              contentFit="cover"
              accessibilityLabel="Reset Fit"
              priority="high"
            />
          </View>
          <AppText
            variant="body12"
            color={authColors.textSecondary}
            style={styles.heroTagline}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.85}
          >
            Entrenamiento · nutrición · progreso
          </AppText>
        </View>

        <View style={[styles.form, { paddingBottom: insets.bottom + spacing.xl }]}>
          <AuthInput
            label="Email"
            icon="mail-outline"
            placeholder="tu@email.com"
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            value={email}
            onChangeText={(v) => {
              setEmail(v);
              if (error) clearError();
            }}
            error={emailError}
            containerStyle={styles.field}
          />
          <AuthInput
            label="Contraseña"
            icon="lock-closed-outline"
            placeholder="••••••••"
            secureTextEntry
            autoComplete="password"
            value={password}
            onChangeText={(v) => {
              setPassword(v);
              if (error) clearError();
            }}
            containerStyle={styles.field}
          />

          {error ? <AuthErrorBox message={error} /> : null}

          <AuthButton
            label="Iniciar sesión"
            onPress={handleLogin}
            loading={loading}
            disabled={!email || !password}
            fullWidth
            style={styles.cta}
          />

          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <AppText variant="caps11" color={authColors.textDisabled}>
              o continuar con
            </AppText>
            <View style={styles.divider} />
          </View>

          <AuthGoogleButton
            onPress={() => void signInWithOAuth('google', trainerCode, 'login')}
          />

          <Pressable
            onPress={() => navigation.navigate('SignUp', trainerCode ? { code: trainerCode } : undefined)}
            style={styles.footer}
            accessibilityRole="button"
          >
            <AppText variant="body14" color={authColors.textSecondary}>
              ¿No tenés cuenta?{' '}
              <AppText variant="body14SemiBold" color={authColors.textPrimary}>
                Registrate
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
  scroll: { flexGrow: 1 },
  hero: {
    alignItems: 'center',
    backgroundColor: authColors.surface,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  logoShell: {
    width: 128,
    height: 128,
    borderRadius: 32,
    overflow: 'hidden',
    backgroundColor: authColors.textPrimary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 14,
    elevation: 6,
  },
  logo: {
    width: 128,
    height: 128,
  },
  heroTagline: {
    textAlign: 'center',
    marginTop: spacing.md,
    maxWidth: '100%',
    letterSpacing: 0.2,
  },
  form: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
  },
  field: { marginBottom: spacing.md },
  cta: { marginTop: spacing.xs },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginVertical: spacing.xl,
  },
  divider: { flex: 1, height: 1, backgroundColor: authColors.border },
  footer: { alignItems: 'center', marginTop: spacing.xxl, minHeight: 44, justifyContent: 'center' },
});
