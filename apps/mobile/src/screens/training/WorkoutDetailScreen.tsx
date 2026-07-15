import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { layout, radius, spacing, Colors, useThemedStyles, useTheme } from '../../theme';
import {
  AppText,
  Button,
  CardSkeleton,
  EmptyState,
  ErrorState,
  IconButton,
} from '../../components/common';
import { formatExercisePrescription } from '../../lib/trainingExercise';
import { isCustomWorkout } from '../../lib/trainingProgram';
import { useAuthStore } from '../../stores/authStore';
import { useTranslation } from '../../stores/i18nStore';
import { useTrainingStore, type WorkoutWithExercises } from '../../stores/trainingStore';
import { DAY_TYPE_META } from './trainingMeta';
import { ExerciseIcon } from '../../components/training/ExerciseIcon';
import { ExercisePreviewSheet } from '../../components/training/ExercisePreviewSheet';
import { ExerciseSearchSheet } from '../../components/training/ExerciseSearchSheet';
import { useTabBarFooterBottom, useTabBarFooterScrollPadding } from '../../hooks/useTabBarScrollPadding';
import type { TrainingStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<TrainingStackParamList, 'WorkoutDetail'>;
type ExerciseItem = WorkoutWithExercises['exercises'][number];

export function WorkoutDetailScreen({ navigation, route }: Props): React.JSX.Element {
  const { colors } = useTheme();
  const { t, i18n } = useTranslation();
  const styles = useThemedStyles(createStyles);

  const { workoutId, dayTitle } = route.params;
  const insets = useSafeAreaInsets();
  const footerBottom = useTabBarFooterBottom(spacing.sm);
  const scrollBottom = useTabBarFooterScrollPadding();
  const userId = useAuthStore((s) => s.session?.user.id);

  const workoutDetail = useTrainingStore((s) => s.workoutDetail);
  const detailLoading = useTrainingStore((s) => s.detailLoading);
  const detailError = useTrainingStore((s) => s.detailError);
  const loadWorkoutDetail = useTrainingStore((s) => s.loadWorkoutDetail);
  const addExerciseToCustomWorkout = useTrainingStore((s) => s.addExerciseToCustomWorkout);
  const activeSession = useTrainingStore((s) => s.activeSession);
  const startSession = useTrainingStore((s) => s.startSession);
  const discardSession = useTrainingStore((s) => s.discardSession);

  const [selectedExercise, setSelectedExercise] = useState<ExerciseItem | null>(null);
  const [starting, setStarting] = useState(false);
  const [exerciseSheetVisible, setExerciseSheetVisible] = useState(false);
  const [addingExercise, setAddingExercise] = useState(false);

  useEffect(() => {
    void loadWorkoutDetail(workoutId);
  }, [workoutId, loadWorkoutDetail]);

  const detail = workoutDetail?.id === workoutId ? workoutDetail : null;
  const isResume = activeSession?.workoutId === workoutId;
  const isCustom = detail != null && isCustomWorkout(detail, userId);

  const headerMetaLine = detail
    ? [
        DAY_TYPE_META[detail.workout_type].label,
        detail.duration_min != null ? i18n(t.training.duration_min, { n: detail.duration_min }) : null,
        detail.blocks === 1
          ? i18n(t.training.blocks_label, { n: 1 })
          : i18n(t.training.blocks_label_plural, { n: detail.blocks }),
        detail.calories_est != null ? i18n(t.training.calories_est, { n: detail.calories_est }) : null,
      ].filter(Boolean).join(' · ')
    : '';

  const begin = useCallback(async () => {
    if (!detail || !userId) return;
    setStarting(true);
    if (useTrainingStore.getState().activeSession) await discardSession();
    await startSession(userId, detail.id, detail.title);
    setStarting(false);
    navigation.navigate('LiveSession', { workoutId: detail.id, workoutTitle: detail.title });
  }, [detail, userId, discardSession, startSession, navigation]);

  const handleStart = useCallback(() => {
    if (!detail) return;
    // Las rutinas de intervalos usan el player por tiempo (no la sesión de series).
    if (detail.format === 'interval') {
      navigation.navigate('IntervalSession', { workoutId: detail.id, workoutTitle: detail.title });
      return;
    }
    if (isResume) {
      navigation.navigate('LiveSession', { workoutId: detail.id, workoutTitle: detail.title });
      return;
    }
    if (activeSession) {
      Alert.alert(
        t.training.session_in_progress,
        i18n(t.training.session_in_progress_message, { title: activeSession.workoutTitle }),
        [
          { text: t.ui.cancel, style: 'cancel' },
          { text: t.training.discard_and_start, style: 'destructive', onPress: () => void begin() },
        ],
      );
      return;
    }
    void begin();
  }, [detail, isResume, activeSession, begin, navigation, t, i18n]);

  const handleAddExercise = useCallback(async (exercise: Pick<ExerciseItem['exercise'], 'id' | 'name' | 'image_url'>) => {
    if (!detail || !userId || !isCustom || addingExercise) return;
    if (detail.exercises.some((item) => item.exercise_id === exercise.id)) return;
    setAddingExercise(true);
    const workoutExerciseId = await addExerciseToCustomWorkout(
      userId,
      detail.id,
      exercise,
      detail.exercises.length,
    );
    setAddingExercise(false);
    if (workoutExerciseId) {
      setExerciseSheetVisible(false);
      void loadWorkoutDetail(workoutId);
    }
  }, [detail, userId, isCustom, addingExercise, addExerciseToCustomWorkout, loadWorkoutDetail, workoutId]);

  const renderExercise = ({ item, index }: { item: ExerciseItem; index: number }) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={item.exercise.name}
      onPress={() => setSelectedExercise(item)}
      style={({ pressed }) => [styles.exerciseRow, pressed && styles.pressed]}
    >
      <View style={styles.exerciseIndex}>
        <AppText variant="body12SemiBold" color={colors.text.secondary}>
          {index + 1}
        </AppText>
      </View>
      <ExerciseIcon
        icon="barbell-outline"
        size={48}
        imageUrl={item.exercise.image_url}
        externalSource={item.exercise.external_source}
        bodyPart={item.exercise.body_part}
        targetMuscle={item.exercise.target_muscles?.[0]}
        onPress={() => setSelectedExercise(item)}
      />
      <View style={styles.exerciseInfo}>
        <AppText variant="body14SemiBold" color={colors.text.primary} numberOfLines={2}>
          {item.exercise.name}
        </AppText>
        <AppText variant="body12" color={colors.text.secondary} numberOfLines={2}>
          {formatExercisePrescription(item)}
        </AppText>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.text.tertiary} />
    </Pressable>
  );

  const renderBody = () => {
    if (detailLoading) {
      return (
        <View style={styles.padded}>
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </View>
      );
    }
    if (detailError) {
      return <ErrorState message={detailError} onRetry={() => void loadWorkoutDetail(workoutId)} />;
    }
    if (!detail) {
      return (
        <EmptyState
          pillar="training"
          hideIllustration
          title={t.training.workout_not_found}
          message={t.training.workout_not_found_message}
          actionLabel={t.training.go_back}
          onAction={() => navigation.goBack()}
        />
      );
    }

    return (
      <FlatList
        data={detail.exercises}
        keyExtractor={(item) => item.id}
        renderItem={renderExercise}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.listContent, { paddingBottom: scrollBottom }]}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={
          <AppText variant="caps12" color={colors.text.tertiary} style={styles.listTitle}>
            {i18n(t.training.exercises_count, { n: detail.exercises.length })}
          </AppText>
        }
        ListEmptyComponent={
          <EmptyState
            pillar="training"
            hideIllustration
            title={t.training.empty_workout_exercises}
            message={isCustom ? t.training.custom_workout_empty_message : t.training.plan_workout_no_add_exercises}
            compact
          />
        }
        ListFooterComponent={
          isCustom ? (
            <Button
              label={t.training.add_exercise}
              icon="add"
              variant="outline"
              onPress={() => setExerciseSheetVisible(true)}
              loading={addingExercise}
              fullWidth
              style={styles.addExerciseBtn}
            />
          ) : null
        }
      />
    );
  };

  return (
    <View style={[styles.flex, { paddingTop: insets.top + spacing.md }]}>
      <View style={styles.header}>
        <IconButton icon="chevron-back" onPress={() => navigation.goBack()} accessibilityLabel={t.training.go_back} />
        <View style={styles.headerTitles}>
          {dayTitle ? (
            <AppText variant="caps11" color={colors.text.tertiary} numberOfLines={1}>
              {dayTitle}
            </AppText>
          ) : null}
          <AppText variant="h3" color={colors.text.primary} numberOfLines={2}>
            {detail?.title ?? t.training.program}
          </AppText>
          {detail ? (
            <View style={styles.headerMeta}>
              <AppText variant="caps11" color={colors.text.tertiary}>
                {isCustom ? t.training.custom_workout_badge : t.training.trainer_plan_badge}
              </AppText>
              {headerMetaLine ? (
                <AppText variant="body12" color={colors.text.secondary} numberOfLines={1}>
                  {headerMetaLine}
                </AppText>
              ) : null}
              {detail.notes ? (
                <AppText variant="body12" color={colors.text.tertiary} numberOfLines={2}>
                  {detail.notes}
                </AppText>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.flex}>{renderBody()}</View>

      {detail ? (
        <View style={[styles.footer, { bottom: footerBottom }]}>
          <Button
            label={isResume ? t.training.continue_workout : t.training.start_workout}
            icon="play"
            variant="outline"
            onPress={handleStart}
            loading={starting}
            fullWidth
          />
        </View>
      ) : null}

      <ExercisePreviewSheet
        visible={selectedExercise !== null}
        onClose={() => setSelectedExercise(null)}
        exerciseId={selectedExercise?.exercise.id ?? null}
        subtitle={selectedExercise ? formatExercisePrescription(selectedExercise) : undefined}
        fallback={
          selectedExercise
            ? {
                name: selectedExercise.exercise.name,
                image_url: selectedExercise.exercise.image_url,
              }
            : undefined
        }
      />

      <ExerciseSearchSheet
        visible={exerciseSheetVisible}
        onClose={() => setExerciseSheetVisible(false)}
        onPick={(exercise) => void handleAddExercise(exercise)}
      />
    </View>
  );
}

const createStyles = (colors: Colors) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  padded: { paddingHorizontal: layout.screenPadding },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: layout.screenPadding,
    marginBottom: spacing.sm,
  },
  headerTitles: { flex: 1, gap: spacing.xxs },
  headerMeta: { gap: 2, marginTop: spacing.xxs },
  listTitle: { marginBottom: spacing.xxs },
  addExerciseBtn: { marginTop: spacing.md },
  listContent: {
    paddingHorizontal: layout.screenPadding,
  },
  separator: { height: spacing.xs },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface.base,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.subtle,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  exerciseIndex: {
    width: 20,
    alignItems: 'center',
  },
  pressed: { opacity: 0.8 },
  exerciseImage: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.surface.elevated,
  },
  exercisePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  exerciseInfo: { flex: 1 },
  footer: {
    position: 'absolute',
    left: layout.screenPadding,
    right: layout.screenPadding,
  },
  sheetScroll: { maxHeight: 460 },
  sheetImage: {
    width: '100%',
    height: 180,
    borderRadius: radius.lg,
    backgroundColor: colors.surface.elevated,
    marginBottom: spacing.md,
  },
  prescriptionCard: {
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  sheetSection: { marginBottom: spacing.md },
  sheetLabel: { marginBottom: spacing.xs },
  instructionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  instructionNumber: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
      backgroundColor: colors.surface.elevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  instructionText: { flex: 1 },
});
