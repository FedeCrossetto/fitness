import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import type { InvitePreview } from '@reset-fitness/shared';
import { spacing } from '../../theme';
import { AppText, IconButton } from '../../components/common';
import { useAuthStore } from '../../stores/authStore';
import { fetchInvitePreview, readPendingInviteCode } from '../../services/invite';
import type { AuthStackParamList } from '../../types/navigation';
import { authColors } from './authScreenTheme';
import { AuthButton, AuthErrorBox, AuthInput, AuthSocialLoginCard } from './authUi';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignUp'>;
type CodeStatus = 'idle' | 'loading' | 'valid' | 'invalid';

const HARDCODED_CODE = 'RESETINV';

export function SignUpScreen({ navigation, route }: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { signUp, signInWithOAuth, loading, oauthProvider, error, clearError } = useAuthStore();

  const [fullName, setFullName] = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [trainerCode, setTrainerCode] = useState(
    route.params?.code ?? HARDCODED_CODE,
  );
  const [codeStatus, setCodeStatus] = useState<CodeStatus>('idle');
  const [preview, setPreview]       = useState<InvitePreview | null>(null);
  const [fieldError, setFieldError] = useState<{ name?: string; email?: string; password?: string }>({});

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [codeSelection, setCodeSelection] = useState<{ start: number; end: number } | undefined>();

  const handleCodeFocus = () => {
    const end = trainerCode.length;
    setCodeSelection({ start: end, end });
    setTimeout(() => setCodeSelection(undefined), 100);
  };

  const validateCode = useCallback(async (rawCode: string) => {
    const code = rawCode.trim().toUpperCase();
    if (!code) { setCodeStatus('idle'); setPreview(null); return; }

    setCodeStatus('loading');
    setPreview(null);

    const data = await fetchInvitePreview(code);
    if (!data) { setCodeStatus('invalid'); return; }

    setPreview(data);
    setCodeStatus('valid');
    setTrainerCode(data.invite_code);
  }, []);

  // Auto-validate on mount using hardcoded code or deeplink code
  useEffect(() => {
    void (async () => {
      const initial = route.params?.code ?? (await readPendingInviteCode()) ?? HARDCODED_CODE;
      setTrainerCode(initial);
      await validateCode(initial);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live validation on every keystroke (debounced 400 ms)
  const handleCodeChange = (value: string) => {
    const upper = value.toUpperCase();
    setTrainerCode(upper);
    setCodeStatus('idle');
    setPreview(null);
    if (error) clearError();

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void validateCode(upper);
    }, 400);
  };

  const handleSignUp = async () => {
    if (codeStatus !== 'valid' || !preview) return;

    const errors: typeof fieldError = {};
    if (fullName.trim().length < 2) errors.name = 'Ingresá tu nombre.';
    if (!email.includes('@'))       errors.email = 'Ingresá un email válido.';
    if (password.length < 6)        errors.password = 'Mínimo 6 caracteres.';
    setFieldError(errors);
    if (Object.keys(errors).length > 0) return;

    const result = await signUp(email, password, fullName, preview.invite_code);
    if (result === 'verify') {
      navigation.navigate('VerifyEmail', { email: email.trim(), password });
    }
    // 'session' → RootNavigator navega solo · 'error' → se muestra en AuthErrorBox
  };

  const codeValidated = codeStatus === 'valid' && preview != null;

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xl, flexGrow: 1, justifyContent: 'center' },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <IconButton
            icon="chevron-back"
            onPress={() => navigation.goBack()}
            accessibilityLabel="Volver"
            color={authColors.textPrimary}
            backgroundColor={authColors.surface}
            style={styles.backBtn}
          />
          <AppText variant="h2" color={authColors.textPrimary} style={styles.title}>
            CREÁ TU CUENTA
          </AppText>
        </View>
        <AppText variant="caps11" color={authColors.textTertiary} style={styles.subtitle}>
          COMPLETÁ TUS DATOS PARA COMENZAR
        </AppText>

        {/* Code input — always visible, auto-filled */}
        <View style={styles.codeBlock}>
          <AuthInput
            label="CÓDIGO DE INVITACIÓN"
            icon="key-outline"
            placeholder="RESETINV"
            autoCapitalize="characters"
            autoCorrect={false}
            value={trainerCode}
            selection={codeSelection}
            onFocus={handleCodeFocus}
            onChangeText={handleCodeChange}
            containerStyle={styles.codeField}
          />

          {/* Tooltip */}
          {codeStatus === 'loading' && (
            <View style={styles.tooltipRow}>
              <ActivityIndicator size="small" color={authColors.textTertiary} />
              <AppText variant="caps11" color={authColors.textTertiary}>
                VERIFICANDO…
              </AppText>
            </View>
          )}
          {codeStatus === 'valid' && (
            <View style={styles.tooltipRow}>
              <Ionicons name="checkmark-circle" size={16} color="#C1ED00" />
              <AppText variant="caps11" color="#C1ED00">
                TE ESTÁS SUMANDO AL TEAM DE ALE GEREZ
              </AppText>
            </View>
          )}
          {codeStatus === 'invalid' && (
            <View style={styles.tooltipRow}>
              <Ionicons name="close-circle" size={16} color={authColors.errorText} />
              <AppText variant="caps11" color={authColors.errorText}>
                CÓDIGO INVÁLIDO
              </AppText>
            </View>
          )}
        </View>

        {/* Fields — only when code is valid */}
        {codeValidated ? (
          <>
            <AuthInput
              label="NOMBRE COMPLETO"
              icon="person-outline"
              placeholder="Ej: Martina López"
              autoComplete="name"
              value={fullName}
              onChangeText={(v) => { setFullName(v); if (error) clearError(); }}
              error={fieldError.name}
              containerStyle={styles.field}
            />
            <AuthInput
              label="EMAIL"
              icon="mail-outline"
              placeholder="tu@email.com"
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              value={email}
              onChangeText={(v) => { setEmail(v); if (error) clearError(); }}
              error={fieldError.email}
              containerStyle={styles.field}
            />
            <AuthInput
              label="CONTRASEÑA"
              icon="lock-closed-outline"
              placeholder="Mínimo 6 caracteres"
              secureTextEntry
              autoComplete="new-password"
              value={password}
              onChangeText={(v) => { setPassword(v); if (error) clearError(); }}
              error={fieldError.password}
              containerStyle={styles.field}
            />

            {error ? <AuthErrorBox message={error} /> : null}

            <AuthButton
              label="CREAR CUENTA"
              onPress={() => void handleSignUp()}
              loading={loading}
              disabled={!fullName || !email || !password}
              fullWidth
              style={styles.cta}
            />

            <View style={styles.dividerRow}>
              <View style={styles.divider} />
              <AppText variant="caps11" color={authColors.textDisabled}>O</AppText>
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
          <AppText variant="caps11" color={authColors.textSecondary}>
            ¿YA TENÉS CUENTA?{' '}
            <AppText variant="caps11" color="#C1ED00">
              INICIÁ SESIÓN
            </AppText>
          </AppText>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex:    { flex: 1, backgroundColor: authColors.background },
  content: { paddingHorizontal: spacing.xl },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.xs,
  },
  backBtn: { borderColor: authColors.border, flexShrink: 0 },
  title:   { flex: 1, letterSpacing: -0.5 },
  subtitle:{ marginBottom: spacing.xl, letterSpacing: 1.2 },

  codeBlock: { marginBottom: spacing.md },
  codeField: { marginBottom: spacing.xs },

  tooltipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
    marginBottom: spacing.sm,
  },

  field:  { marginBottom: spacing.md },
  cta:    { marginTop: spacing.xs },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  divider:     { flex: 1, height: 1, backgroundColor: authColors.border },
  loadingHint: { alignItems: 'center', paddingVertical: spacing.xl },
  footer:      { alignItems: 'center', marginTop: spacing.xl, minHeight: 44, justifyContent: 'center' },
});
