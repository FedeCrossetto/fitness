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
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing } from '../../theme';
import { AppText } from '../../components/common';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { useTranslation } from '../../stores/i18nStore';

interface ImageConsentConfig {
  title: string;
  body: string;
}

interface ImageConsentScreenProps {
  config: ImageConsentConfig;
  trainerId: string;
  onAccepted: () => void;
  embedded?: boolean;
  bottomInset?: number;
}

const H_PAD = spacing.lg;
const anyClient = supabase as unknown as { from: (t: string) => ReturnType<typeof supabase.from> };

export function ImageConsentScreen({
  config,
  trainerId,
  onAccepted,
  embedded = false,
  bottomInset = 0,
}: ImageConsentScreenProps): React.JSX.Element {
  const { colors } = useTheme();
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
    if (!clientId || !resolvedTrainerId) {
      return { ok: false, error: 'no_trainer_linked' };
    }

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

  const content = (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={embedded ? 8 : 0}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.scroll, embedded ? styles.scrollEmbedded : null]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {!embedded ? (
          <View style={[styles.headerBadge, { backgroundColor: colors.surface.elevated, borderColor: colors.border.default }]}>
            <AppText variant="caps11" color={colors.text.tertiary} style={{ letterSpacing: 1 }}>
              {t.image_consent.legal_badge}
            </AppText>
          </View>
        ) : null}

        <AppText variant="h2" color={colors.text.primary} style={styles.title}>
          {config.title}
        </AppText>
        <AppText variant="body13" color={colors.text.secondary} style={styles.subtitle}>
          {t.image_consent.read_before}
        </AppText>

        <View style={[styles.card, { borderColor: colors.border.default, backgroundColor: colors.surface.elevated }]}>
          <AppText variant="body14" color={colors.text.primary} style={styles.docText}>
            {config.body}
          </AppText>
        </View>
      </ScrollView>

      <View style={[styles.panel, { borderTopColor: colors.border.default, backgroundColor: colors.background }]}>
        <View style={[styles.card, { borderColor: colors.border.default, backgroundColor: colors.surface.elevated }]}>
          <AppText variant="caps12" color={colors.text.tertiary} style={styles.fieldLabel}>
            {t.image_consent.full_name}
          </AppText>
          <TextInput
            value={fullName}
            onChangeText={setFullName}
            placeholder={t.image_consent.full_name_ph}
            placeholderTextColor={colors.text.tertiary}
            style={[
              styles.textInput,
              {
                color: colors.text.primary,
                borderColor: colors.border.default,
                backgroundColor: colors.background,
              },
            ]}
            autoCapitalize="words"
            returnKeyType="done"
          />

          <TouchableOpacity
            style={styles.checkRow}
            onPress={() => setChecked((v) => !v)}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.checkbox,
                {
                  borderColor: checked ? colors.primary.default : colors.border.default,
                  backgroundColor: checked ? colors.primary.default : colors.background,
                },
              ]}
            >
              {checked ? <Ionicons name="checkmark" size={16} color="#0C0C0C" /> : null}
            </View>
            <AppText variant="body13" color={colors.text.secondary} style={styles.checkLabel}>
              {t.image_consent.checkbox}
            </AppText>
          </TouchableOpacity>
        </View>
      </View>

      <View
        style={[
          styles.footer,
          {
            borderTopColor: colors.border.default,
            backgroundColor: colors.background,
            paddingBottom: Math.max(bottomInset, spacing.md),
          },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.acceptBtn,
            { backgroundColor: canAccept ? colors.primary.default : colors.surface.elevated },
          ]}
          onPress={() => void handleAccept()}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator color="#0C0C0C" />
          ) : (
            <AppText
              variant="body16SemiBold"
              color={canAccept ? '#0C0C0C' : colors.text.tertiary}
            >
              {t.image_consent.accept_cta}
            </AppText>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );

  if (embedded) {
    return <View style={[styles.flex, { backgroundColor: colors.background }]}>{content}</View>;
  }

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {content}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { paddingHorizontal: H_PAD, paddingTop: spacing.lg, paddingBottom: 16 },
  scrollEmbedded: { paddingTop: spacing.md },
  headerBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    marginBottom: 12,
  },
  title: { marginBottom: 6 },
  subtitle: { marginBottom: 16, lineHeight: 20 },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  docText: { lineHeight: 22 },
  panel: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: H_PAD,
    paddingTop: 12,
    paddingBottom: 4,
  },
  fieldLabel: { marginBottom: 8, letterSpacing: 0.4 },
  textInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    marginBottom: 16,
  },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkLabel: { flex: 1, lineHeight: 20 },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: H_PAD,
    paddingTop: 12,
  },
  acceptBtn: {
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
