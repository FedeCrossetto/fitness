import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { layout, radius, spacing, Colors, useThemedStyles, useTheme } from '../../theme';
import {
  AppText,
  BottomSheet,
  Button,
  Card,
  CardSkeleton,
  Chip,
  EmptyState,
  ErrorState,
  IconButton,
} from '../../components/common';
import { formatExercisePrescription } from '../../lib/trainingExercise';
import { useAuthStore } from '../../stores/authStore';
import { useTranslation } from '../../stores/i18nStore';
import { useTrainingStore, type WorkoutWithExercises } from '../../stores/trainingStore';
import { DAY_TYPE_META } from './trainingMeta';
import { ExerciseIcon } from '../../components/training/ExerciseIcon';
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
  const activeSession = useTrainingStore((s) => s.activeSession);
  const startSession = useTrainingStore((s) => s.startSession);
  const discardSession = useTrainingStore((s) => s.discardSession);

  const [selectedExercise, setSelectedExercise] = useState<ExerciseItem | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    void loadWorkoutDetail(workoutId);
  }, [workoutId, loadWorkoutDetail]);

  const detail = workoutDetail?.id === workoutId ? workoutDetail : null;
  const isResume = activeSession?.workoutId === workoutId;

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

  const renderExercise = ({ item, index }: { item: ExerciseItem; index: number }) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={item.exercise.name}
      onPress={() => setSelectedExercise(item)}
      style={({ pressed }) => [styles.exerciseRow, pressed && styles.pressed]}
    >
      <View style={styles.exerciseIndex}>
        <AppText variant="body12SemiBold" color={colors.primary.default}>
          {index + 1}
        </AppText>
      </View>
      <ExerciseIcon icon="barbell-outline" size={44} />
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

    const typeMeta = DAY_TYPE_META[detail.workout_type];
    const blocksLabel = detail.blocks === 1
      ? i18n(t.training.blocks_label, { n: 1 })
      : i18n(t.training.blocks_label_plural, { n: detail.blocks });

    return (
      <FlatList
        data={detail.exercises}
        keyExtractor={(item) => item.id}
        renderItem={renderExercise}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.listContent, { paddingBottom: scrollBottom }]}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={
          <View style={styles.metaWrap}>
            <Card elevated style={styles.heroCard}>
              <View style={styles.heroContent}>
                <ExerciseIcon icon={typeMeta.icon} size={48} />
                <View style={styles.heroChips}>
                  <Chip label={typeMeta.label} active />
                  <View style={styles.chipsRow}>
                    {detail.duration_min != null ? (
                      <Chip label={i18n(t.training.duration_min, { n: detail.duration_min })} />
                    ) : null}
                    <Chip label={blocksLabel} />
                    {detail.calories_est != null ? (
                      <Chip label={i18n(t.training.calories_est, { n: detail.calories_est })} />
                    ) : null}
                  </View>
                  {detail.notes ? (
                    <AppText variant="body13" color={colors.text.secondary} style={styles.notes}>
                      {detail.notes}
                    </AppText>
                  ) : null}
                </View>
              </View>
            </Card>
            <AppText variant="caps12" color={colors.text.tertiary} style={styles.listTitle}>
              {i18n(t.training.exercises_count, { n: detail.exercises.length })}
            </AppText>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            pillar="training"
            hideIllustration
            title={t.training.empty_workout_exercises}
            message={t.training.empty_workout_exercises_message}
            compact
          />
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
          <AppText variant="h3" color={colors.text.primary} numberOfLines={1}>
            {detail?.title ?? t.training.program}
          </AppText>
        </View>
      </View>

      <View style={styles.flex}>{renderBody()}</View>

      {detail ? (
        <View style={[styles.footer, { bottom: footerBottom }]}>
          <Button
            label={isResume ? t.training.continue_workout : t.training.start_workout}
            icon="play"
            onPress={handleStart}
            loading={starting}
            fullWidth
          />
        </View>
      ) : null}

      <BottomSheet
        visible={selectedExercise !== null}
        onClose={() => setSelectedExercise(null)}
        title={selectedExercise?.exercise.name}
      >
        {selectedExercise ? (
          <ScrollView style={styles.sheetScroll} showsVerticalScrollIndicator={false}>
            <Card style={styles.prescriptionCard}>
              <AppText variant="body14SemiBold" color={colors.text.primary}>
                {formatExercisePrescription(selectedExercise)}
              </AppText>
            </Card>

            {(
              [
                { title: t.training.target_muscles, items: selectedExercise.exercise.target_muscles },
                { title: t.training.secondary_muscles, items: selectedExercise.exercise.secondary_muscles },
                { title: t.training.equipment, items: selectedExercise.exercise.equipment },
              ] as const
            ).map((section) =>
              section.items && section.items.length > 0 ? (
                <View key={section.title} style={styles.sheetSection}>
                  <AppText variant="caps12" color={colors.text.tertiary} style={styles.sheetLabel}>
                    {section.title}
                  </AppText>
                  <View style={styles.chipsRow}>
                    {section.items.map((it) => (
                      <Chip key={it} label={it} />
                    ))}
                  </View>
                </View>
              ) : null,
            )}

            {selectedExercise.exercise.instructions && selectedExercise.exercise.instructions.length > 0 ? (
              <View style={styles.sheetSection}>
                <AppText variant="caps12" color={colors.text.tertiary} style={styles.sheetLabel}>
                  {t.training.instructions}
                </AppText>
                {selectedExercise.exercise.instructions.map((step, index) => (
                  <View key={`${index}-${step.slice(0, 12)}`} style={styles.instructionRow}>
                    <View style={styles.instructionNumber}>
                      <AppText variant="body12SemiBold" color={colors.primary.default}>
                        {index + 1}
                      </AppText>
                    </View>
                    <AppText variant="body14" color={colors.text.secondary} style={styles.instructionText}>
                      {step}
                    </AppText>
                  </View>
                ))}
              </View>
            ) : null}
          </ScrollView>
        ) : (
          <View />
        )}
      </BottomSheet>
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
    marginBottom: spacing.md,
  },
  headerTitles: { flex: 1 },
  metaWrap: { marginBottom: spacing.md },
  heroCard: {
    padding: 0,
    marginBottom: spacing.md,
  },
  heroContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.md,
    gap: spacing.md,
  },
  heroChips: { flex: 1, gap: spacing.sm },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  notes: { marginTop: spacing.xxs },
  listTitle: { marginTop: spacing.xs },
  listContent: {
    paddingHorizontal: layout.screenPadding,
  },
  separator: { height: spacing.xs },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface.base,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    padding: spacing.sm,
  },
  exerciseIndex: {
    width: 24,
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
    backgroundColor: colors.primary.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  instructionText: { flex: 1 },
});
