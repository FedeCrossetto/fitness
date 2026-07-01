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

interface WaiverConfig {
  title: string;
  body: string;
  require_before_start: boolean;
}

interface WaiverScreenProps {
  config: WaiverConfig;
  trainerId: string;
  onSigned: () => void;
  embedded?: boolean;
  bottomInset?: number;
}

const anyClient = supabase as unknown as { from: (t: string) => ReturnType<typeof supabase.from> };

const H_PAD = spacing.xl;

export function WaiverScreen({
  config,
  trainerId,
  onSigned,
  embedded = false,
  bottomInset = 0,
}: WaiverScreenProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { width: screenWidth } = useWindowDimensions();
  const profile = useAuthStore((s) => s.profile);
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [saving, setSaving] = useState(false);
  const [drawingSignature, setDrawingSignature] = useState(false);

  const padWidth = screenWidth - H_PAD * 2;
  const canSign = strokes.length > 0 && fullName.trim().length > 0;

  const saveSignature = async (): Promise<{ ok: boolean; error?: string }> => {
    const clientId = profile?.id;
    if (!clientId || !trainerId) return { ok: false, error: 'no_trainer_linked' };

    const signatureData = serializeStrokes(strokes);
    const payload = {
      p_trainer_id: trainerId,
      p_full_name: fullName.trim(),
      p_signature_data: signatureData,
      p_document_snapshot: config.body ?? '',
      p_document_title: config.title ?? 'Deslinde de Responsabilidad',
    };

    const { error: rpcError } = await supabase.rpc('save_client_waiver_signature', payload);
    if (!rpcError) return { ok: true };

    const rpcMessage = rpcError.message ?? 'rpc_failed';
    if (__DEV__) console.warn('[waiver] RPC save failed:', rpcMessage, rpcError);

    const { error: upsertError } = await anyClient.from('waiver_signatures').upsert({
      client_id: clientId,
      trainer_id: trainerId,
      full_name: fullName.trim(),
      signature_data: signatureData,
      document_snapshot: config.body ?? '',
      document_title: config.title ?? 'Deslinde de Responsabilidad',
      signed_at: new Date().toISOString(),
    }, { onConflict: 'client_id,trainer_id' });

    if (!upsertError) return { ok: true };

    const upsertMessage = upsertError.message ?? 'upsert_failed';
    if (__DEV__) console.warn('[waiver] upsert failed:', upsertMessage, upsertError);
    return { ok: false, error: rpcMessage || upsertMessage };
  };

  const handleSign = useCallback(async () => {
    if (!fullName.trim()) {
      Alert.alert(t.waiver.name_required, t.waiver.name_required_msg);
      return;
    }
    if (strokes.length === 0) {
      Alert.alert(t.waiver.sig_required, t.waiver.sig_required_msg);
      return;
    }
    if (!profile?.id) return;
    setSaving(true);
    const result = await saveSignature();
    setSaving(false);
    if (!result.ok) {
      const detail = __DEV__ && result.error ? `\n\n${result.error}` : '';
      Alert.alert('Error', `${t.waiver.save_error}${detail}`);
      return;
    }
    onSigned();
  }, [fullName, strokes, profile?.id, trainerId, onSigned, config.body, config.title, t]);

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
              {t.waiver.legal_badge}
            </AppText>
          ) : null}

          <AppText variant="h2" color={authColors.textPrimary} style={styles.title}>
            {config.title}
          </AppText>
          <AppText variant="body13" color={authColors.textSecondary} style={styles.subtitle}>
            {t.waiver.read_before}
          </AppText>

          <View style={styles.card}>
            <AppText variant="body14" color={authColors.textSecondary} style={styles.docText}>
              {config.body}
            </AppText>
          </View>

          <AppText variant="body12" color={authColors.textTertiary} style={styles.agreement}>
            {t.waiver.agreement}
          </AppText>
        </ScrollView>

        <View style={styles.sigPanel}>
          <AppText variant="body16SemiBold" color={authColors.textPrimary} style={styles.sigTitle}>
            {t.waiver.sign_section}
          </AppText>

          <AppText variant="caps12" color={authColors.textTertiary} style={styles.fieldLabel}>
            {t.waiver.full_name}
          </AppText>
          <TextInput
            value={fullName}
            onChangeText={setFullName}
            placeholder={t.waiver.full_name_ph}
            placeholderTextColor={authColors.textTertiary}
            style={styles.textInput}
            autoCapitalize="words"
            returnKeyType="done"
          />

          <AppText variant="caps12" color={authColors.textTertiary} style={[styles.fieldLabel, styles.fieldLabelSpaced]}>
            {t.waiver.signature}
          </AppText>
          <SignaturePad
            width={padWidth}
            strokes={strokes}
            onStrokeEnd={setStrokes}
            onClear={() => setStrokes([])}
            onDrawingChange={setDrawingSignature}
            hint={t.waiver.signature_hint}
            clearLabel={t.waiver.clear}
          />
        </View>

        <View style={[styles.footer, { paddingBottom: botPad }]}>
          <TouchableOpacity
            style={[styles.signBtn, { backgroundColor: canSign ? LIMA : authColors.surface }]}
            onPress={() => void handleSign()}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color={authColors.background} />
            ) : (
              <AppText variant="body16SemiBold" color={canSign ? authColors.background : authColors.textTertiary}>
                {t.waiver.sign_cta}
              </AppText>
            )}
          </TouchableOpacity>
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
    marginBottom: 4,
  },

  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: authColors.border,
    paddingHorizontal: H_PAD,
    paddingTop: spacing.md,
    backgroundColor: authColors.background,
  },
  signBtn: {
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
