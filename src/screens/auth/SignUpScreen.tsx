import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, spacing, radius } from '../../theme';
import { AppText, Button, IconButton, Input } from '../../components/common';
import { useAuthStore } from '../../stores/authStore';
import type { AuthStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignUp'>;

export function SignUpScreen({ navigation }: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { signUp, signInWithOAuth, loading, error, clearError } = useAuthStore();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldError, setFieldError] = useState<{ name?: string; email?: string; password?: string }>({});

  const handleSignUp = () => {
    const errors: typeof fieldError = {};
    if (fullName.trim().length < 2) errors.name = 'Ingresá tu nombre.';
    if (!email.includes('@')) errors.email = 'Ingresá un email válido.';
    if (password.length < 6) errors.password = 'Mínimo 6 caracteres.';
    setFieldError(errors);
    if (Object.keys(errors).length > 0) return;
    void signUp(email, password, fullName);
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xl },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <IconButton
          icon="chevron-back"
          onPress={() => navigation.goBack()}
          accessibilityLabel="Volver"
        />

        <AppText variant="h1" color={colors.text.primary} style={styles.title}>
          Creá tu cuenta
        </AppText>
        <AppText variant="body14" color={colors.text.secondary} style={styles.subtitle}>
          Tu entrenador, tu nutrición y tu progreso. Empezamos en 1 minuto.
        </AppText>

        <Input
          label="Nombre completo"
          icon="person-outline"
          placeholder="Ej: Martina López"
          autoComplete="name"
          value={fullName}
          onChangeText={(v) => {
            setFullName(v);
            if (error) clearError();
          }}
          error={fieldError.name}
          containerStyle={styles.field}
        />
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
          error={fieldError.email}
          containerStyle={styles.field}
        />
        <Input
          label="Contraseña"
          icon="lock-closed-outline"
          placeholder="Mínimo 6 caracteres"
          secureTextEntry
          autoComplete="new-password"
          value={password}
          onChangeText={(v) => {
            setPassword(v);
            if (error) clearError();
          }}
          error={fieldError.password}
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
          label="Crear cuenta"
          onPress={handleSignUp}
          loading={loading}
          disabled={!fullName || !email || !password}
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
          onPress={() => navigation.goBack()}
          style={styles.footer}
          accessibilityRole="button"
        >
          <AppText variant="body14" color={colors.text.secondary}>
            ¿Ya tenés cuenta?{' '}
            <AppText variant="body14SemiBold" color={colors.primary.default}>
              Iniciá sesión
            </AppText>
          </AppText>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.xl },
  title: { marginTop: spacing.xl },
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
  footer: { alignItems: 'center', marginTop: spacing.xl, minHeight: 44, justifyContent: 'center' },
});
