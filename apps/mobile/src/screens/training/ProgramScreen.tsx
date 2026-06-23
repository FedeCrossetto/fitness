import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TrainingStackParamList } from '../../types/navigation';
import { layout, radius, spacing, Colors, useThemedStyles, useTheme } from '../../theme';
import {
  AppText,
  Button,
  Card,
  CardSkeleton,
  Chip,
  EmptyState,
  ErrorState,
  HeaderAvatar,
  ProgressBar,
} from '../../components/common';
import { ActiveSessionBanner } from '../../components/training/ActiveSessionBanner';
import { ExerciseIcon } from '../../components/training/ExerciseIcon';
import { RecentWorkoutFeed } from '../../components/training/RecentWorkoutFeed';
import { useClientConfig } from '../../config/useClientConfig';
import {
  getCompletedWorkoutNames,
  getNextWorkoutDay,
  getPhaseProgress,
  getProgramStats,
  isCardioDay,
  isDayCompleted,
  isRestDay,
  isTrainableDay,
} from '../../lib/trainingProgram';
import { useAuthStore } from '../../stores/authStore';
import { useTranslation } from '../../stores/i18nStore';
import { useTrainingStore, type PhaseWithDays } from '../../stores/trainingStore';
import { DAY_TYPE_META } from './trainingMeta';
import { useTabBarScrollPadding } from '../../hooks/useTabBarScrollPadding';

type Props = NativeStackScreenProps<TrainingStackParamList, 'Program'>;

export function ProgramScreen({ navigation }: Props): React.JSX.Element {
  const { colors } = useTheme();
  const { t, i18n } = useTranslation();
  const styles = useThemedStyles(createStyles);
  const { programKey } = useClientConfig();

  const insets = useSafeAreaInsets();
  const scrollBottom = useTabBarScrollPadding();

  const session = useAuthStore((s) => s.session);
  const userId = session?.user.id;

  const phases = useTrainingStore((s) => s.phases);
  const phasesLoading = useTrainingStore((s) => s.phasesLoading);
  const phasesError = useTrainingStore((s) => s.phasesError);
  const loadProgram = useTrainingStore((s) => s.loadProgram);
  const recentLogs = useTrainingStore((s) => s.recentLogs);
  const logsLoading = useTrainingStore((s) => s.logsLoading);
  const loadRecentLogs = useTrainingStore((s) => s.loadRecentLogs);
  const restoreActiveSession = useTrainingStore((s) => s.restoreActiveSession);
  const customWorkouts = useTrainingStore((s) => s.customWorkouts);
  const customLoading = useTrainingStore((s) => s.customLoading);
  const loadCustomWorkouts = useTrainingStore((s) => s.loadCustomWorkouts);
  const createCustomWorkout = useTrainingStore((s) => s.createCustomWorkout);
  const activeSession = useTrainingStore((s) => s.activeSession);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [creatingCustom, setCreatingCustom] = useState(false);

  const refresh = useCallback(() => {
    void loadProgram();
    void restoreActiveSession();
    if (userId) {
      void loadRecentLogs(userId);
      void loadCustomWorkouts(userId);
    }
  }, [loadProgram, restoreActiveSession, loadRecentLogs, loadCustomWorkouts, userId]);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  useEffect(() => {
    void loadProgram();
  }, [programKey, loadProgram]);

  const completedWorkoutNames = useMemo(() => getCompletedWorkoutNames(recentLogs), [recentLogs]);
  const programStats = useMemo(
    () => getProgramStats(phases, completedWorkoutNames),
    [phases, completedWorkoutNames],
  );
  const nextWorkoutDay = useMemo(
    () => getNextWorkoutDay(phases, completedWorkoutNames),
    [phases, completedWorkoutNames],
  );

  const expandedPhaseId = expandedId ?? phases[0]?.id ?? null;

  const openStrengthWorkout = useCallback((workoutId: string, dayTitle: string) => {
    navigation.navigate('WorkoutDetail', { workoutId, dayTitle });
  }, [navigation]);

  const openDay = useCallback((day: PhaseWithDays['days'][number]) => {
    if (isRestDay(day) || !day.workout) return;
    if (isCardioDay(day)) {
      navigation.navigate('CardioLog', {
        activity: day.workout.title,
        durationMin: day.workout.duration_min ?? undefined,
      });
      return;
    }
    openStrengthWorkout(day.workout.id, day.title);
  }, [navigation, openStrengthWorkout]);

  const openNextWorkout = useCallback(() => {
    if (!nextWorkoutDay) return;
    openDay(nextWorkoutDay);
  }, [nextWorkoutDay, openDay]);

  const handleCreateCustomWorkout = useCallback(async () => {
    if (!userId || creatingCustom) return;
    setCreatingCustom(true);
    const workout = await createCustomWorkout(userId, t.training.custom_workout_default_name);
    setCreatingCustom(false);
    if (workout) {
      navigation.navigate('WorkoutDetail', { workoutId: workout.id, dayTitle: t.training.custom_workout_badge });
    }
  }, [userId, creatingCustom, createCustomWorkout, navigation, t]);

  const renderCustomWorkouts = () => (
    <View style={styles.customSection}>
      <AppText variant="caps12" color={colors.text.tertiary}>
        {t.training.custom_workouts_section}
      </AppText>

      <Button
        label={t.training.create_custom_workout}
        icon="add"
        variant="outline"
        onPress={() => void handleCreateCustomWorkout()}
        loading={creatingCustom}
        fullWidth
      />

      {customLoading && customWorkouts.length === 0 ? (
        <CardSkeleton />
      ) : null}

      {customWorkouts.map((workout) => (
        <Pressable
          key={workout.id}
          accessibilityRole="button"
          accessibilityLabel={workout.title}
          onPress={() => navigation.navigate('WorkoutDetail', {
            workoutId: workout.id,
            dayTitle: t.training.custom_workout_badge,
          })}
          style={({ pressed }) => [styles.customCard, pressed && styles.pressed]}
        >
          <ExerciseIcon icon="barbell-outline" size={44} imageUrl={workout.cover_image_url} />
          <View style={styles.dayInfo}>
            <AppText variant="body14SemiBold" color={colors.text.primary} numberOfLines={1}>
              {workout.title}
            </AppText>
            <AppText variant="body12" color={colors.text.tertiary} numberOfLines={1}>
              {t.training.custom_workout_badge}
            </AppText>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.text.tertiary} />
        </Pressable>
      ))}
    </View>
  );

  const renderDayRow = (day: PhaseWithDays['days'][number], completed: boolean) => {
    const meta = DAY_TYPE_META[day.day_type];
    const rest = isRestDay(day);

    return (
      <View style={styles.dayRow}>
        <ExerciseIcon icon={meta.icon} size={44} muted={rest} />
        <View style={styles.dayInfo}>
          <AppText variant="body14SemiBold" color={colors.text.primary} numberOfLines={1}>
            {i18n(t.training.day_label, { n: day.day_number })} · {day.title}
          </AppText>
          {day.workout ? (
            <AppText variant="body12" color={colors.text.tertiary} numberOfLines={1}>
              {day.workout.title}
              {day.workout.duration_min ? ` · ${day.workout.duration_min} min` : ''}
            </AppText>
          ) : (
            <AppText variant="body12" color={colors.text.tertiary}>
              {t.training.rest_recovery}
            </AppText>
          )}
        </View>
        <View style={styles.dayTrail}>
          {completed ? (
            <Ionicons name="checkmark-circle" size={18} color={colors.text.primary} />
          ) : (
            <Chip label={meta.label} />
          )}
          {!rest ? (
            <Ionicons name="chevron-forward" size={16} color={colors.text.tertiary} />
          ) : null}
        </View>
      </View>
    );
  };

  const renderPrimaryCta = () => {
    if (!nextWorkoutDay?.workout) {
      if (programStats.allCompleted && phases.length > 0 && !activeSession) {
        return (
          <Card elevated style={styles.doneCard}>
            <Ionicons name="trophy-outline" size={20} color={colors.text.secondary} />
            <AppText variant="body14Medium" color={colors.text.primary} style={styles.doneText}>
              {t.training.all_workouts_done}
            </AppText>
          </Card>
        );
      }
      return null;
    }

    const meta = DAY_TYPE_META[nextWorkoutDay.day_type];
    const isCardio = isCardioDay(nextWorkoutDay);
    const ctaLabel = isCardio ? t.training.register_cardio : t.training.start_workout;

    return (
      <Card elevated style={styles.nextCard}>
        <View style={styles.nextTop}>
          <ExerciseIcon icon={meta.icon} size={52} />
          <View style={styles.nextInfo}>
            <AppText variant="caps11" color={colors.text.tertiary}>
              {t.training.next_workout}
            </AppText>
            <AppText variant="h3" color={colors.text.primary} numberOfLines={2}>
              {nextWorkoutDay.workout.title}
            </AppText>
            <AppText variant="body13" color={colors.text.secondary} numberOfLines={2}>
              {nextWorkoutDay.phase.name} · {i18n(t.training.day_label, { n: nextWorkoutDay.day_number })}
            </AppText>
          </View>
        </View>
        <View style={styles.nextMeta}>
          <Chip label={meta.label} />
          {nextWorkoutDay.workout.duration_min != null ? (
            <AppText variant="body12" color={colors.text.tertiary}>
              {i18n(t.training.duration_min, { n: nextWorkoutDay.workout.duration_min })}
            </AppText>
          ) : null}
        </View>
        <Button label={ctaLabel} icon={isCardio ? 'pulse-outline' : 'play-outline'} variant="outline" onPress={openNextWorkout} fullWidth />
      </Card>
    );
  };

  const renderProgram = () => {
    if (phasesLoading && phases.length === 0) {
      return (
        <View>
          <CardSkeleton />
          <CardSkeleton />
        </View>
      );
    }

    if (phasesError && phases.length === 0) {
      return <ErrorState message={phasesError} onRetry={() => void loadProgram()} />;
    }

    if (phases.length === 0) {
      return (
        <>
          {renderCustomWorkouts()}
          <EmptyState
            pillar="training"
            hideIllustration
            title={t.training.no_program}
            message={t.training.empty_program_message}
            actionLabel={t.training.register_cardio}
            onAction={() => navigation.navigate('CardioLog')}
          />
        </>
      );
    }

    return (
      <>
        {programStats.trainableCount > 0 && !programStats.allCompleted ? (
          <View style={styles.progressBlock}>
            <View style={styles.progressHeader}>
              <AppText variant="body13Medium" color={colors.text.secondary}>
                {i18n(t.training.workouts_done, {
                  done: programStats.completedCount,
                  total: programStats.trainableCount,
                })}
              </AppText>
              <AppText variant="body12" color={colors.text.tertiary}>
                {Math.round(programStats.progress * 100)}%
              </AppText>
            </View>
            <ProgressBar progress={programStats.progress} height={4} />
          </View>
        ) : null}

        {renderPrimaryCta()}

        {renderCustomWorkouts()}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.training.register_cardio}
          onPress={() => navigation.navigate('CardioLog')}
          style={({ pressed }) => [styles.secondaryAction, pressed && styles.pressed]}
        >
          <Ionicons name="pulse-outline" size={18} color={colors.text.secondary} />
          <AppText variant="body14SemiBold" color={colors.text.primary} style={styles.secondaryActionLabel}>
            {t.training.register_cardio}
          </AppText>
          <Ionicons name="chevron-forward" size={16} color={colors.text.tertiary} />
        </Pressable>

        <AppText variant="caps12" color={colors.text.tertiary}>
          {t.training.trainer_plan_section}
        </AppText>

        {phases.map((phase) => {
          const expanded = phase.id === expandedPhaseId;
          const progress = getPhaseProgress(phase, completedWorkoutNames);
          const trainableInPhase = phase.days.filter(isTrainableDay).length;
          const doneInPhase = phase.days.filter(
            (day) => isTrainableDay(day) && isDayCompleted(day, completedWorkoutNames),
          ).length;

          return (
            <Card key={phase.id} style={styles.phaseCard}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${t.training.program} ${phase.phase_number}: ${phase.name}`}
                accessibilityState={{ expanded }}
                onPress={() => setExpandedId(expanded ? '' : phase.id)}
                style={({ pressed }) => [pressed && styles.pressed]}
              >
                <View style={styles.phaseHeader}>
                  <View style={styles.phaseInfo}>
                    <AppText variant="caps11" color={colors.text.tertiary}>
                      {t.training.program} {phase.phase_number}
                    </AppText>
                    <AppText variant="body16SemiBold" color={colors.text.primary}>
                      {phase.name}
                    </AppText>
                    {trainableInPhase > 0 ? (
                      <AppText variant="body12" color={colors.text.tertiary} style={styles.phaseMeta}>
                        {i18n(t.training.workouts_done, { done: doneInPhase, total: trainableInPhase })}
                      </AppText>
                    ) : null}
                  </View>
                  <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.text.tertiary} />
                </View>
                <ProgressBar progress={progress} height={4} style={styles.phaseProgress} />
              </Pressable>

              {expanded ? (
                <View style={styles.daysWrap}>
                  {phase.days.length === 0 ? (
                    <AppText variant="body13" color={colors.text.tertiary} style={styles.phaseEmpty}>
                      {t.training.empty_phase_days}
                    </AppText>
                  ) : null}
                  {phase.days.map((day) => {
                    const completed = isDayCompleted(day, completedWorkoutNames);
                    const rest = isRestDay(day);

                    if (rest) {
                      return (
                        <View key={day.id} style={[styles.dayCard, styles.dayCardRest]}>
                          {renderDayRow(day, completed)}
                        </View>
                      );
                    }

                    return (
                      <Pressable
                        key={day.id}
                        accessibilityRole="button"
                        accessibilityLabel={`${day.title} — ${isCardioDay(day) ? t.training.register_cardio : t.training.view_workout}`}
                        onPress={() => openDay(day)}
                        style={({ pressed }) => [styles.dayCard, pressed && styles.pressed]}
                      >
                        {renderDayRow(day, completed)}
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
            </Card>
          );
        })}

        <RecentWorkoutFeed logs={recentLogs} loading={logsLoading} limit={5} compact />
      </>
    );
  };

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={{
        paddingTop: insets.top + spacing.md,
        paddingBottom: scrollBottom,
        paddingHorizontal: layout.screenPadding,
      }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <AppText variant="h1" color={colors.text.primary} style={styles.headerTitle}>
          {t.training.title}
        </AppText>
        <HeaderAvatar />
      </View>

      <ActiveSessionBanner />

      <View style={styles.body}>{renderProgram()}</View>
    </ScrollView>
  );
}

const createStyles = (colors: Colors) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  headerTitle: { flex: 1 },
  body: { gap: spacing.sm },
  progressBlock: { gap: spacing.xs },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nextCard: { gap: spacing.md, padding: spacing.md },
  nextTop: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  nextInfo: { flex: 1, gap: spacing.xxs },
  nextMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  doneCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  doneText: { flex: 1 },
  secondaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface.base,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  secondaryActionLabel: { flex: 1 },
  customSection: { gap: spacing.sm },
  customCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface.base,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  phaseCard: { marginBottom: 0 },
  phaseHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  phaseInfo: { flex: 1 },
  phaseMeta: { marginTop: spacing.xxs },
  phaseProgress: { marginTop: spacing.sm },
  daysWrap: { marginTop: spacing.md, gap: spacing.xs },
  phaseEmpty: { paddingVertical: spacing.sm },
  dayCard: {
    backgroundColor: colors.surface.elevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    padding: spacing.sm,
  },
  dayCardRest: { opacity: 0.82 },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dayInfo: { flex: 1, minWidth: 0 },
  dayTrail: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  pressed: { opacity: 0.8 },
});
