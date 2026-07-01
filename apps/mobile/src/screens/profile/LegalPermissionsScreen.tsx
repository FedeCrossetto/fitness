import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { layout, radius, spacing, Colors, useThemedStyles, useTheme } from '../../theme';
import { AppText, Card, CardSkeleton, IconButton, SectionHeader } from '../../components/common';
import { SignaturePreview, deserializeStrokes } from '../../components/waiver/SignaturePad';
import { anyClient, supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { useTranslation } from '../../stores/i18nStore';
import { formatLongDate } from '../../lib/dates';
import type { HomeStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<HomeStackParamList, 'LegalPermissions'>;

interface WaiverState {
  documentTitle: string;
  documentSnapshot: string;
  fullName: string;
  signedAt: string;
  strokes: ReturnType<typeof deserializeStrokes>;
}

interface ImageConsentState {
  status: 'accepted' | 'declined' | null;
  respondedAt: string | null;
}

export function LegalPermissionsScreen({ navigation }: Props): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const { t, i18n } = useTranslation();
  const profile = useAuthStore((s) => s.profile);
  const sigPreviewWidth = screenWidth - layout.screenPadding * 2 - spacing.md * 2;

  const [loading, setLoading] = useState(true);
  const [waiver, setWaiver] = useState<WaiverState | null>(null);
  const [imageConsentEnabled, setImageConsentEnabled] = useState(false);
  const [imageConsent, setImageConsent] = useState<ImageConsentState>({ status: null, respondedAt: null });
  const [waiverExpanded, setWaiverExpanded] = useState(false);

  useEffect(() => {
    const trainerId = profile?.trainer_id;
    const clientId = profile?.id;
    if (!trainerId || !clientId) {
      setLoading(false);
      return;
    }
    let active = true;
    void (async () => {
      const [{ data: sig }, { data: statusData, error: statusError }] = await Promise.all([
        anyClient
          .from('waiver_signatures')
          .select('full_name, document_snapshot, document_title, signature_data, signed_at')
          .eq('client_id', clientId)
          .eq('trainer_id', trainerId)
          .maybeSingle() as unknown as Promise<{ data: {
            full_name: string; document_snapshot: string; document_title: string;
            signature_data: string | null; signed_at: string;
          } | null }>,
        supabase.rpc('get_client_image_consent_status'),
      ]);

      if (!active) return;

      if (sig) {
        setWaiver({
          documentTitle: sig.document_title,
          documentSnapshot: sig.document_snapshot,
          fullName: sig.full_name,
          signedAt: sig.signed_at,
          strokes: deserializeStrokes(sig.signature_data),
        });
      }

      if (!statusError) {
        const row = statusData as { enabled?: boolean; status?: 'accepted' | 'declined' | null; responded_at?: string | null } | null;
        setImageConsentEnabled(!!row?.enabled);
        setImageConsent({ status: row?.status ?? null, respondedAt: row?.responded_at ?? null });
      } else if (__DEV__) {
        console.warn('[legal_permissions] image consent status failed:', statusError.message);
      }

      setLoading(false);
    })();
    return () => { active = false; };
  }, [profile?.id, profile?.trainer_id]);

  const imageConsentCaption = imageConsent.status === 'accepted'
    ? i18n(t.profile.legal_image_accepted, { date: formatLongDate((imageConsent.respondedAt ?? '').slice(0, 10)) })
    : imageConsent.status === 'declined'
    ? i18n(t.profile.legal_image_declined, { date: formatLongDate((imageConsent.respondedAt ?? '').slice(0, 10)) })
    : t.profile.legal_image_pending;

  return (
    <View style={styles.flex}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <IconButton icon="chevron-back" onPress={() => navigation.goBack()} accessibilityLabel={t.ui.back} />
        <AppText variant="h3" color={colors.text.primary} style={styles.headerTitle}>
          {t.profile.legal_title}
        </AppText>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}>
        {loading ? (
          <CardSkeleton />
        ) : !waiver && !imageConsentEnabled ? (
          <AppText variant="body14" color={colors.text.tertiary} align="center" style={styles.emptyText}>
            {t.profile.legal_empty}
          </AppText>
        ) : (
          <>
            {waiver ? (
              <>
                <SectionHeader title={t.profile.legal_waiver_title} />
                <Card style={styles.card}>
                  <View style={styles.row}>
                    <View style={styles.rowIcon}>
                      <Ionicons name="document-text-outline" size={18} color={colors.primary.default} />
                    </View>
                    <View style={styles.rowLabel}>
                      <AppText variant="body16Medium" color={colors.text.primary}>
                        {waiver.documentTitle}
                      </AppText>
                      <AppText variant="body12" color={colors.text.tertiary}>
                        {i18n(t.profile.legal_waiver_signed, { date: formatLongDate(waiver.signedAt.slice(0, 10)) })}
                      </AppText>
                    </View>
                    <Ionicons name="checkmark-circle" size={20} color={colors.states.success} />
                  </View>

                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setWaiverExpanded((v) => !v)}
                    style={styles.expandRow}
                  >
                    <AppText variant="body13SemiBold" color={colors.primary.default}>
                      {waiverExpanded ? t.profile.legal_waiver_hide : t.profile.legal_waiver_view}
                    </AppText>
                    <Ionicons
                      name={waiverExpanded ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color={colors.primary.default}
                    />
                  </Pressable>

                  {waiverExpanded ? (
                    <View style={styles.expandedBody}>
                      <AppText variant="body13" color={colors.text.secondary} style={styles.docText}>
                        {waiver.documentSnapshot}
                      </AppText>
                      <AppText variant="caps12" color={colors.text.tertiary} style={styles.sigLabel}>
                        {waiver.fullName}
                      </AppText>
                      {waiver.strokes.length > 0 ? (
                        <SignaturePreview width={sigPreviewWidth} strokes={waiver.strokes} />
                      ) : null}
                    </View>
                  ) : null}
                </Card>
              </>
            ) : null}

            {imageConsentEnabled ? (
              <>
                <SectionHeader title={t.profile.legal_image_title} />
                <Card style={styles.settingsCard}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => navigation.navigate('ImageConsentSettings')}
                    style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                  >
                    <View style={styles.rowIcon}>
                      <Ionicons name="images-outline" size={18} color={colors.primary.default} />
                    </View>
                    <View style={styles.rowLabel}>
                      <AppText variant="body16Medium" color={colors.text.primary}>
                        {t.profile.legal_image_manage}
                      </AppText>
                      <AppText variant="body12" color={colors.text.tertiary}>
                        {imageConsentCaption}
                      </AppText>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.text.tertiary} />
                  </Pressable>
                </Card>
              </>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: Colors) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: layout.screenPadding,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  headerTitle: { flex: 1, textAlign: 'center' },
  headerSpacer: { width: layout.minHitTarget },
  content: { paddingHorizontal: layout.screenPadding },
  emptyText: { marginTop: spacing.xl, lineHeight: 20 },
  card: { paddingVertical: spacing.xs },
  settingsCard: { paddingVertical: spacing.xxs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    minHeight: layout.minHitTarget,
  },
  rowPressed: { opacity: 0.7 },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.primary.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: { flex: 1 },
  expandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxs,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border.subtle,
    marginTop: spacing.xxs,
  },
  expandedBody: { paddingBottom: spacing.sm, paddingHorizontal: spacing.xxs },
  docText: { lineHeight: 20, marginBottom: spacing.md },
  sigLabel: { marginBottom: spacing.sm, letterSpacing: 0.4 },
});
