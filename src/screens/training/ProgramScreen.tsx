import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, illustrations, layout, radius, spacing } from '../../theme';
import {
  AppText,
  Button,
  Card,
  CardSkeleton,
  Chip,
  EmptyState,
  ErrorState,
  ProgressBar,
} from '../../components/common';
import { ActiveSessionBanner } from '../../components/training/ActiveSessionBanner';
import { useAuthStore } from '../../stores/authStore';
import { useTrainingStore, type PhaseWithDays } from '../../stores/trainingStore';
import { DAY_TYPE_META } from './trainingMeta';
import type { TrainingStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<TrainingStackParamList, 'Program'>;

export function ProgramScreen({ navigation }: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();

  const session = useAuthStore((s) => s.session);
  const userId = session?.user.id;

  const phases = useTrainingStore((s) => s.phases);
  const phasesLoading = useTrainingStore((s) => s.phasesLoading);
  const phasesError = useTrainingStore((s) => s.phasesError);
  const loadProgram = useTrainingStore((s) => s.loadProgram);
  const recentLogs = useTrainingStore((s) => s.recentLogs);
  const loadRecentLogs = useTrainingStore((s) => s.loadRecentLogs);
  const restoreActiveSession = useTrainingStore((s) => s.restoreActiveSession);

  const [expandedId, setExpandedId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      void loadProgram();
      void restoreActiveSession();
      if (userId) void loadRecentLogs(userId);
    }, [loadProgram, restoreActiveSession, loadRecentLogs, userId])
  );

  const completedWorkoutNames = useMemo(
    () => new Set(recentLogs.filter((l) => l.completed).map((l) => l.workout_name)),
    [recentLogs]
  );

  const phaseProgress = useCallback(
    (phase: PhaseWithDays): number => {
      const trainableDays = phase.days.filter((d) => d.day_type !== 'descanso' && d.workout);
      if (trainableDays.length === 0) return 0;
      const done = trainableDays.filter((d) => d.workout && completedWorkoutNames.has(d.workout.title)).length;
      return done / trainableDays.length;
    },
    [completedWorkoutNames]
  );

  const expandedPhaseId = expandedId ?? phases[0]?.id ?? null;

  const renderContent = () => {
    if (phasesLoading && phases.length === 0) {
      return (
        <View>
          <CardSkeleton />
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
        <EmptyState
          pillar="training"
          title="Sin programa todavía"
          message="Tu coach todavía no asignó un programa. Mientras tanto podés registrar tu cardio y mantenerte en movimiento."
          actionLabel="Registrar cardio"
          onAction={() => navigation.navigate('CardioLog')}
        />
      );
    }

    return (
      <View>
        {phases.map((phase) => {
          const expanded = phase.id === expandedPhaseId;
          const progress = phaseProgress(phase);
          return (
            <Card key={phase.id} style={styles.phaseCard}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Fase ${phase.phase_number}: ${phase.name}`}
                accessibilityState={{ expanded }}
                onPress={() => setExpandedId(expanded ? '' : phase.id)}
                style={({ pressed }) => [pressed && styles.pressed]}
              >
                <View style={styles.phaseHeader}>
                  <View style={styles.phaseInfo}>
                    <AppText variant="caps11" color={colors.primary.default}>
                      Fase {phase.phase_number}
                    </AppText>
                    <AppText variant="body16SemiBold" color={colors.text.primary} style={styles.phaseName}>
                      {phase.name}
                    </AppText>
                    {phase.description ? (
                      <AppText variant="body13" color={colors.text.secondary} numberOfLines={2}>
                        {phase.description}
                      </AppText>
                    ) : null}
                  </View>
                  <Ionicons
                    name={expanded ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={colors.text.tertiary}
                  />
                </View>
                <View style={styles.progressRow}>
                  <ProgressBar progress={progress} height={6} style={styles.progressBar} />
                  <AppText variant="body12Medium" color={colors.text.tertiary}>
                    {Math.round(progress * 100)}%
                  </AppText>
                </View>
              </Pressable>

              {expanded ? (
                <View style={styles.daysWrap}>
                  {phase.days.length === 0 ? (
                    <AppText variant="body13" color={colors.text.tertiary} style={styles.phaseEmpty}>
                      Todavía no hay días cargados en esta fase.
                    </AppText>
                  ) : null}
                  {phase.days.map((day) => {
                    const meta = DAY_TYPE_META[day.day_type];
                    const isRest = day.day_type === 'descanso' || !day.workout;
                    const row = (
                      <View style={styles.dayRow}>
                        <View style={styles.dayIcon}>
                          <Ionicons name={meta.icon} size={18} color={colors.primary.default} />
                        </View>
                        <View style={styles.dayInfo}>
                          <AppText variant="body14SemiBold" color={colors.text.primary} numberOfLines={1}>
                            Día {day.day_number} · {day.title}
                          </AppText>
                          {day.workout ? (
                            <AppText variant="body12" color={colors.text.tertiary} numberOfLines={1}>
                              {day.workout.title}
                            </AppText>
                          ) : day.day_type === 'descanso' ? (
                            <AppText variant="body12" color={colors.text.tertiary}>
                              Recuperá energía
                            </AppText>
                          ) : null}
                        </View>
                        <Chip label={meta.label} />
                        {!isRest ? (
                          <Ionicons name="chevron-forward" size={16} color={colors.text.tertiary} />
                        ) : (
                          <Image
                            source={illustrations.pose.rest}
                            style={styles.restMascot}
                            contentFit="contain"
                          />
                        )}
                      </View>
                    );

                    if (isRest) {
                      return (
                        <View key={day.id} style={styles.dayCard}>
                          {row}
                        </View>
                      );
                    }
                    return (
                      <Pressable
                        key={day.id}
                        accessibilityRole="button"
                        accessibilityLabel={`Día ${day.day_number}: ${day.title}`}
                        onPress={() =>
                          navigation.navigate('WorkoutDetail', {
                            workoutId: day.workout!.id,
                            dayTitle: day.title,
                          })
                        }
                        style={({ pressed }) => [styles.dayCard, pressed && styles.pressed]}
                      >
                        {row}
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
            </Card>
          );
        })}
      </View>
    );
  };

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={{
        paddingTop: insets.top + spacing.md,
        paddingBottom: layout.tabBarHeight + spacing.xxl,
        paddingHorizontal: layout.screenPadding,
      }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View style={styles.headerText}>
          <AppText variant="caps12" color={colors.text.tertiary}>
            Tu pilar
          </AppText>
          <AppText variant="h1" color={colors.text.primary} style={styles.title}>
            Entrenamiento
          </AppText>
        </View>
        <Image source={illustrations.pillarHeader.training} style={styles.mascot} contentFit="contain" />
      </View>

      <ActiveSessionBanner />

      <Button
        label="Registrar cardio"
        variant="secondary"
        size="md"
        icon="pulse-outline"
        onPress={() => navigation.navigate('CardioLog')}
        style={styles.cardioButton}
      />

      {renderContent()}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  headerText: { flex: 1 },
  title: { marginTop: 2 },
  mascot: { width: 72, height: 88 },
  cardioButton: { marginBottom: spacing.lg },
  phaseCard: { marginBottom: spacing.md },
  phaseHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  phaseInfo: { flex: 1 },
  phaseName: { marginTop: spacing.xxs, marginBottom: 2 },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  progressBar: { flex: 1 },
  daysWrap: { marginTop: spacing.md, gap: spacing.xs },
  phaseEmpty: { paddingVertical: spacing.sm },
  dayCard: {
    backgroundColor: colors.surface.elevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    padding: spacing.sm,
  },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dayIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.primary.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayInfo: { flex: 1 },
  restMascot: { width: 28, height: 34 },
  pressed: { opacity: 0.8 },
});
