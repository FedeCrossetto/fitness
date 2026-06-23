import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TrainingStackParamList } from '../../types/navigation';
import { layout, radius, spacing, Colors, useThemedStyles, useTheme } from '../../theme';
import { hapticSuccess } from '../../lib/haptics';
import { AppText, Button, Card, CardSkeleton, ErrorState, MetricCard } from '../../components/common';
import { NUTRITION_MACRO_COLORS } from '../../components/nutrition/nutritionTheme';
import { useTranslation } from '../../stores/i18nStore';
import { useTrainingStore } from '../../stores/trainingStore';
import {
  formatWorkoutDuration,
  formatWorkoutVolume,
  summarizeWorkoutForFeed,
} from '@reset-fitness/shared';
import type { WorkoutLogRow } from '../../types/database';
import { useTabBarScrollPadding } from '../../hooks/useTabBarScrollPadding';

type Props = NativeStackScreenProps<TrainingStackParamList, 'SessionSummary'>;

export function SessionSummaryScreen({ navigation, route }: Props): React.JSX.Element {
  const { colors } = useTheme();
  const { t, i18n } = useTranslation();
  const styles = useThemedStyles(createStyles);

  const { logId } = route.params;
  const insets = useSafeAreaInsets();
  const scrollBottom = useTabBarScrollPadding();
  const loadLogById = useTrainingStore((s) => s.loadLogById);

  const [log, setLog] = useState<WorkoutLogRow | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const result = await loadLogById(logId);
    setLog(result);
    setLoading(false);
  }, [logId, loadLogById]);

  useEffect(() => {
    hapticSuccess();
    let cancelled = false;
    void (async () => {
      const result = await loadLogById(logId);
      if (cancelled) return;
      setLog(result);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [logId, loadLogById]);

  const renderContent = () => {
    if (loading) {
      return (
        <View>
          <CardSkeleton />
          <CardSkeleton />
        </View>
      );
    }
    if (!log) {
      return (
        <ErrorState
          message={t.training.log_not_found}
          onRetry={() => {
            setLoading(true);
            void load();
          }}
        />
      );
    }

    const exerciseLines = summarizeWorkoutForFeed(log.session_detail);
    const durationLabel = formatWorkoutDuration(log.duration_min, log.elapsed_seconds);
    const volumeLabel = formatWorkoutVolume(log.total_volume_kg);

    return (
      <View>
        <View style={styles.celebration}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={56} color={NUTRITION_MACRO_COLORS.carbs} />
          </View>
          <AppText variant="h1" color={colors.text.primary} align="center">
            {t.training.done_title}
          </AppText>
          <AppText variant="body14" color={colors.text.secondary} align="center" style={styles.subtitle}>
            {i18n(t.training.done_subtitle, { name: log.workout_name })}
          </AppText>
        </View>

        <View style={styles.grid}>
          <MetricCard
            label={t.training.duration}
            value={durationLabel}
            icon="time-outline"
            style={styles.gridItem}
          />
          <MetricCard
            label={t.training.volume}
            value={volumeLabel}
            icon="barbell-outline"
            style={styles.gridItem}
          />
          <MetricCard
            label={t.training.sets_completed}
            value={String(log.completed_sets ?? exerciseLines.reduce((s, l) => s + l.completedSets, 0))}
            icon="layers-outline"
            style={styles.gridItem}
          />
          <MetricCard
            label="RPE"
            value={log.rpe != null ? String(log.rpe) : '—'}
            unit="/ 10"
            icon="speedometer-outline"
            style={styles.gridItem}
          />
        </View>

        {exerciseLines.length > 0 ? (
          <Card style={styles.exerciseCard}>
            <AppText variant="caps12" color={colors.text.tertiary} style={styles.commentsLabel}>
              {t.training.session_exercises}
            </AppText>
            {exerciseLines.map((line) => (
              <View key={line.name} style={styles.exerciseLine}>
                <AppText variant="body14SemiBold" color={colors.text.primary} style={styles.exerciseLineName}>
                  {line.name}
                </AppText>
                <AppText variant="body12" color={colors.text.secondary}>
                  {i18n(t.training.sets_count_line, { n: line.completedSets })}
                </AppText>
              </View>
            ))}
          </Card>
        ) : null}

        {log.comments ? (
          <Card style={styles.commentsCard}>
            <AppText variant="caps12" color={colors.text.tertiary} style={styles.commentsLabel}>
              {t.training.comments}
            </AppText>
            <AppText variant="body14" color={colors.text.secondary}>
              {log.comments}
            </AppText>
          </Card>
        ) : null}

        <Button
          label={t.training.back_to_program}
          icon="arrow-back"
          onPress={() => {
            navigation.reset({
              index: 0,
              routes: [{ name: 'Program' }],
            });
          }}
          fullWidth
          style={styles.cta}
        />
      </View>
    );
  };

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={{
        paddingTop: insets.top + spacing.xl,
        paddingBottom: scrollBottom,
        paddingHorizontal: layout.screenPadding,
      }}
      showsVerticalScrollIndicator={false}
    >
      {renderContent()}
    </ScrollView>
  );
}

const createStyles = (colors: Colors) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  celebration: { alignItems: 'center', marginBottom: spacing.xl },
  successIcon: {
    width: 88,
    height: 88,
    borderRadius: radius.pill,
    backgroundColor: colors.surface.elevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  subtitle: { marginTop: spacing.xs, maxWidth: 280 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  gridItem: { flexBasis: '47%', flexGrow: 1 },
  exerciseCard: { marginTop: spacing.md },
  exerciseLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    gap: spacing.sm,
  },
  exerciseLineName: { flex: 1 },
  commentsCard: { marginTop: spacing.md },
  commentsLabel: { marginBottom: spacing.xs },
  cta: { marginTop: spacing.xl },
});
