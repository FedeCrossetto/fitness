import React, { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TextInputKeyPressEventData,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { spacing, typography } from '../../theme';
import { AppText, IconButton } from '../../components/common';
import { useAuthStore } from '../../stores/authStore';
import type { AuthStackParamList } from '../../types/navigation';
import { authColors } from './authScreenTheme';
import { AuthButton, AuthErrorBox } from './authUi';

type Props = NativeStackScreenProps<AuthStackParamList, 'VerifyEmail'>;

const CODE_LENGTH = 6;
const RESEND_COOLDOWN = 45; // segundos

export function VerifyEmailScreen({ navigation, route }: Props): React.JSX.Element {
  const { email, password } = route.params;
  const insets = useSafeAreaInsets();
  const { verifyEmailOtp, resendEmailOtp, loading, error, clearError } = useAuthStore();

  const [code, setCode]         = useState('');
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN);
  const [resent, setResent]     = useState(false);
  // 6 inputs REALES (uno por dígito), no un input invisible superpuesto a
  // cajitas decorativas. El truco de "input invisible + overlay" competía con
  // gestos nativos de iOS (probablemente el swipe-back de navegación o el
  // ScrollView) de forma frágil: el toque simple llegaba, pero el long-press
  // para seleccionar/pegar no, y en algunos casos hasta perdía el foco sin
  // volver a recuperarlo. Con inputs reales en su posición real, el sistema
  // operativo maneja foco/selección/pegado de forma nativa, sin necesidad de
  // ningún truco de opacidad ni z-index.
  const inputRefs = useRef<Array<TextInput | null>>([]);

  // Cuenta regresiva para reenviar
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  // Auto-verificar al completar los 6 dígitos
  useEffect(() => {
    if (code.length === CODE_LENGTH) {
      void handleVerify(code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const handleVerify = async (value: string) => {
    if (value.length !== CODE_LENGTH || loading) return;
    const ok = await verifyEmailOtp(email, value, password);
    if (!ok) {
      setCode('');
      inputRefs.current[0]?.focus();
    }
    // Si ok: RootNavigator detecta la sesión y navega solo.
  };

  // El autofill de iOS/Android (o un pegado) puede entregar el código
  // COMPLETO en el `onChangeText` de un solo box, aunque `maxLength` diga 1 —
  // eso no limita lo que el sistema entrega, solo lo que se ve. Si el texto
  // que llega tiene más de un carácter, lo tratamos como "llegó todo el
  // código de una" y lo repartimos, en vez de tratarlo como un dígito suelto.
  const handleBoxChange = (index: number, value: string) => {
    if (value.length > 1) {
      const digits = value.replace(/\D/g, '').slice(0, CODE_LENGTH);
      setCode(digits);
      if (error) clearError();
      inputRefs.current[Math.min(digits.length, CODE_LENGTH - 1)]?.focus();
      return;
    }

    const next = code.split('');
    next[index] = value;
    setCode(next.join('').replace(/\D/g, '').slice(0, CODE_LENGTH));
    if (error) clearError();

    if (value && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (index: number, e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
    if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    const ok = await resendEmailOtp(email);
    if (ok) {
      setResent(true);
      setCooldown(RESEND_COOLDOWN);
      setTimeout(() => setResent(false), 3000);
    }
  };

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
        {/* Header row: back + title */}
        <View style={styles.headerRow}>
          <IconButton
            icon="chevron-back"
            onPress={() => navigation.goBack()}
            accessibilityLabel="Volver"
            color={authColors.textPrimary}
            backgroundColor={authColors.surface}
            style={styles.backBtn}
          />
          <AppText variant="h2" style={styles.titleLine} numberOfLines={1} adjustsFontSizeToFit>
            <AppText variant="h2" color={authColors.textPrimary}>CONFIRMÁ TU </AppText>
            <AppText variant="h2" color={authColors.lima}>EMAIL</AppText>
          </AppText>
        </View>

        <AppText variant="caps11" color={authColors.textTertiary} style={styles.subtitle}>
          INGRESÁ EL CÓDIGO DE 6 DÍGITOS QUE ENVIAMOS A{'\n'}
          <AppText variant="caps11" color={authColors.textSecondary}>{email.toUpperCase()}</AppText>
        </AppText>

        {/* 6 inputs reales — cada uno es el propio campo de texto en su
            posición real en pantalla, no una cajita decorativa con un input
            invisible superpuesto. Así el foco, tipeo, selección y pegado (con
            long-press nativo) los maneja el sistema operativo directamente,
            sin ningún truco de opacidad/z-index que compita con sus propios
            gestos. */}
        <View style={styles.otpRow}>
          {Array.from({ length: CODE_LENGTH }).map((_, i) => {
            const filled = !!code[i];
            const active = i === code.length;
            return (
              <TextInput
                key={i}
                ref={(r) => { inputRefs.current[i] = r; }}
                value={code[i] ?? ''}
                onChangeText={(v) => handleBoxChange(i, v)}
                onKeyPress={(e) => handleKeyPress(i, e)}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete="sms-otp"
                maxLength={CODE_LENGTH}
                autoFocus={i === 0}
                selectTextOnFocus
                style={[styles.otpBox, filled && styles.otpBoxFilled, active && styles.otpBoxActive]}
              />
            );
          })}
        </View>

        {error ? <AuthErrorBox message={error} /> : null}

        <AuthButton
          label="CONFIRMAR CUENTA"
          onPress={() => void handleVerify(code)}
          loading={loading}
          disabled={code.length !== CODE_LENGTH}
          fullWidth
          style={styles.cta}
        />

        {/* Reenviar */}
        <View style={styles.resendRow}>
          {resent ? (
            <View style={styles.resentBadge}>
              <Ionicons name="checkmark-circle" size={14} color={authColors.lima} />
              <AppText variant="caps11" color={authColors.lima}>CÓDIGO REENVIADO</AppText>
            </View>
          ) : cooldown > 0 ? (
            <AppText variant="caps11" color={authColors.textDisabled}>
              REENVIAR CÓDIGO EN {cooldown}S
            </AppText>
          ) : (
            <Pressable onPress={() => void handleResend()} accessibilityRole="button" hitSlop={8}>
              <AppText variant="caps11" color={authColors.textTertiary}>
                ¿NO LLEGÓ?{'  '}
                <AppText variant="caps11" color={authColors.lima}>REENVIAR CÓDIGO</AppText>
              </AppText>
            </Pressable>
          )}
        </View>

        {/* Tip */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={20} color="#00E3FC" />
          <AppText variant="caps11" color={authColors.textSecondary} style={styles.infoText}>
            REVISÁ TU CARPETA DE SPAM SI NO VES EL EMAIL EN UNOS MINUTOS.
          </AppText>
        </View>
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
    marginBottom: spacing.sm,
  },
  backBtn:   { borderColor: authColors.border, flexShrink: 0 },
  titleLine: { flex: 1, letterSpacing: -0.5 },
  subtitle:  { marginBottom: spacing.xl, lineHeight: 18, letterSpacing: 0.8 },

  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  otpBox: {
    flex: 1,
    aspectRatio: 0.82,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: authColors.border,
    backgroundColor: authColors.surface,
    textAlign: 'center',
    fontSize: 22,
    fontFamily: typography.h2.fontFamily,
    color: authColors.textPrimary,
    padding: 0,
  },
  otpBoxFilled: { borderColor: 'rgba(193,237,0,0.4)' },
  otpBoxActive: { borderColor: authColors.lima },

  cta: { marginTop: spacing.md },

  resendRow: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    marginTop: spacing.lg,
  },
  resentBadge: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },

  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: authColors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: authColors.border,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  infoText: { flex: 1, lineHeight: 18, letterSpacing: 0.6 },
});
