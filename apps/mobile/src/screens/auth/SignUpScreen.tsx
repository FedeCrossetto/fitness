import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { resolveAvatarUrl } from '../../lib/avatarUrl';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { InvitePreview } from '@reset-fitness/shared';
import { radius, spacing } from '../../theme';
import { AppText, IconButton } from '../../components/common';
import { useAuthStore } from '../../stores/authStore';
import { fetchInvitePreview, readPendingInviteCode } from '../../services/invite';
import type { AuthStackParamList } from '../../types/navigation';
import { authColors } from './authScreenTheme';
import { AuthButton, AuthErrorBox, AuthInput, AuthSocialLoginCard } from './authUi';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignUp'>;

type CodeStatus = 'idle' | 'loading' | 'valid' | 'invalid';

function trainerInitials(name: string | null | undefined): string {
  if (!name?.trim()) return '?';
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : '';
  return (first + last).toUpperCase() || '?';
}

export function SignUpScreen({ navigation, route }: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { signUp, signInWithOAuth, loading, oauthProvider, error, clearError } = useAuthStore();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [trainerCode, setTrainerCode] = useState(route.params?.code ?? '');
  const [codeStatus, setCodeStatus] = useState<CodeStatus>('idle');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [fieldError, setFieldError] = useState<{ name?: string; email?: string; password?: string }>({});

  const validateCode = useCallback(async (rawCode: string) => {
    const code = rawCode.trim();
    if (!code) {
      setCodeStatus('idle');
      setCodeError('Ingresá el código de invitación.');
      setPreview(null);
      return false;
    }

    setCodeStatus('loading');
    setCodeError(null);
    setPreview(null);

    const data = await fetchInvitePreview(code);
    if (!data) {
      setCodeStatus('invalid');
      setCodeError('El código no existe o no es válido.');
      return false;
    }

    setPreview(data);
    setCodeStatus('valid');
    setTrainerCode(data.invite_code);
    return true;
  }, []);

  useEffect(() => {
    void (async () => {
      if (route.params?.code) {
        await validateCode(route.params.code);
        return;
      }
      const pending = await readPendingInviteCode();
      if (pending) {
        setTrainerCode(pending);
        await validateCode(pending);
      }
    })();
  }, [route.params?.code, validateCode]);

  const handleCodeChange = (value: string) => {
    setTrainerCode(value);
    if (codeStatus !== 'idle') {
      setCodeStatus('idle');
      setPreview(null);
      setCodeError(null);
    }
    if (error) clearError();
  };

  const handleSignUp = () => {
    if (codeStatus !== 'valid' || !preview) {
      void validateCode(trainerCode);
      return;
    }

    const errors: typeof fieldError = {};
    if (fullName.trim().length < 2) errors.name = 'Ingresá tu nombre.';
    if (!email.includes('@')) errors.email = 'Ingresá un email válido.';
    if (password.length < 6) errors.password = 'Mínimo 6 caracteres.';
    setFieldError(errors);
    if (Object.keys(errors).length > 0) return;
    void signUp(email, password, fullName, preview.invite_code);
  };

  const codeValidated = codeStatus === 'valid' && preview != null;

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
          color={authColors.textPrimary}
          backgroundColor={authColors.surface}
          style={styles.backBtn}
        />

        <AppText variant="h1" color={authColors.textPrimary} style={styles.title}>
          Creá tu cuenta
        </AppText>
        <AppText variant="body14" color={authColors.textSecondary} style={styles.subtitle}>
          {codeValidated
            ? 'Completá tus datos para unirte a tu entrenador.'
            : 'Primero validá el código que te compartió tu entrenador.'}
        </AppText>

        <View style={styles.codeBlock}>
          <AuthInput
            label="Código de entrenador"
            icon="key-outline"
            placeholder="Tu código"
            autoCapitalize="characters"
            autoCorrect={false}
            value={trainerCode}
            onChangeText={handleCodeChange}
            error={codeError}
            containerStyle={styles.codeField}
          />
          <AuthButton
            label={codeStatus === 'loading' ? 'Validando…' : 'Validar código'}
            onPress={() => void validateCode(trainerCode)}
            loading={codeStatus === 'loading'}
            disabled={!trainerCode.trim() || codeStatus === 'loading'}
            fullWidth
          />
        </View>

        {preview && codeValidated ? (
          <View style={styles.trainerCard}>
            <View style={styles.trainerAvatarWrap}>
              {resolveAvatarUrl(preview.trainer_avatar_url) ? (
                <Image
                  source={{ uri: resolveAvatarUrl(preview.trainer_avatar_url)! }}
                  style={styles.trainerAvatar}
                  contentFit="cover"
                />
              ) : (
                <View style={styles.trainerAvatarFallback}>
                  <AppText variant="body16SemiBold" color={authColors.textPrimary}>
                    {trainerInitials(preview.trainer_name)}
                  </AppText>
                </View>
              )}
              <View style={styles.checkBadge}>
                <Ionicons name="checkmark" size={14} color={authColors.background} />
              </View>
            </View>
            <View style={styles.trainerInfo}>
              <AppText variant="body16SemiBold" color={authColors.textPrimary} numberOfLines={1}>
                {preview.trainer_name ?? 'Tu entrenador'}
              </AppText>
              <AppText variant="body12" color={authColors.textTertiary} numberOfLines={1}>
                {preview.app_name}
              </AppText>
            </View>
          </View>
        ) : null}

        {codeValidated ? (
          <>
            <AuthInput
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
              error={fieldError.email}
              containerStyle={styles.field}
            />
            <AuthInput
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

            {error ? <AuthErrorBox message={error} /> : null}

            <AuthButton
              label="Crear cuenta"
              onPress={handleSignUp}
              loading={loading}
              disabled={!fullName || !email || !password}
              fullWidth
              style={styles.cta}
            />

            <View style={styles.dividerRow}>
              <View style={styles.divider} />
              <AppText variant="caps11" color={authColors.textDisabled}>
                o
              </AppText>
              <View style={styles.divider} />
            </View>

            <AuthSocialLoginCard
              onGoogle={() => void signInWithOAuth('google', preview.invite_code, 'signup')}
              onApple={() => void signInWithOAuth('apple', preview.invite_code, 'signup')}
              loadingProvider={oauthProvider}
              disabled={loading && !oauthProvider}
            />
          </>
        ) : codeStatus === 'loading' ? (
          <View style={styles.loadingHint}>
            <ActivityIndicator color={authColors.textTertiary} />
          </View>
        ) : null}

        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.footer}
          accessibilityRole="button"
        >
          <AppText variant="body14" color={authColors.textSecondary}>
            ¿Ya tenés cuenta?{' '}
            <AppText variant="body14SemiBold" color={authColors.textPrimary}>
              Iniciá sesión
            </AppText>
          </AppText>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const AVATAR_SIZE = 52;

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: authColors.background },
  content: { paddingHorizontal: spacing.xl },
  backBtn: { borderColor: authColors.border },
  title: { marginTop: spacing.xl },
  subtitle: { marginTop: spacing.xs, marginBottom: spacing.lg },
  codeBlock: { marginBottom: spacing.md },
  codeField: { marginBottom: spacing.sm },
  trainerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    backgroundColor: authColors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: authColors.border,
  },
  trainerAvatarWrap: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
  },
  trainerAvatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: authColors.border,
  },
  trainerAvatarFallback: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: authColors.background,
    borderWidth: 1,
    borderColor: authColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#22A06B',
    borderWidth: 2,
    borderColor: authColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trainerInfo: { flex: 1, minWidth: 0 },
  field: { marginBottom: spacing.md },
  cta: { marginTop: spacing.xs },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  divider: { flex: 1, height: 1, backgroundColor: authColors.border },
  loadingHint: { alignItems: 'center', paddingVertical: spacing.xl },
  footer: { alignItems: 'center', marginTop: spacing.xl, minHeight: 44, justifyContent: 'center' },
});
