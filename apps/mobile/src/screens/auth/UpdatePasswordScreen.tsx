import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '../../theme';
import { AppText, IconButton } from '../../components/common';
import { useAuthStore } from '../../stores/authStore';
import { authColors } from './authScreenTheme';
import { AuthButton, AuthErrorBox, AuthInput } from './authUi';

const CYAN = '#00E3FC';

interface Req { label: string; met: boolean }

function checkRequirements(pw: string): Req[] {
  return [
    { label: '8+ CARACTERES',       met: pw.length >= 8 },
    { label: 'AL MENOS UN NÚMERO',  met: /\d/.test(pw) },
    { label: 'UNA LETRA MAYÚSCULA', met: /[A-Z]/.test(pw) },
  ];
}

export function UpdatePasswordScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { updatePassword } = useAuthStore();

  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [done, setDone]           = useState(false);

  const reqs = checkRequirements(password);
  const allMet = reqs.every((r) => r.met);
  const matches = password === confirm;
  const canSubmit = allMet && matches && password.length > 0;

  const handleUpdate = async () => {
    if (!canSubmit) return;
    setError(null);
    setLoading(true);
    const ok = await updatePassword(password);
    setLoading(false);
    if (ok) {
      setDone(true);
    } else {
      setError('NO PUDIMOS ACTUALIZAR TU CONTRASEÑA. INTENTÁ DE NUEVO.');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
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
            onPress={() => useAuthStore.setState({ needsPasswordReset: false })}
            accessibilityLabel="Cerrar"
            color={authColors.textPrimary}
            backgroundColor={authColors.surface}
            style={styles.backBtn}
          />
          <AppText variant="h2" style={styles.titleLine} numberOfLines={1} adjustsFontSizeToFit>
            <AppText variant="h2" color={authColors.textPrimary}>NUEVA </AppText>
            <AppText variant="h2" color={authColors.lima}>CONTRASEÑA</AppText>
          </AppText>
        </View>

        <AppText variant="caps11" color={authColors.textTertiary} style={styles.subtitle}>
          ELEGÍ UNA CONTRASEÑA SEGURA PARA PROTEGER TU CUENTA.
        </AppText>

        {done ? (
          /* Success state */
          <View style={styles.successBox}>
            <Ionicons name="checkmark-circle" size={40} color={authColors.lima} style={styles.successIcon} />
            <AppText variant="body14SemiBold" color={authColors.textPrimary} style={styles.successTitle}>
              ¡CONTRASEÑA ACTUALIZADA!
            </AppText>
            <AppText variant="caps11" color={authColors.textSecondary} style={styles.successBody}>
              TU CONTRASEÑA FUE CAMBIADA CON ÉXITO. INICIÁ SESIÓN DE NUEVO CON TU NUEVA CONTRASEÑA.
            </AppText>
            <AuthButton
              label="CONTINUAR"
              onPress={() => useAuthStore.setState({ needsPasswordReset: false })}
              fullWidth
              style={styles.cta}
            />
          </View>
        ) : (
          <>
            <AuthInput
              label="NUEVA CONTRASEÑA"
              icon="lock-closed-outline"
              placeholder="············"
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              value={password}
              onChangeText={(v) => { setPassword(v); setError(null); }}
              containerStyle={styles.field}
            />

            <AuthInput
              label="CONFIRMAR CONTRASEÑA"
              icon="lock-closed-outline"
              placeholder="············"
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              value={confirm}
              onChangeText={(v) => { setConfirm(v); setError(null); }}
              containerStyle={styles.field}
            />

            {/* Requirements panel */}
            <View style={styles.reqBox}>
              <AppText variant="caps11" color={authColors.textTertiary} style={styles.reqTitle}>
                REQUERIMIENTOS DE SEGURIDAD
              </AppText>
              {reqs.map((r) => (
                <View key={r.label} style={styles.reqRow}>
                  <View style={[styles.reqDot, r.met && styles.reqDotMet]}>
                    {r.met && <Ionicons name="checkmark" size={10} color={authColors.background} />}
                  </View>
                  <AppText variant="caps11" color={r.met ? authColors.textPrimary : authColors.textTertiary}>
                    {r.label}
                  </AppText>
                </View>
              ))}
              {confirm.length > 0 && !matches && (
                <View style={styles.reqRow}>
                  <View style={styles.reqDot}>
                    <Ionicons name="close" size={10} color={authColors.background} />
                  </View>
                  <AppText variant="caps11" color={authColors.errorText}>
                    LAS CONTRASEÑAS NO COINCIDEN
                  </AppText>
                </View>
              )}
            </View>

            {/* Tip */}
            <View style={styles.infoBox}>
              <Ionicons name="information-circle-outline" size={20} color={CYAN} />
              <AppText variant="caps11" color={authColors.textSecondary} style={styles.infoText}>
                USÁ UNA CONTRASEÑA ÚNICA QUE NO USES EN OTROS SERVICIOS.
              </AppText>
            </View>

            {error ? <AuthErrorBox message={error} /> : null}

            <AuthButton
              label="ACTUALIZAR CONTRASEÑA"
              onPress={() => void handleUpdate()}
              loading={loading}
              disabled={!canSubmit}
              fullWidth
              style={styles.cta}
            />
          </>
        )}
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

  field: { marginBottom: spacing.md },
  cta:   { marginTop: spacing.md, marginBottom: spacing.xl },

  reqBox: {
    backgroundColor: authColors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: authColors.border,
    padding: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  reqTitle: { letterSpacing: 0.8, marginBottom: spacing.xs },
  reqRow:   { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  reqDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: authColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reqDotMet: { backgroundColor: authColors.lima },

  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: authColors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: authColors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  infoText: { flex: 1, lineHeight: 18, letterSpacing: 0.6 },

  successBox: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xl,
  },
  successIcon:  { marginBottom: spacing.sm },
  successTitle: { textAlign: 'center', letterSpacing: -0.3 },
  successBody:  { textAlign: 'center', lineHeight: 18, letterSpacing: 0.6 },
});
