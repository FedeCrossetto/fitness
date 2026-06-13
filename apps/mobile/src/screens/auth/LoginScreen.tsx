import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { illustrations, spacing, radius, Colors, useThemedStyles, useTheme } from '../../theme';
import { clientConfig } from '../../config/clientConfig';
import { AppText, Button, Input } from '../../components/common';
import { useAuthStore } from '../../stores/authStore';
import type { AuthStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  const insets = useSafeAreaInsets();
  const { signIn, signInWithOAuth, loading, error, clearError } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);

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
          { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroWrap}>
          <Image source={illustrations.hero} style={styles.mascot} contentFit="contain" priority="high" />
        </View>

        <AppText variant="h1" color={colors.text.primary}>
          {clientConfig.copy.welcomeTitle}
        </AppText>
        <AppText variant="body14" color={colors.text.secondary} style={styles.subtitle}>
          {clientConfig.copy.welcomeSubtitle}
        </AppText>

        <Input
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
        <Input
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

        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={16} color={colors.states.error} />
            <AppText variant="body13" color={colors.states.error} style={styles.errorText}>
              {error}
            </AppText>
          </View>
        ) : null}

        <Button
          label="Iniciar sesión"
          onPress={handleLogin}
          loading={loading}
          disabled={!email || !password}
          fullWidth
          style={styles.cta}
        />

        <View style={styles.dividerRow}>
          <View style={styles.divider} />
          <AppText variant="caps11" color={colors.text.disabled}>
            o continuar con
          </AppText>
          <View style={styles.divider} />
        </View>

        <View style={styles.oauthRow}>
          <Button
            label="Apple"
            icon="logo-apple"
            variant="secondary"
            onPress={() => void signInWithOAuth('apple')}
            style={styles.oauthButton}
          />
          <Button
            label="Google"
            icon="logo-google"
            variant="secondary"
            onPress={() => void signInWithOAuth('google')}
            style={styles.oauthButton}
          />
        </View>

        <Pressable
          onPress={() => navigation.navigate('SignUp')}
          style={styles.footer}
          accessibilityRole="button"
        >
          <AppText variant="body14" color={colors.text.secondary}>
            ¿No tenés cuenta?{' '}
            <AppText variant="body14SemiBold" color={colors.primary.default}>
              Registrate
            </AppText>
          </AppText>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: Colors) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.xl },
  heroWrap: { alignItems: 'center', marginBottom: spacing.lg },
  mascot: { width: 150, height: 195 },
  subtitle: { marginTop: spacing.xs, marginBottom: spacing.xl },
  field: { marginBottom: spacing.md },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  errorText: { flexShrink: 1 },
  cta: { marginTop: spacing.xs },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginVertical: spacing.xl,
  },
  divider: { flex: 1, height: 1, backgroundColor: colors.border.default },
  oauthRow: { flexDirection: 'row', gap: spacing.sm },
  oauthButton: { flex: 1 },
  footer: { alignItems: 'center', marginTop: spacing.xxl, minHeight: 44, justifyContent: 'center' },
});
