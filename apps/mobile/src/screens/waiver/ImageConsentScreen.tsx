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
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { spacing } from '../../theme';
import { AppText } from '../../components/common';
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

interface ImageConsentScreenProps {
  config: ImageConsentConfig;
  trainerId: string;
  onAccepted: () => void;
  onSkip?: () => void;
  embedded?: boolean;
  bottomInset?: number;
}

const anyClient = supabase as unknown as { from: (t: string) => ReturnType<typeof supabase.from> };

export function ImageConsentScreen({
  config,
  trainerId,
  onAccepted,
  onSkip,
  embedded = false,
  bottomInset = 0,
}: ImageConsentScreenProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const profile = useAuthStore((s) => s.profile);
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);

  const canAccept = checked && fullName.trim().length > 0;

  const saveAcceptance = async (): Promise<{ ok: boolean; error?: string }> => {
    await useAuthStore.getState().refreshProfile();
    const freshProfile = useAuthStore.getState().profile;
    const resolvedTrainerId = freshProfile?.trainer_id ?? trainerId;
    const clientId = freshProfile?.id ?? profile?.id;
    if (!clientId || !resolvedTrainerId) return { ok: false, error: 'no_trainer_linked' };

    const payload = {
      p_trainer_id: resolvedTrainerId,
      p_full_name: fullName.trim(),
      p_document_snapshot: config.body ?? '',
      p_document_title: config.title ?? 'Consentimiento de uso de imágenes',
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
    if (!checked) {
      Alert.alert(t.image_consent.check_required, t.image_consent.check_required_msg);
      return;
    }
    if (!profile?.id) return;
    setSaving(true);
    const result = await saveAcceptance();
    setSaving(false);
    if (!result.ok) {
      const detail = __DEV__ && result.error ? `\n\n${result.error}` : '';
      Alert.alert('Error', `${t.image_consent.save_error}${detail}`);
      return;
    }
    onAccepted();
  }, [fullName, checked, profile?.id, trainerId, onAccepted, config.body, config.title, t]);

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

          <View style={styles.card}>
            <AppText variant="body14" color={authColors.textSecondary} style={styles.docText}>
              {config.body}
            </AppText>
          </View>
        </ScrollView>

        <View style={styles.panel}>
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

          <TouchableOpacity
            style={styles.checkRow}
            onPress={() => setChecked((v) => !v)}
            activeOpacity={0.7}
          >
            <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
              {checked ? <Ionicons name="checkmark" size={16} color={authColors.background} /> : null}
            </View>
            <AppText variant="body13" color={authColors.textSecondary} style={styles.checkLabel}>
              {t.image_consent.checkbox}
            </AppText>
          </TouchableOpacity>
        </View>

        <View style={[styles.footer, { paddingBottom: botPad }]}>
          <TouchableOpacity
            style={[styles.acceptBtn, { backgroundColor: canAccept ? LIMA : authColors.surface }]}
            onPress={() => void handleAccept()}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color={authColors.background} />
            ) : (
              <AppText variant="body16SemiBold" color={canAccept ? authColors.background : authColors.textTertiary}>
                {t.image_consent.accept_cta}
              </AppText>
            )}
          </TouchableOpacity>

          {onSkip ? (
            <TouchableOpacity style={styles.skipBtn} onPress={onSkip} disabled={saving} activeOpacity={0.7}>
              <AppText variant="body14" color={authColors.textTertiary}>
                Ahora no
              </AppText>
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

  card: {
    borderWidth: 1,
    borderColor: authColors.border,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    backgroundColor: authColors.surface,
  },
  docText: { lineHeight: 22 },

  panel: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: authColors.border,
    paddingHorizontal: H_PAD,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: authColors.background,
  },
  fieldLabel: { marginBottom: 8, letterSpacing: 0.4 },
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
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: authColors.border,
    backgroundColor: authColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxChecked: { borderColor: LIMA, backgroundColor: LIMA },
  checkLabel: { flex: 1, lineHeight: 20 },

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
