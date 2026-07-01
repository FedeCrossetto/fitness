import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '../../theme';
import { AppText } from '../../components/common';
import { SignaturePad, serializeStrokes, type Stroke } from '../../components/waiver/SignaturePad';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { useTranslation } from '../../stores/i18nStore';
import { authColors } from '../auth/authScreenTheme';

const LIMA = '#C1ED00';
const H_PAD = spacing.xl;

interface ImageConsentConfig {
  title: string;
  body: string;
}

type ImageConsentStatus = 'accepted' | 'declined' | null;

interface ImageConsentScreenProps {
  config: ImageConsentConfig;
  trainerId: string;
  onAccepted: () => void;
  onSkip?: () => void;
  /** Estado actual cuando se abre desde Perfil, para mostrar la respuesta previa. */
  initialStatus?: ImageConsentStatus;
  initialFullName?: string;
  respondedAtLabel?: string | null;
  embedded?: boolean;
  bottomInset?: number;
}

const anyClient = supabase as unknown as { from: (t: string) => ReturnType<typeof supabase.from> };

export function ImageConsentScreen({
  config,
  trainerId,
  onAccepted,
  onSkip,
  initialStatus = null,
  initialFullName,
  respondedAtLabel,
  embedded = false,
  bottomInset = 0,
}: ImageConsentScreenProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { width: screenWidth } = useWindowDimensions();
  const profile = useAuthStore((s) => s.profile);
  const [fullName, setFullName] = useState(initialFullName ?? profile?.full_name ?? '');
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [saving, setSaving] = useState<'accept' | 'decline' | null>(null);
  const [drawingSignature, setDrawingSignature] = useState(false);
  const [status, setStatus] = useState<ImageConsentStatus>(initialStatus);

  const padWidth = screenWidth - H_PAD * 2;
  const canAccept = strokes.length > 0 && fullName.trim().length > 0;

  const saveResponse = async (
    responseStatus: 'accepted' | 'declined',
    signatureData: string | null,
  ): Promise<{ ok: boolean; error?: string }> => {
    // OJO: no llamar a refreshProfile() acá. Dispara un cambio de `profile` en el
    // store, que hace que RootNavigator vuelva a chequear el gate de imagen ANTES
    // de que este RPC termine de guardar la respuesta — encontraba "todavía no hay
    // fila" y reabría la pantalla un instante, para cerrarse sola en el siguiente
    // recheck. `profile` (reactivo) ya tiene el trainer_id/id correctos acá.
    const resolvedTrainerId = profile?.trainer_id ?? trainerId;
    const clientId = profile?.id;
    if (!clientId || !resolvedTrainerId) return { ok: false, error: 'no_trainer_linked' };

    const payload = {
      p_trainer_id: resolvedTrainerId,
      p_full_name: fullName.trim(),
      p_document_snapshot: config.body ?? '',
      p_document_title: config.title ?? 'Consentimiento de uso de imágenes',
      p_signature_data: signatureData,
      p_status: responseStatus,
    };

    const { error: rpcError } = await supabase.rpc('save_client_image_consent', payload);
    if (!rpcError) return { ok: true };

    const rpcMessage = rpcError.message ?? 'rpc_failed';
    if (__DEV__) console.warn('[image_consent] RPC failed:', rpcMessage, rpcError);

    const { error: upsertError } = await anyClient.from('image_consent_acceptances').upsert({
      client_id: clientId,
      trainer_id: resolvedTrainerId,
      full_name: fullName.trim(),
      document_snapshot: config.body ?? '',
      document_title: config.title ?? 'Consentimiento de uso de imágenes',
      signature_data: signatureData,
      status: responseStatus,
      accepted_at: new Date().toISOString(),
    }, { onConflict: 'client_id,trainer_id' });

    if (!upsertError) return { ok: true };

    const upsertMessage = upsertError.message ?? 'upsert_failed';
    if (__DEV__) console.warn('[image_consent] upsert failed:', upsertMessage, upsertError);
    return { ok: false, error: rpcMessage || upsertMessage };
  };

  const handleAccept = useCallback(async () => {
    if (!fullName.trim()) {
      Alert.alert(t.image_consent.name_required, t.image_consent.name_required_msg);
      return;
    }
    if (strokes.length === 0) {
      Alert.alert(t.image_consent.sig_required, t.image_consent.sig_required_msg);
      return;
    }
    if (!profile?.id) return;
    setSaving('accept');
    const result = await saveResponse('accepted', serializeStrokes(strokes));
    setSaving(null);
    if (!result.ok) {
      const detail = __DEV__ && result.error ? `\n\n${result.error}` : '';
      Alert.alert('Error', `${t.image_consent.save_error}${detail}`);
      return;
    }
    setStatus('accepted');
    onAccepted();
  }, [fullName, strokes, profile?.id, trainerId, onAccepted, config.body, config.title, t]);

  const handleSkip = useCallback(async () => {
    if (!profile?.id || !onSkip) return;
    setSaving('decline');
    // Es una respuesta opcional: no bloqueamos al usuario si falla el guardado
    // (se reintentará la próxima vez que se evalúe el gate). Solo confirmamos
    // el guardado para que no vuelva a pedirse en cada sesión cuando sí funciona.
    const result = await saveResponse('declined', null);
    setSaving(null);
    if (!result.ok && __DEV__) {
      console.warn('[image_consent] no se pudo persistir el rechazo:', result.error);
    } else {
      setStatus('declined');
    }
    onSkip();
  }, [profile?.id, onSkip, trainerId, config.body, config.title, t]);

  const topPad = embedded ? spacing.md : insets.top + spacing.lg;
  const botPad = Math.max(embedded ? bottomInset : insets.bottom, spacing.md);

  return (
    <View style={styles.flex}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={embedded ? 8 : 0}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.scroll, { paddingTop: topPad }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          scrollEnabled={!drawingSignature}
          bounces={!drawingSignature}
        >
          {!embedded ? (
            <AppText variant="caps11" color={authColors.textTertiary} style={styles.legalBadge}>
              {t.image_consent.legal_badge}
            </AppText>
          ) : null}

          <AppText variant="h2" color={authColors.textPrimary} style={styles.title}>
            {config.title}
          </AppText>
          <AppText variant="body13" color={authColors.textSecondary} style={styles.subtitle}>
            {t.image_consent.read_before}
          </AppText>

          {status && respondedAtLabel ? (
            <View style={[styles.statusBadge, status === 'declined' && styles.statusBadgeDeclined]}>
              <AppText
                variant="body13SemiBold"
                color={status === 'accepted' ? authColors.background : authColors.textPrimary}
              >
                {status === 'accepted' ? t.image_consent.status_accepted : t.image_consent.status_declined}
                {'  ·  '}
                {respondedAtLabel}
              </AppText>
            </View>
          ) : null}

          <View style={styles.card}>
            <AppText variant="body14" color={authColors.textSecondary} style={styles.docText}>
              {config.body}
            </AppText>
          </View>

          <AppText variant="body12" color={authColors.textTertiary} style={styles.agreement}>
            {t.image_consent.agreement}
          </AppText>
        </ScrollView>

        <View style={styles.sigPanel}>
          <AppText variant="body16SemiBold" color={authColors.textPrimary} style={styles.sigTitle}>
            {t.image_consent.sign_section}
          </AppText>

          <AppText variant="caps12" color={authColors.textTertiary} style={styles.fieldLabel}>
            {t.image_consent.full_name}
          </AppText>
          <TextInput
            value={fullName}
            onChangeText={setFullName}
            placeholder={t.image_consent.full_name_ph}
            placeholderTextColor={authColors.textTertiary}
            style={styles.textInput}
            autoCapitalize="words"
            returnKeyType="done"
          />

          <AppText variant="caps12" color={authColors.textTertiary} style={[styles.fieldLabel, styles.fieldLabelSpaced]}>
            {t.image_consent.signature}
          </AppText>
          <SignaturePad
            width={padWidth}
            strokes={strokes}
            onStrokeEnd={setStrokes}
            onClear={() => setStrokes([])}
            onDrawingChange={setDrawingSignature}
            hint={t.image_consent.signature_hint}
            clearLabel={t.image_consent.clear}
          />
        </View>

        <View style={[styles.footer, { paddingBottom: botPad }]}>
          <TouchableOpacity
            style={[styles.acceptBtn, { backgroundColor: canAccept ? LIMA : authColors.surface }]}
            onPress={() => void handleAccept()}
            disabled={saving !== null}
            activeOpacity={0.85}
          >
            {saving === 'accept' ? (
              <ActivityIndicator color={authColors.background} />
            ) : (
              <AppText variant="body16SemiBold" color={canAccept ? authColors.background : authColors.textTertiary}>
                {t.image_consent.accept_cta}
              </AppText>
            )}
          </TouchableOpacity>

          {onSkip ? (
            <TouchableOpacity
              style={styles.skipBtn}
              onPress={() => void handleSkip()}
              disabled={saving !== null}
              activeOpacity={0.7}
            >
              {saving === 'decline' ? (
                <ActivityIndicator color={authColors.textTertiary} />
              ) : (
                <AppText variant="body14" color={authColors.textTertiary}>
                  {t.image_consent.decline_cta}
                </AppText>
              )}
            </TouchableOpacity>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: authColors.background },
  scroll: { paddingHorizontal: H_PAD, paddingBottom: 16 },

  legalBadge: { letterSpacing: 1, marginBottom: spacing.sm },
  title: { marginBottom: spacing.xs, letterSpacing: -0.5 },
  subtitle: { marginBottom: spacing.lg, lineHeight: 20 },

  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: LIMA,
    marginBottom: spacing.md,
  },
  statusBadgeDeclined: {
    backgroundColor: authColors.surface,
    borderWidth: 1,
    borderColor: authColors.border,
  },

  card: {
    borderWidth: 1,
    borderColor: authColors.border,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    backgroundColor: authColors.surface,
  },
  docText: { lineHeight: 22 },
  agreement: { lineHeight: 18, textAlign: 'center', paddingHorizontal: 4, marginTop: 4, marginBottom: 8 },

  sigPanel: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: authColors.border,
    paddingHorizontal: H_PAD,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
    backgroundColor: authColors.background,
  },
  sigTitle: { marginBottom: spacing.md },
  fieldLabel: { marginBottom: 8, letterSpacing: 0.4 },
  fieldLabelSpaced: { marginTop: spacing.xs },
  textInput: {
    borderWidth: 1,
    borderColor: authColors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    color: authColors.textPrimary,
    backgroundColor: authColors.surface,
    marginBottom: spacing.md,
  },

  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: authColors.border,
    paddingHorizontal: H_PAD,
    paddingTop: spacing.md,
    backgroundColor: authColors.background,
  },
  acceptBtn: {
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipBtn: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
});
