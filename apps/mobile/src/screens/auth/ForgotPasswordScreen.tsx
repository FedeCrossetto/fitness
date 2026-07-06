import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { spacing } from '../../theme';
import { AppText, IconButton } from '../../components/common';
import { useAuthStore } from '../../stores/authStore';
import type { AuthStackParamList } from '../../types/navigation';
import { authColors } from './authScreenTheme';
import { AuthButton, AuthErrorBox, AuthInput } from './authUi';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

export function ForgotPasswordScreen({ navigation }: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { resetPassword } = useAuthStore();

  const [email, setEmail]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const providerLabel = (provider: string) => {
    if (provider === 'apple') return 'Apple';
    if (provider === 'google') return 'Google';
    return provider;
  };

  const handleSend = async () => {
    if (!email.includes('@')) {
      setError('INGRESÁ UN EMAIL VÁLIDO.');
      return;
    }
    setError(null);
    setLoading(true);
    const result = await resetPassword(email);
    setLoading(false);
    if (result.status === 'sent') {
      navigation.navigate('PasswordResetSent', { email });
    } else if (result.status === 'oauth') {
      setError(
        `ESTA CUENTA USA ${providerLabel(result.provider ?? 'GOOGLE/APPLE').toUpperCase()} PARA INICIAR SESIÓN. VOLVÉ E INICIÁ SESIÓN CON ESE MÉTODO.`,
      );
    } else {
      setError('NO PUDIMOS ENCONTRAR ESA CUENTA. VERIFICÁ EL EMAIL.');
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
            onPress={() => navigation.goBack()}
            accessibilityLabel="Volver"
            color={authColors.textPrimary}
            backgroundColor={authColors.surface}
            style={styles.backBtn}
          />
          <AppText variant="h2" style={styles.titleLine} numberOfLines={1} adjustsFontSizeToFit>
            <AppText variant="h2" color={authColors.textPrimary}>RECUPERAR </AppText>
            <AppText variant="h2" color="#C1ED00">ACCESO</AppText>
          </AppText>
        </View>

        <AppText variant="caps11" color={authColors.textTertiary} style={styles.subtitle}>
          INGRESÁ EL EMAIL ASOCIADO A TU CUENTA PARA RECIBIR LAS INSTRUCCIONES DE RECUPERACIÓN.
        </AppText>

        {/* Email input */}
        <AuthInput
          label="EMAIL DE USUARIO"
          icon="mail-outline"
          placeholder="nombre@ejemplo.com"
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          value={email}
          onChangeText={(v) => { setEmail(v); setError(null); }}
          containerStyle={styles.field}
        />

        {error ? <AuthErrorBox message={error} /> : null}

        {/* Info tooltip — always visible */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={20} color="#00E3FC" />
          <AppText variant="caps11" color={authColors.textSecondary} style={styles.infoText}>
            REVISÁ TU CARPETA DE SPAM. SI NO RECIBÍS EL EMAIL, PODÉS CONTACTAR A SOPORTE.
          </AppText>
        </View>

        <AuthButton
          label="ENVIAR INSTRUCCIONES"
          onPress={() => void handleSend()}
          loading={loading}
          disabled={!email}
          fullWidth
          style={styles.cta}
        />

        {/* Footer links */}
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.footerLink}
          accessibilityRole="button"
        >
          <AppText variant="caps11" color={authColors.textTertiary}>
            ¿RECORDASTE TU CONTRASEÑA?{'  '}
            <AppText variant="caps11" color="#C1ED00">
              INICIÁ SESIÓN
            </AppText>
          </AppText>
        </Pressable>

        <Pressable
          onPress={() => void Linking.openURL('mailto:soporte@metodor3set.com')}
          style={styles.supportLink}
          accessibilityRole="button"
        >
          <Ionicons name="headset-outline" size={14} color={authColors.textDisabled} />
          <AppText variant="caps11" color={authColors.textDisabled}>
            CONTACTAR A SOPORTE
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
    marginBottom: spacing.sm,
  },
  backBtn: { borderColor: authColors.border, flexShrink: 0 },
  titleLine: { flex: 1, letterSpacing: -0.5 },
  subtitle: { marginBottom: spacing.xl, lineHeight: 18, letterSpacing: 0.8 },

  field: { marginBottom: spacing.md },
  cta:   { marginBottom: spacing.xl },

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

  footerLink: {
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  supportLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    minHeight: 44,
  },
});
