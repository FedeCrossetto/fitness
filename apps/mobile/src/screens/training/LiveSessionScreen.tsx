import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  type WorkoutSessionExercise,
  type WorkoutSessionSet,
} from '@reset-fitness/shared';
import { layout, radius, spacing, Colors, useThemedStyles, useTheme } from '../../theme';
import { formatDuration } from '../../lib/dates';
import { sessionDetailFromActive, formatRestCountdown, getRestRemainingSeconds } from '../../lib/trainingSession';
import { hapticSelect, hapticSuccess } from '../../lib/haptics';
import { AppText, Button, EmptyState, IconButton } from '../../components/common';
import { ExerciseSearchSheet } from '../../components/training/ExerciseSearchSheet';
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
  const [exerciseSheetVisible, setExerciseSheetVisible] = useState(false);

  useEffect(() => {
    if (!activeSession) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [activeSession]);

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
    (workoutExerciseId: string, set: WorkoutSessionSet) => {
      hapticSelect();
      updateSet(workoutExerciseId, set.id, { completed: !set.completed });
    },
    [updateSet],
  );

  const renderSetRow = useCallback(
    (exercise: WorkoutSessionExercise, set: WorkoutSessionSet, rowIndex: number) => {
      const alt = rowIndex % 2 === 1;
      return (
        <View key={set.id} style={[styles.setRow, alt && styles.setRowAlt, set.completed && styles.setRowDone]}>
          <AppText variant="body13Medium" color={colors.text.secondary} style={styles.colSet}>
            {set.setNumber}
          </AppText>
          <AppText variant="body12" color={colors.text.tertiary} style={styles.colPrev} numberOfLines={1}>
            {exercise.previousLabel ?? '—'}
          </AppText>
          <TextInput
            style={[styles.cellInput, styles.colKg]}
            keyboardType="decimal-pad"
            placeholder="—"
            placeholderTextColor={colors.text.tertiary}
            value={set.weightKg != null ? String(set.weightKg) : ''}
            onChangeText={(text) =>
              updateSet(exercise.workoutExerciseId, set.id, { weightKg: parseNumericInput(text) })
            }
          />
          <TextInput
            style={[styles.cellInput, styles.colReps]}
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
            onPress={() => toggleSetComplete(exercise.workoutExerciseId, set)}
            style={[styles.checkBtn, set.completed && styles.checkBtnDone]}
          >
            {set.completed ? (
              <Ionicons name="checkmark" size={13} color="#111111" />
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

      return (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            hapticSelect();
            toggleRestEnabled();
          }}
          style={({ pressed }) => [styles.restRow, isActiveRest && styles.restRowActive, pressed && styles.pressed]}
        >
          <Ionicons
            name="timer-outline"
            size={16}
            color={isActiveRest ? colors.primary.onText : colors.primary.default}
          />
          <AppText
            variant="body12Medium"
            color={isActiveRest ? colors.primary.onText : colors.text.secondary}
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
              <AppText variant="body12SemiBold" color={colors.primary.onText}>
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
          <ExerciseIcon icon="barbell-outline" size={36} />
          <AppText variant="body14SemiBold" color={colors.primary.default} style={styles.exerciseTitle} numberOfLines={2}>
            {item.exerciseName}
          </AppText>
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
          <AppText variant="caps11" color={colors.text.tertiary} style={styles.colPrev}>
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

        {item.sets.map((set, index) => renderSetRow(item, set, index))}

        <Pressable
          accessibilityRole="button"
          onPress={() => {
            hapticSelect();
            addSet(item.workoutExerciseId);
          }}
          style={({ pressed }) => [styles.addSetBtn, pressed && styles.pressed]}
        >
          <Ionicons name="add" size={16} color={colors.text.secondary} />
          <AppText variant="body13Medium" color={colors.text.secondary}>
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
          <ActivityIndicator color={colors.primary.default} />
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
        <Pressable
          accessibilityRole="button"
          onPress={() => void onFinish()}
          disabled={finishing}
          style={({ pressed }) => [styles.finishBtn, pressed && styles.pressed, finishing && styles.disabled]}
        >
          {finishing ? (
            <ActivityIndicator size="small" color={colors.primary.onText} />
          ) : (
            <AppText variant="body14SemiBold" color={colors.primary.onText}>
              {t.training.finish_short}
            </AppText>
          )}
        </Pressable>
      </View>

      <View style={styles.statsBar}>
        <View style={styles.stat}>
          <AppText variant="caps11" color={colors.text.tertiary}>{t.training.duration}</AppText>
          <AppText variant="body14SemiBold" color={colors.primary.default}>{formatDuration(stats.elapsed)}</AppText>
        </View>
        <View style={styles.stat}>
          <AppText variant="caps11" color={colors.text.tertiary}>{t.training.volume}</AppText>
          <AppText variant="body14SemiBold" color={colors.text.primary}>
            {i18n(t.training.weight_kg, { n: stats.volume.toLocaleString('es-AR') })}
          </AppText>
        </View>
        <View style={styles.stat}>
          <AppText variant="caps11" color={colors.text.tertiary}>{t.training.sets_completed}</AppText>
          <AppText variant="body14SemiBold" color={colors.text.primary}>
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
          <View style={styles.footer}>
            <Button
              label={t.training.add_exercise}
              icon="add"
              variant="secondary"
              onPress={() => setExerciseSheetVisible(true)}
              fullWidth
            />
            <Button label={t.training.discard_session} variant="ghost" size="md" onPress={onDiscard} fullWidth />
          </View>
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
    finishBtn: {
      backgroundColor: colors.primary.default,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      minWidth: 88,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 36,
    },
    statsBar: {
      flexDirection: 'row',
      paddingHorizontal: layout.screenPadding,
      paddingBottom: spacing.md,
      gap: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border.subtle,
    },
    stat: { flex: 1, gap: 2 },
    listContent: {
      paddingHorizontal: layout.screenPadding,
      paddingTop: spacing.md,
    },
    blockGap: { height: spacing.md },
    exerciseBlock: {
      backgroundColor: colors.surface.base,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border.default,
      overflow: 'hidden',
    },
    exerciseHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.sm,
      paddingTop: spacing.sm,
      paddingBottom: spacing.xs,
    },
    exerciseTitle: { flex: 1 },
    exerciseNotes: {
      marginHorizontal: spacing.sm,
      marginBottom: spacing.xs,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.md,
      backgroundColor: colors.surface.elevated,
      color: colors.text.primary,
      fontSize: 13,
      minHeight: 34,
    },
    restRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.sm,
      paddingBottom: spacing.xs,
    },
    restRowActive: {
      marginHorizontal: spacing.xs,
      marginBottom: spacing.xs,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: radius.md,
      backgroundColor: colors.primary.default,
    },
    restLabel: { flex: 1 },
    tableHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.xs,
      paddingVertical: 6,
      backgroundColor: colors.surface.elevated,
    },
    setRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.xs,
      paddingVertical: 4,
      minHeight: 38,
    },
    setRowAlt: { backgroundColor: colors.surface.elevated },
    setRowDone: { backgroundColor: 'rgba(49, 243, 123, 0.07)' },
    colSet: { width: 30, textAlign: 'center' },
    colPrev: { flex: 1, paddingHorizontal: 4 },
    colKg: { width: 56, textAlign: 'center' },
    colReps: { width: 46, textAlign: 'center' },
    colCheck: { width: 30 },
    cellInput: {
      color: colors.text.primary,
      fontSize: 14,
      fontWeight: '600',
      textAlign: 'center',
      paddingVertical: 5,
      paddingHorizontal: 4,
      borderRadius: radius.sm,
      backgroundColor: colors.background,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border.subtle,
    },
    checkBtn: {
      width: 26,
      height: 26,
      borderRadius: radius.pill,
      borderWidth: 1.5,
      borderColor: colors.border.strong,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 4,
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
      marginHorizontal: spacing.xs,
      marginVertical: spacing.xs,
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
      backgroundColor: colors.surface.elevated,
    },
    footer: { marginTop: spacing.lg, gap: spacing.sm },
    pressed: { opacity: 0.85 },
    disabled: { opacity: 0.6 },
  });
