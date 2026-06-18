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
import { defaultClientConfig } from '../../config/clientConfig';
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
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xl },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.logoWrap}>
          <Image
            source={brandAssets.r3setLogo}
            style={styles.logo}
            contentFit="contain"
            accessibilityLabel="R3SET"
            priority="high"
          />
        </View>
        <AppText variant="body14" color={authColors.textSecondary} style={styles.subtitle}>
          {defaultClientConfig.copy.welcomeSubtitle}
        </AppText>

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

        <AppText variant="body13" color={authColors.textTertiary} style={styles.oauthHint}>
          ¿Primera vez? Registrate con el código de invitación de tu entrenador.
        </AppText>

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
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: authColors.background },
  content: { paddingHorizontal: spacing.xl },
  logoWrap: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  logo: {
    width: 140,
    height: 137,
  },
  subtitle: { textAlign: 'center', marginBottom: spacing.xxl },
  field: { marginBottom: spacing.md },
  cta: { marginTop: spacing.xs },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginVertical: spacing.xl,
  },
  divider: { flex: 1, height: 1, backgroundColor: authColors.border },
  oauthHint: { textAlign: 'center', marginTop: spacing.sm, lineHeight: 18 },
  footer: { alignItems: 'center', marginTop: spacing.xxl, minHeight: 44, justifyContent: 'center' },
});
