import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, layout, radius, spacing } from '../../theme';
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
import { useTrainingStore } from '../../stores/trainingStore';
import { useUiStore } from '../../stores/uiStore';
import type { TrainingStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<TrainingStackParamList, 'CardioLog'>;

const ACTIVITIES = ['Correr', 'Caminar', 'Bici', 'Natación', 'Remo', 'Otro'] as const;
const DISTANCE_UNITS = ['km', 'mi'] as const;

export function CardioLogScreen({ navigation }: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();

  const session = useAuthStore((s) => s.session);
  const userId = session?.user.id;

  const logCardio = useTrainingStore((s) => s.logCardio);
  const recentLogs = useTrainingStore((s) => s.recentLogs);
  const logsLoading = useTrainingStore((s) => s.logsLoading);
  const loadRecentLogs = useTrainingStore((s) => s.loadRecentLogs);

  const [activity, setActivity] = useState<string | null>(null);
  const [distance, setDistance] = useState('');
  const [unitIndex, setUnitIndex] = useState(0);
  const [minutes, setMinutes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (userId) void loadRecentLogs(userId);
  }, [userId, loadRecentLogs]);

  const cardioLogs = useMemo(
    () => recentLogs.filter((l) => l.workout_type === 'cardio'),
    [recentLogs]
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
      useUiStore.getState().showToast('success', 'Cardio registrado. ¡Bien ahí!');
      navigation.goBack();
    } else {
      useUiStore.getState().showToast('error', 'No pudimos guardar tu cardio. Probá de nuevo.');
    }
  };

  return (
    <View style={[styles.flex, { paddingTop: insets.top + spacing.md }]}>
      <View style={styles.header}>
        <IconButton icon="chevron-back" onPress={() => navigation.goBack()} accessibilityLabel="Volver" />
        <AppText variant="h3" color={colors.text.primary} style={styles.headerTitle}>
          Registrar cardio
        </AppText>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Card style={styles.formCard}>
          <AppText variant="caps12" color={colors.text.tertiary} style={styles.label}>
            Actividad
          </AppText>
          <View style={styles.chipsRow}>
            {ACTIVITIES.map((item) => (
              <Chip key={item} label={item} active={activity === item} onPress={() => setActivity(item)} />
            ))}
          </View>

          <AppText variant="caps12" color={colors.text.tertiary} style={[styles.label, styles.spacedLabel]}>
            Distancia (opcional)
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
            label="Duración (minutos)"
            placeholder="30"
            keyboardType="number-pad"
            value={minutes}
            onChangeText={setMinutes}
            icon="time-outline"
            containerStyle={styles.spacedLabel}
          />

          <Button
            label="Guardar"
            icon="checkmark"
            onPress={() => void onSave()}
            disabled={!isValid}
            loading={saving}
            fullWidth
            style={styles.saveButton}
          />
        </Card>

        <AppText variant="caps12" color={colors.text.tertiary} style={styles.sectionLabel}>
          Últimos registros
        </AppText>

        {logsLoading && cardioLogs.length === 0 ? (
          <CardSkeleton />
        ) : cardioLogs.length === 0 ? (
          <EmptyState
            pillar="training"
            title="Sin cardio registrado"
            message="Tu primer registro de cardio va a aparecer acá."
            compact
          />
        ) : (
          <View style={styles.logsList}>
            {cardioLogs.map((log) => (
              <View key={log.id} style={styles.logRow}>
                <View style={styles.logIcon}>
                  <Ionicons name="pulse-outline" size={18} color={colors.primary.default} />
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
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: layout.screenPadding,
    marginBottom: spacing.md,
  },
  headerTitle: { flex: 1 },
  content: {
    paddingHorizontal: layout.screenPadding,
    paddingBottom: layout.tabBarHeight + spacing.xxl,
  },
  formCard: { marginBottom: spacing.lg },
  label: { marginBottom: spacing.xs },
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
    backgroundColor: colors.primary.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logInfo: { flex: 1 },
});
