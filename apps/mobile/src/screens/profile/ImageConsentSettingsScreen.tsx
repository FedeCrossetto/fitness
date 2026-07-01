import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { spacing } from '../../theme';
import { AppText, IconButton } from '../../components/common';
import { ImageConsentScreen } from '../waiver/ImageConsentScreen';
import { anyClient, supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { useTranslation } from '../../stores/i18nStore';
import { formatLongDate } from '../../lib/dates';
import { authColors } from '../auth/authScreenTheme';
import type { HomeStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<HomeStackParamList, 'ImageConsentSettings'>;

interface ImageConsentStatusRpc {
  enabled?: boolean;
  title?: string;
  body?: string;
  status?: 'accepted' | 'declined' | null;
  full_name?: string | null;
  responded_at?: string | null;
}

interface State {
  loading: boolean;
  enabled: boolean;
  title: string;
  body: string;
  status: 'accepted' | 'declined' | null;
  fullName: string | null;
  respondedAt: string | null;
}

export function ImageConsentSettingsScreen({ navigation }: Props): React.JSX.Element {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const profile = useAuthStore((s) => s.profile);
  const [state, setState] = useState<State>({
    loading: true,
    enabled: false,
    title: '',
    body: '',
    status: null,
    fullName: null,
    respondedAt: null,
  });

  useEffect(() => {
    let active = true;
    void (async () => {
      const { data, error } = await supabase.rpc('get_client_image_consent_status');
      if (!error) {
        const row = data as ImageConsentStatusRpc | null;
        if (active) {
          setState({
            loading: false,
            enabled: !!row?.enabled,
            title: row?.title ?? t.profile.legal_image_title,
            body: row?.body ?? '',
            status: row?.status ?? null,
            fullName: row?.full_name ?? null,
            respondedAt: row?.responded_at ?? null,
          });
        }
        return;
      }

      if (__DEV__) console.warn('[image_consent] status RPC failed, using fallback:', error.message);
      const trainerId = profile?.trainer_id;
      if (!trainerId) {
        if (active) setState((s) => ({ ...s, loading: false, enabled: false }));
        return;
      }
      const { data: cfg } = await anyClient
        .from('waiver_configs')
        .select('image_consent_enabled, image_consent_title, image_consent_body')
        .eq('trainer_id', trainerId)
        .maybeSingle() as { data: { image_consent_enabled?: boolean; image_consent_title?: string; image_consent_body?: string } | null };

      if (!cfg?.image_consent_enabled || !cfg.image_consent_body?.trim()) {
        if (active) setState((s) => ({ ...s, loading: false, enabled: false }));
        return;
      }

      const { data: existing } = await anyClient
        .from('image_consent_acceptances')
        .select('status, full_name, accepted_at')
        .eq('client_id', profile?.id ?? '')
        .eq('trainer_id', trainerId)
        .maybeSingle() as { data: { status?: string; full_name?: string; accepted_at?: string } | null };

      if (!active) return;
      setState({
        loading: false,
        enabled: true,
        title: cfg.image_consent_title ?? t.profile.legal_image_title,
        body: cfg.image_consent_body,
        status: (existing?.status as 'accepted' | 'declined' | undefined) ?? null,
        fullName: existing?.full_name ?? null,
        respondedAt: existing?.accepted_at ?? null,
      });
    })();
    return () => { active = false; };
  }, [profile?.id, profile?.trainer_id, t]);

  const topPad = insets.top + spacing.md;

  return (
    <View style={styles.flex}>
      <View style={[styles.header, { paddingTop: topPad }]}>
        <IconButton icon="chevron-back" onPress={() => navigation.goBack()} accessibilityLabel={t.ui.back} />
        <AppText variant="h3" color={authColors.textPrimary} style={styles.headerTitle}>
          {t.profile.legal_image_title}
        </AppText>
        <View style={styles.headerSpacer} />
      </View>

      {state.loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={authColors.textPrimary} />
        </View>
      ) : !state.enabled ? (
        <View style={styles.center}>
          <AppText variant="body14" color={authColors.textSecondary} align="center" style={styles.emptyText}>
            {t.profile.legal_empty}
          </AppText>
        </View>
      ) : (
        <ImageConsentScreen
          config={{ title: state.title, body: state.body }}
          trainerId={profile?.trainer_id ?? ''}
          initialStatus={state.status}
          initialFullName={state.fullName ?? undefined}
          respondedAtLabel={state.respondedAt ? formatLongDate(state.respondedAt.slice(0, 10)) : null}
          onAccepted={() => navigation.goBack()}
          onSkip={() => navigation.goBack()}
          embedded
          bottomInset={insets.bottom}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: authColors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  headerTitle: { flex: 1, textAlign: 'center' },
  headerSpacer: { width: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  emptyText: { lineHeight: 20 },
});
