import React, { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { layout, radius, spacing, Colors, useThemedStyles, useTheme } from '../../theme';
import { formatDuration, formatShortDate } from '../../lib/dates';
import { hapticSuccess } from '../../lib/haptics';
import {
  AppText,
  Button,
  Card,
  CardSkeleton,
  Chip,
  EmptyState,
  IconButton,
  Input,
  SegmentedTabs,
} from '../../components/common';
import { useAuthStore } from '../../stores/authStore';
import { useTranslation } from '../../stores/i18nStore';
import { useTrainingStore } from '../../stores/trainingStore';
import { useUiStore } from '../../stores/uiStore';
import { useTabBarScrollPadding } from '../../hooks/useTabBarScrollPadding';
import type { TrainingStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<TrainingStackParamList, 'CardioLog'>;

const ACTIVITIES = ['Correr', 'Caminar', 'Bici', 'Natación', 'Remo', 'Otro'] as const;
const DISTANCE_UNITS = ['km', 'mi'] as const;

export function CardioLogScreen({ navigation, route }: Props): React.JSX.Element {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = useThemedStyles(createStyles);

  const insets = useSafeAreaInsets();
  const scrollBottom = useTabBarScrollPadding();

  const session = useAuthStore((s) => s.session);
  const userId = session?.user.id;

  const logCardio = useTrainingStore((s) => s.logCardio);
  const recentLogs = useTrainingStore((s) => s.recentLogs);
  const logsLoading = useTrainingStore((s) => s.logsLoading);
  const loadRecentLogs = useTrainingStore((s) => s.loadRecentLogs);

  const [activity, setActivity] = useState<string | null>(route.params?.activity ?? null);
  const [distance, setDistance] = useState('');
  const [unitIndex, setUnitIndex] = useState(0);
  const [minutes, setMinutes] = useState(
    route.params?.durationMin != null ? String(route.params.durationMin) : '',
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (userId) void loadRecentLogs(userId);
  }, [userId, loadRecentLogs]);

  const cardioLogs = useMemo(
    () => recentLogs.filter((l) => l.workout_type === 'cardio'),
    [recentLogs],
  );

  const minutesNum = parseInt(minutes, 10);
  const isValid = activity !== null && Number.isFinite(minutesNum) && minutesNum > 0;

  const onSave = async () => {
    if (!userId || !activity || !isValid) return;
    setSaving(true);
    const distanceNum = parseFloat(distance.replace(',', '.'));
    const ok = await logCardio(userId, {
      activity,
      distance: Number.isFinite(distanceNum) ? distanceNum : 0,
      distanceUnit: DISTANCE_UNITS[unitIndex],
      durationSeconds: minutesNum * 60,
    });
    setSaving(false);
    if (ok) {
      hapticSuccess();
      useUiStore.getState().showToast('success', t.training.cardio_saved);
      navigation.goBack();
    } else {
      useUiStore.getState().showToast('error', t.training.cardio_save_error);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <View style={[styles.flex, { paddingTop: insets.top + spacing.md }]}>
      <View style={styles.header}>
        <IconButton icon="chevron-back" onPress={() => navigation.goBack()} accessibilityLabel={t.training.go_back} />
        <View style={styles.headerText}>
          <AppText variant="h3" color={colors.text.primary}>
            {t.training.cardio_title}
          </AppText>
          <AppText variant="body13" color={colors.text.tertiary}>
            {t.training.register_cardio}
          </AppText>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: scrollBottom }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Card elevated style={styles.formCard}>
          <AppText variant="caps12" color={colors.text.tertiary} style={styles.label}>
            {t.training.activity}
          </AppText>
          {activity && !ACTIVITIES.includes(activity as (typeof ACTIVITIES)[number]) ? (
            <AppText variant="body14SemiBold" color={colors.text.primary} style={styles.customActivity}>
              {activity}
            </AppText>
          ) : null}
          <View style={styles.chipsRow}>
            {ACTIVITIES.map((item) => (
              <Chip key={item} label={item} active={activity === item} onPress={() => setActivity(item)} />
            ))}
          </View>

          <AppText variant="caps12" color={colors.text.tertiary} style={[styles.label, styles.spacedLabel]}>
            {t.training.distance_optional}
          </AppText>
          <View style={styles.distanceRow}>
            <Input
              placeholder="0.0"
              keyboardType="decimal-pad"
              value={distance}
              onChangeText={setDistance}
              icon="navigate-outline"
              containerStyle={styles.distanceInput}
            />
            <View style={styles.unitTabs}>
              <SegmentedTabs tabs={[...DISTANCE_UNITS]} activeIndex={unitIndex} onChange={setUnitIndex} />
            </View>
          </View>

          <Input
            label={t.training.duration_minutes}
            placeholder="30"
            keyboardType="number-pad"
            value={minutes}
            onChangeText={setMinutes}
            icon="time-outline"
            containerStyle={styles.spacedLabel}
          />

          <Button
            label={t.training.save}
            icon="checkmark"
            onPress={() => void onSave()}
            disabled={!isValid}
            loading={saving}
            fullWidth
            style={styles.saveButton}
          />
        </Card>

        <AppText variant="caps12" color={colors.text.tertiary} style={styles.sectionLabel}>
          {t.training.recent_logs}
        </AppText>

        {logsLoading && cardioLogs.length === 0 ? (
          <CardSkeleton />
        ) : cardioLogs.length === 0 ? (
          <EmptyState
            pillar="training"
            hideIllustration
            title={t.training.no_cardio_logs}
            message={t.training.no_cardio_logs_message}
            compact
          />
        ) : (
          <View style={styles.logsList}>
            {cardioLogs.map((log) => (
              <View key={log.id} style={styles.logRow}>
                <View style={styles.logIcon}>
                  <Ionicons name="pulse-outline" size={18} color={colors.text.secondary} />
                </View>
                <View style={styles.logInfo}>
                  <AppText variant="body14SemiBold" color={colors.text.primary} numberOfLines={1}>
                    {log.cardio_activity ?? log.workout_name}
                  </AppText>
                  <AppText variant="body12" color={colors.text.tertiary}>
                    {formatShortDate(log.date)}
                    {log.distance != null && log.distance > 0
                      ? ` · ${log.distance} ${log.distance_unit ?? 'km'}`
                      : ''}
                  </AppText>
                </View>
                <AppText variant="body13SemiBold" color={colors.text.secondary}>
                  {log.duration_seconds != null
                    ? formatDuration(log.duration_seconds)
                    : `${log.duration_min ?? 0} min`}
                </AppText>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: Colors) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingHorizontal: layout.screenPadding,
    marginBottom: spacing.md,
  },
  headerText: { flex: 1, paddingTop: 2 },
  content: {
    paddingHorizontal: layout.screenPadding,
  },
  formCard: { marginBottom: spacing.lg },
  label: { marginBottom: spacing.xs },
  customActivity: { marginBottom: spacing.sm },
  spacedLabel: { marginTop: spacing.md },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  distanceRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  distanceInput: { flex: 1 },
  unitTabs: { width: 120 },
  saveButton: { marginTop: spacing.lg },
  sectionLabel: { marginBottom: spacing.sm },
  logsList: { gap: spacing.xs },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface.base,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    padding: spacing.sm,
  },
  logIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.surface.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logInfo: { flex: 1 },
});
