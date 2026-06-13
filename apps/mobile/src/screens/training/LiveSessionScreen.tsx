import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { layout, radius, spacing, Colors, useThemedStyles, useTheme } from '../../theme';
import { formatDuration } from '../../lib/dates';
import { hapticSelect } from '../../lib/haptics';
import {
  AppText,
  Button,
  Card,
  CardSkeleton,
  Chip,
  EmptyState,
  IconButton,
  Input,
  ProgressBar,
} from '../../components/common';
import { useAuthStore } from '../../stores/authStore';
import { useTrainingStore, type WorkoutWithExercises } from '../../stores/trainingStore';
import { useUiStore } from '../../stores/uiStore';
import type { TrainingStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<TrainingStackParamList, 'LiveSession'>;
type ExerciseItem = WorkoutWithExercises['exercises'][number];

const RPE_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export function LiveSessionScreen({ navigation }: Props): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  const insets = useSafeAreaInsets();

  const session = useAuthStore((s) => s.session);
  const userId = session?.user.id;

  const activeSession = useTrainingStore((s) => s.activeSession);
  const workoutDetail = useTrainingStore((s) => s.workoutDetail);
  const detailLoading = useTrainingStore((s) => s.detailLoading);
  const loadWorkoutDetail = useTrainingStore((s) => s.loadWorkoutDetail);
  const toggleExerciseDone = useTrainingStore((s) => s.toggleExerciseDone);
  const updateSessionMeta = useTrainingStore((s) => s.updateSessionMeta);
  const finishSession = useTrainingStore((s) => s.finishSession);
  const discardSession = useTrainingStore((s) => s.discardSession);

  const [now, setNow] = useState(() => Date.now());
  const [finishing, setFinishing] = useState(false);

  const activeWorkoutId = activeSession?.workoutId;

  useEffect(() => {
    if (!activeWorkoutId) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [activeWorkoutId]);

  useEffect(() => {
    if (activeWorkoutId && workoutDetail?.id !== activeWorkoutId) {
      void loadWorkoutDetail(activeWorkoutId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWorkoutId]);

  const onFinish = useCallback(async () => {
    if (!userId) return;
    setFinishing(true);
    const log = await finishSession(userId);
    if (log) {
      navigation.replace('SessionSummary', { logId: log.id });
    } else {
      setFinishing(false);
      useUiStore.getState().showToast('error', 'No pudimos guardar la sesión. Probá de nuevo.');
    }
  }, [userId, finishSession, navigation]);

  const onDiscard = useCallback(() => {
    Alert.alert('Descartar sesión', '¿Seguro que querés descartar este entrenamiento? No se va a guardar.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Descartar',
        style: 'destructive',
        onPress: () => {
          void discardSession();
          navigation.goBack();
        },
      },
    ]);
  }, [discardSession, navigation]);

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
          title="No hay sesión activa"
          message="Empezá un entrenamiento desde tu programa para verlo acá en vivo."
          actionLabel="Volver"
          onAction={() => navigation.goBack()}
        />
      </View>
    );
  }

  const elapsed = Math.max(0, Math.floor((now - activeSession.startedAt) / 1000));
  const exercises: ExerciseItem[] = workoutDetail?.id === activeSession.workoutId ? workoutDetail.exercises : [];
  const completedCount = exercises.filter((e) => activeSession.completedExerciseIds.includes(e.id)).length;
  const exerciseProgress = exercises.length > 0 ? completedCount / exercises.length : 0;

  const renderExercise = ({ item }: { item: ExerciseItem }) => {
    const done = activeSession.completedExerciseIds.includes(item.id);
    return (
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done }}
        accessibilityLabel={`${item.exercise.name}: ${done ? 'completado' : 'pendiente'}`}
        onPress={() => {
          hapticSelect();
          toggleExerciseDone(item.id);
        }}
        style={({ pressed }) => [styles.exerciseRow, done && styles.exerciseRowDone, pressed && styles.pressed]}
      >
        <View style={[styles.checkCircle, done && styles.checkCircleDone]}>
          {done ? <Ionicons name="checkmark" size={16} color={colors.primary.onText} /> : null}
        </View>
        <View style={styles.exerciseInfo}>
          <AppText
            variant="body14SemiBold"
            color={done ? colors.text.disabled : colors.text.primary}
            style={done ? styles.struck : undefined}
            numberOfLines={2}
          >
            {item.exercise.name}
          </AppText>
          <AppText variant="body12" color={done ? colors.text.disabled : colors.text.secondary}>
            {item.sets} x {item.reps}
            {item.weight_kg != null ? ` · ${item.weight_kg} kg` : ''}
          </AppText>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={[styles.flex, { paddingTop: insets.top + spacing.md }]}>
      <View style={styles.header}>
        <IconButton icon="chevron-back" onPress={() => navigation.goBack()} accessibilityLabel="Volver" />
        <AppText variant="h3" color={colors.text.primary} numberOfLines={1} style={styles.headerTitle}>
          {activeSession.workoutTitle}
        </AppText>
      </View>

      <FlatList
        data={exercises}
        keyExtractor={(item) => item.id}
        renderItem={renderExercise}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={
          <View>
            <View style={styles.timerWrap}>
              <AppText variant="caps12" color={colors.text.tertiary}>
                Tiempo de sesión
              </AppText>
              <AppText variant="metricLarge" color={colors.primary.default}>
                {formatDuration(elapsed)}
              </AppText>
            </View>

            <View style={styles.progressRow}>
              <ProgressBar progress={exerciseProgress} style={styles.progressBar} />
              <AppText variant="body12Medium" color={colors.text.tertiary}>
                {completedCount}/{exercises.length}
              </AppText>
            </View>

            <AppText variant="caps12" color={colors.text.tertiary} style={styles.sectionLabel}>
              Ejercicios
            </AppText>
          </View>
        }
        ListEmptyComponent={
          detailLoading ? (
            <View>
              <CardSkeleton />
              <CardSkeleton />
            </View>
          ) : (
            <EmptyState
              pillar="training"
              title="Sin ejercicios"
              message="No pudimos cargar los ejercicios, pero tu sesión sigue corriendo."
              compact
            />
          )
        }
        ListFooterComponent={
          <View style={styles.footerWrap}>
            <Card style={styles.metaCard}>
              <AppText variant="caps12" color={colors.text.tertiary} style={styles.metaLabel}>
                RPE · Esfuerzo percibido
              </AppText>
              <View style={styles.rpeRow}>
                {RPE_VALUES.map((value) => (
                  <Chip
                    key={value}
                    label={String(value)}
                    active={activeSession.rpe === value}
                    onPress={() => updateSessionMeta({ rpe: activeSession.rpe === value ? null : value })}
                  />
                ))}
              </View>
            </Card>

            <Card style={styles.metaCard}>
              <Input
                label="Notas"
                placeholder="¿Cómo te sentiste? ¿Algo para tu coach?"
                multiline
                numberOfLines={3}
                value={activeSession.notes}
                onChangeText={(text) => updateSessionMeta({ notes: text })}
              />
              <View style={styles.inputsRow}>
                <Input
                  label="FC media (bpm)"
                  placeholder="—"
                  keyboardType="number-pad"
                  value={activeSession.heartRate != null ? String(activeSession.heartRate) : ''}
                  onChangeText={(text) => {
                    const value = parseInt(text, 10);
                    updateSessionMeta({ heartRate: Number.isFinite(value) ? value : null });
                  }}
                  containerStyle={styles.inputHalf}
                />
                <Input
                  label="Calorías"
                  placeholder="—"
                  keyboardType="number-pad"
                  value={activeSession.calories != null ? String(activeSession.calories) : ''}
                  onChangeText={(text) => {
                    const value = parseInt(text, 10);
                    updateSessionMeta({ calories: Number.isFinite(value) ? value : null });
                  }}
                  containerStyle={styles.inputHalf}
                />
              </View>
            </Card>

            <Button
              label="Finalizar entrenamiento"
              icon="checkmark-circle-outline"
              onPress={() => void onFinish()}
              loading={finishing}
              fullWidth
            />
            <Button label="Descartar" variant="ghost" size="md" onPress={onDiscard} fullWidth style={styles.discard} />
          </View>
        }
      />
    </View>
  );
}

const createStyles = (colors: Colors) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  center: { justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: layout.screenPadding,
    marginBottom: spacing.sm,
  },
  headerTitle: { flex: 1 },
  listContent: {
    paddingHorizontal: layout.screenPadding,
    paddingBottom: layout.tabBarHeight + spacing.xxl,
  },
  timerWrap: { alignItems: 'center', marginVertical: spacing.md },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  progressBar: { flex: 1 },
  sectionLabel: { marginBottom: spacing.sm },
  separator: { height: spacing.xs },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface.base,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    padding: spacing.md,
    minHeight: layout.minHitTarget,
  },
  exerciseRowDone: { opacity: 0.75 },
  pressed: { opacity: 0.8 },
  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.border.strong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleDone: {
    backgroundColor: colors.primary.default,
    borderColor: colors.primary.default,
  },
  exerciseInfo: { flex: 1 },
  struck: { textDecorationLine: 'line-through' },
  footerWrap: { marginTop: spacing.lg },
  metaCard: { marginBottom: spacing.md },
  metaLabel: { marginBottom: spacing.sm },
  rpeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  inputsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  inputHalf: { flex: 1 },
  discard: { marginTop: spacing.xs },
});
