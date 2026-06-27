import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  computeSessionVolumeKg,
  formatPreviousSetLine,
  type WorkoutSessionExercise,
  type WorkoutSessionSet,
} from '@reset-fitness/shared';
import { layout, radius, spacing, Colors, useThemedStyles, useTheme } from '../../theme';
import { formatDuration } from '../../lib/dates';
import { sessionDetailFromActive, formatRestCountdown, getRestRemainingSeconds } from '../../lib/trainingSession';
import { hapticSelect, hapticSuccess } from '../../lib/haptics';
import { AppText, Button, EmptyState, IconButton, ProgressRing } from '../../components/common';
import { ExerciseSearchSheet } from '../../components/training/ExerciseSearchSheet';
import { ExercisePreviewSheet } from '../../components/training/ExercisePreviewSheet';
import { ExerciseIcon } from '../../components/training/ExerciseIcon';
import { NUTRITION_MACRO_COLORS } from '../../components/nutrition/nutritionTheme';
import { useAuthStore } from '../../stores/authStore';
import { useTranslation } from '../../stores/i18nStore';
import { useTrainingStore } from '../../stores/trainingStore';
import { useUiStore } from '../../stores/uiStore';
import { useTabBarScrollPadding } from '../../hooks/useTabBarScrollPadding';
import type { TrainingStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<TrainingStackParamList, 'LiveSession'>;

function parseNumericInput(text: string): number | null {
  const normalized = text.replace(',', '.').trim();
  if (!normalized) return null;
  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) ? value : null;
}

function parseIntInput(text: string): number | null {
  const normalized = text.trim();
  if (!normalized) return null;
  const value = Number.parseInt(normalized, 10);
  return Number.isFinite(value) ? value : null;
}

const SET_DONE_GREEN = `${NUTRITION_MACRO_COLORS.carbs}28`;

function getPreviousLabelForSet(exercise: WorkoutSessionExercise, setNumber: number): string {
  const match = exercise.previousSets?.find((s) => s.setNumber === setNumber);
  if (match) return formatPreviousSetLine(match);
  if (setNumber === 1 && exercise.previousLabel && !exercise.previousSets?.length) {
    return exercise.previousLabel;
  }
  return '—';
}

export function LiveSessionScreen({ navigation }: Props): React.JSX.Element {
  const { colors } = useTheme();
  const { t, i18n } = useTranslation();
  const styles = useThemedStyles(createStyles);

  const insets = useSafeAreaInsets();
  const scrollBottom = useTabBarScrollPadding(spacing.xxl);

  const session = useAuthStore((s) => s.session);
  const userId = session?.user.id;

  const activeSession = useTrainingStore((s) => s.activeSession);
  const updateSet = useTrainingStore((s) => s.updateSet);
  const addSet = useTrainingStore((s) => s.addSet);
  const setExerciseNotes = useTrainingStore((s) => s.setExerciseNotes);
  const toggleRestEnabled = useTrainingStore((s) => s.toggleRestEnabled);
  const skipRest = useTrainingStore((s) => s.skipRest);
  const addExerciseToSession = useTrainingStore((s) => s.addExerciseToSession);
  const finishSession = useTrainingStore((s) => s.finishSession);
  const discardSession = useTrainingStore((s) => s.discardSession);

  const [now, setNow] = useState(() => Date.now());
  const [finishing, setFinishing] = useState(false);
  const lastRestEndKey = useRef<string | null>(null);
  const [exerciseSheetVisible, setExerciseSheetVisible] = useState(false);
  const [previewExercise, setPreviewExercise] = useState<{
    id: string;
    name: string;
    imageUrl: string | null;
  } | null>(null);

  useEffect(() => {
    if (!activeSession) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [activeSession]);

  // Haptic + toast cuando el descanso llega a 0
  useEffect(() => {
    if (!activeSession?.activeRest) {
      lastRestEndKey.current = null;
      return;
    }
    const remaining = getRestRemainingSeconds(activeSession, now);
    const key = activeSession.activeRest.workoutExerciseId;
    if (remaining === 0 && lastRestEndKey.current !== key) {
      lastRestEndKey.current = key;
      hapticSuccess();
      useUiStore.getState().showToast('success', '¡Listo! Siguiente serie');
    }
  }, [now, activeSession]);

  const stats = useMemo(() => {
    if (!activeSession) return { elapsed: 0, volume: 0, completedSets: 0, totalSets: 0 };
    const detail = sessionDetailFromActive(activeSession);
    return {
      elapsed: Math.max(0, Math.floor((now - activeSession.startedAt) / 1000)),
      volume: computeSessionVolumeKg(detail),
      completedSets: detail.exercises.reduce(
        (sum, ex) => sum + ex.sets.filter((s) => s.completed).length,
        0,
      ),
      totalSets: detail.exercises.reduce((sum, ex) => sum + ex.sets.length, 0),
    };
  }, [activeSession, now]);

  const onFinish = useCallback(async () => {
    if (!userId) return;
    setFinishing(true);
    const log = await finishSession(userId);
    if (log) {
      hapticSuccess();
      navigation.replace('SessionSummary', { logId: log.id });
    } else {
      setFinishing(false);
      useUiStore.getState().showToast('error', t.training.save_session_error);
    }
  }, [userId, finishSession, navigation, t]);

  const onDiscard = useCallback(() => {
    Alert.alert(t.training.discard_session, t.training.discard_session_confirm, [
      { text: t.ui.cancel, style: 'cancel' },
      {
        text: t.training.discard,
        style: 'destructive',
        onPress: () => {
          void discardSession();
          navigation.goBack();
        },
      },
    ]);
  }, [discardSession, navigation, t]);

  const toggleSetComplete = useCallback(
    (workoutExerciseId: string, set: WorkoutSessionSet, exercise: WorkoutSessionExercise) => {
      const completing = !set.completed;
      hapticSelect();
      updateSet(workoutExerciseId, set.id, { completed: completing });

      // Detectar PR: completando una serie con peso mayor al histórico
      if (completing && set.weightKg != null && set.reps != null) {
        const bestPrevious = exercise.previousSets?.reduce<number>(
          (max, s) => (s.weightKg > max ? s.weightKg : max),
          0,
        ) ?? 0;
        if (set.weightKg > bestPrevious && bestPrevious > 0) {
          hapticSuccess();
          useUiStore.getState().showToast('success', `¡Nuevo récord! ${set.weightKg} kg × ${set.reps}`);
        }
      }
    },
    [updateSet],
  );

  const renderSetRow = useCallback(
    (exercise: WorkoutSessionExercise, set: WorkoutSessionSet) => {
      const previousLabel = getPreviousLabelForSet(exercise, set.setNumber);
      return (
        <View key={set.id} style={[styles.setRow, set.completed && styles.setRowDone]}>
          <AppText
            variant="body14SemiBold"
            color={set.completed ? colors.text.primary : colors.text.secondary}
            style={styles.colSet}
          >
            {set.setNumber}
          </AppText>
          <AppText variant="body13" color={colors.text.tertiary} style={styles.colPrevious} numberOfLines={1}>
            {previousLabel}
          </AppText>
          <TextInput
            style={[styles.cellInput, styles.colKg, set.completed && styles.cellInputDone]}
            keyboardType="decimal-pad"
            placeholder="—"
            placeholderTextColor={colors.text.tertiary}
            value={set.weightKg != null ? String(set.weightKg) : ''}
            onChangeText={(text) =>
              updateSet(exercise.workoutExerciseId, set.id, { weightKg: parseNumericInput(text) })
            }
          />
          <TextInput
            style={[styles.cellInput, styles.colReps, set.completed && styles.cellInputDone]}
            keyboardType="number-pad"
            placeholder="—"
            placeholderTextColor={colors.text.tertiary}
            value={set.reps != null ? String(set.reps) : ''}
            onChangeText={(text) =>
              updateSet(exercise.workoutExerciseId, set.id, { reps: parseIntInput(text) })
            }
          />
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: set.completed }}
            onPress={() => toggleSetComplete(exercise.workoutExerciseId, set, exercise)}
            style={[styles.checkBtn, set.completed && styles.checkBtnDone]}
          >
            {set.completed ? (
              <Ionicons name="checkmark" size={14} color={colors.text.primary} />
            ) : null}
          </Pressable>
        </View>
      );
    },
    [colors, styles, toggleSetComplete, updateSet],
  );

  const renderRestRow = useCallback(
    (exercise: WorkoutSessionExercise) => {
      if (!activeSession) return null;
      const isActiveRest =
        activeSession.activeRest?.workoutExerciseId === exercise.workoutExerciseId &&
        getRestRemainingSeconds(activeSession, now) > 0;
      const remaining = activeSession ? getRestRemainingSeconds(activeSession, now) : 0;

      let label = t.training.rest_off;
      if (activeSession.restEnabled) {
        if (isActiveRest) {
          label = i18n(t.training.rest_countdown, { time: formatRestCountdown(remaining) });
        } else if (exercise.restSeconds && exercise.restSeconds > 0) {
          label = i18n(t.training.rest_seconds_config, { n: exercise.restSeconds });
        } else {
          label = t.training.rest_ready;
        }
      }

      const totalSec = activeSession?.activeRest?.totalSeconds ?? exercise.restSeconds ?? 0;
      const ringProgress = isActiveRest && totalSec > 0 ? remaining / totalSec : 0;

      return (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            hapticSelect();
            toggleRestEnabled();
          }}
          style={({ pressed }) => [styles.restRow, pressed && styles.pressed]}
        >
          {isActiveRest ? (
            <ProgressRing
              size={36}
              strokeWidth={3}
              progress={ringProgress}
              color={NUTRITION_MACRO_COLORS.carbs}
              glow={false}
            >
              <AppText variant="caps11" color={NUTRITION_MACRO_COLORS.carbs}>
                {remaining}
              </AppText>
            </ProgressRing>
          ) : (
            <Ionicons
              name="timer-outline"
              size={14}
              color={colors.text.tertiary}
            />
          )}
          <AppText
            variant="body12Medium"
            color={isActiveRest ? NUTRITION_MACRO_COLORS.carbs : colors.text.tertiary}
            style={styles.restLabel}
          >
            {label}
          </AppText>
          {isActiveRest ? (
            <Pressable
              accessibilityRole="button"
              onPress={(event) => {
                event.stopPropagation();
                hapticSelect();
                skipRest();
              }}
              hitSlop={8}
            >
              <AppText variant="body12Medium" color={NUTRITION_MACRO_COLORS.carbs}>
                {t.training.rest_skip}
              </AppText>
            </Pressable>
          ) : null}
        </Pressable>
      );
    },
    [activeSession, colors, i18n, now, skipRest, styles, t, toggleRestEnabled],
  );

  const renderExercise = useCallback(
    ({ item }: { item: WorkoutSessionExercise }) => (
      <View style={styles.exerciseBlock}>
        <View style={styles.exerciseHeader}>
          <ExerciseIcon
            icon="barbell-outline"
            size={56}
            imageUrl={item.imageUrl}
            bodyPart={item.bodyPart}
            onPress={() => {
              hapticSelect();
              setPreviewExercise({
                id: item.exerciseId,
                name: item.exerciseName,
                imageUrl: item.imageUrl,
              });
            }}
          />
          <View style={styles.exerciseHeaderText}>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                hapticSelect();
                setPreviewExercise({
                  id: item.exerciseId,
                  name: item.exerciseName,
                  imageUrl: item.imageUrl,
                });
              }}
            >
              <AppText variant="body16SemiBold" color={colors.text.primary} numberOfLines={2}>
                {item.exerciseName}
              </AppText>
            </Pressable>
          </View>
        </View>

        <TextInput
          style={styles.exerciseNotes}
          placeholder={t.training.exercise_notes_placeholder}
          placeholderTextColor={colors.text.tertiary}
          value={item.notes}
          onChangeText={(text) => setExerciseNotes(item.workoutExerciseId, text)}
        />

        {renderRestRow(item)}

        <View style={styles.tableHeader}>
          <AppText variant="caps11" color={colors.text.tertiary} style={styles.colSet}>
            {t.training.set_column}
          </AppText>
          <AppText variant="caps11" color={colors.text.tertiary} style={styles.colPrevious}>
            {t.training.previous_column}
          </AppText>
          <AppText variant="caps11" color={colors.text.tertiary} style={styles.colKg}>
            {t.training.kg_column}
          </AppText>
          <AppText variant="caps11" color={colors.text.tertiary} style={styles.colReps}>
            {t.training.reps_column}
          </AppText>
          <View style={styles.colCheck} />
        </View>

        {item.sets.map((set) => renderSetRow(item, set))}

        <Pressable
          accessibilityRole="button"
          onPress={() => {
            hapticSelect();
            addSet(item.workoutExerciseId);
          }}
          style={({ pressed }) => [styles.addSetBtn, pressed && styles.pressed]}
        >
          <Ionicons name="add" size={16} color={colors.text.secondary} />
          <AppText variant="body14Medium" color={colors.text.secondary}>
            {t.training.add_set}
          </AppText>
        </Pressable>
      </View>
    ),
    [addSet, colors, renderRestRow, renderSetRow, setExerciseNotes, styles, t],
  );

  if (!activeSession) {
    if (finishing) {
      return (
        <View style={[styles.flex, styles.center]}>
          <ActivityIndicator color={colors.text.secondary} />
        </View>
      );
    }
    return (
      <View style={[styles.flex, styles.center, { paddingTop: insets.top + spacing.md }]}>
        <EmptyState
          pillar="training"
          hideIllustration
          title={t.training.no_active_session}
          message={t.training.no_active_session_message}
          actionLabel={t.training.go_back}
          onAction={() => navigation.goBack()}
        />
      </View>
    );
  }

  const exercises = activeSession.exercises;

  return (
    <View style={[styles.flex, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <IconButton icon="chevron-back" onPress={() => navigation.goBack()} accessibilityLabel={t.training.go_back} />
        <AppText variant="body16SemiBold" color={colors.text.primary} numberOfLines={1} style={styles.topTitle}>
          {activeSession.workoutTitle}
        </AppText>
        <Button
          label={t.training.finish_short}
          onPress={() => void onFinish()}
          variant="primary"
          size="md"
          loading={finishing}
          disabled={finishing}
        />
      </View>

      <View style={styles.statsBar}>
        <View style={styles.stat}>
          <AppText variant="caps11" color={colors.text.tertiary}>{t.training.duration}</AppText>
          <AppText variant="body16SemiBold" color={colors.text.primary}>{formatDuration(stats.elapsed)}</AppText>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <AppText variant="caps11" color={colors.text.tertiary}>{t.training.volume}</AppText>
          <AppText variant="body16SemiBold" color={colors.text.primary}>
            {i18n(t.training.weight_kg, { n: stats.volume.toLocaleString('es-AR') })}
          </AppText>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <AppText variant="caps11" color={colors.text.tertiary}>{t.training.sets_completed}</AppText>
          <AppText variant="body16SemiBold" color={colors.text.primary}>
            {stats.completedSets}
          </AppText>
        </View>
      </View>

      <FlatList
        data={exercises}
        keyExtractor={(item) => item.workoutExerciseId}
        renderItem={renderExercise}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.listContent, { paddingBottom: scrollBottom }]}
        ItemSeparatorComponent={() => <View style={styles.blockGap} />}
        ListEmptyComponent={
          <EmptyState
            pillar="training"
            hideIllustration
            title={t.training.empty_workout_exercises}
            message={t.training.live_exercises_empty}
            compact
          />
        }
        ListFooterComponent={
          activeSession?.isCustomWorkout ? (
            <View style={styles.footer}>
              <Button
                label={t.training.add_exercise}
                icon="add"
                variant="outline"
                onPress={() => setExerciseSheetVisible(true)}
                fullWidth
              />
              <Button label={t.training.discard_session} variant="ghost" size="md" onPress={onDiscard} fullWidth />
            </View>
          ) : (
            <View style={styles.footer}>
              <Button label={t.training.discard_session} variant="ghost" size="md" onPress={onDiscard} fullWidth />
            </View>
          )
        }
      />

      <ExerciseSearchSheet
        visible={exerciseSheetVisible}
        onClose={() => setExerciseSheetVisible(false)}
        onPick={(exercise) => {
          if (!userId) return;
          void addExerciseToSession(userId, exercise);
          setExerciseSheetVisible(false);
        }}
      />

      <ExercisePreviewSheet
        visible={previewExercise !== null}
        onClose={() => setPreviewExercise(null)}
        exerciseId={previewExercise?.id ?? null}
        fallback={
          previewExercise
            ? { name: previewExercise.name, image_url: previewExercise.imageUrl }
            : undefined
        }
      />
    </View>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
    center: { justifyContent: 'center' },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: layout.screenPadding - spacing.xs,
      paddingBottom: spacing.sm,
    },
    topTitle: { flex: 1 },
    statsBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: layout.screenPadding,
      paddingBottom: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border.subtle,
    },
    stat: { flex: 1, alignItems: 'center', gap: 2 },
    statDivider: {
      width: StyleSheet.hairlineWidth,
      height: 28,
      backgroundColor: colors.border.subtle,
    },
    listContent: {
      paddingHorizontal: layout.screenPadding,
      paddingTop: spacing.sm,
    },
    blockGap: { height: spacing.lg },
    exerciseBlock: {
      backgroundColor: colors.surface.base,
      borderRadius: radius.lg,
      overflow: 'hidden',
    },
    exerciseHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
      paddingBottom: spacing.xs,
    },
    exerciseHeaderText: { flex: 1 },
    exerciseNotes: {
      marginHorizontal: spacing.md,
      marginBottom: spacing.xs,
      paddingVertical: spacing.xxs,
      color: colors.text.primary,
      fontSize: 13,
    },
    restRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.sm,
    },
    restLabel: { flex: 1 },
    tableHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      backgroundColor: colors.surface.elevated,
    },
    setRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: 4,
      minHeight: 46,
    },
    setRowDone: {
      backgroundColor: SET_DONE_GREEN,
      marginHorizontal: spacing.xs,
      borderRadius: radius.md,
    },
    colSet: { width: 28, textAlign: 'center' },
    colPrevious: { flex: 1.15, textAlign: 'center' },
    colKg: { flex: 0.75 },
    colReps: { flex: 0.75 },
    colCheck: { width: 32, alignItems: 'center' },
    cellInput: {
      color: colors.text.primary,
      fontSize: 16,
      fontWeight: '600',
      textAlign: 'center',
      paddingVertical: 8,
      paddingHorizontal: 4,
      backgroundColor: 'transparent',
    },
    cellInputDone: {},
    checkBtn: {
      width: 26,
      height: 26,
      borderRadius: radius.pill,
      borderWidth: 1.5,
      borderColor: colors.border.strong,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface.base,
    },
    checkBtnDone: {
      backgroundColor: NUTRITION_MACRO_COLORS.carbs,
      borderColor: NUTRITION_MACRO_COLORS.carbs,
    },
    addSetBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      marginHorizontal: spacing.md,
      marginVertical: spacing.sm,
      paddingVertical: spacing.md,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border.default,
      backgroundColor: colors.surface.elevated,
    },
    footer: { marginTop: spacing.lg, gap: spacing.sm },
    pressed: { opacity: 0.85 },
    disabled: { opacity: 0.6 },
  });
