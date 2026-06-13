import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { layout, radius, spacing, Colors, useThemedStyles, useTheme } from '../../theme';
import {
  AppText,
  BottomSheet,
  Button,
  CardSkeleton,
  Chip,
  EmptyState,
  ErrorState,
  IconButton,
} from '../../components/common';
import { useTrainingStore, type WorkoutWithExercises } from '../../stores/trainingStore';
import { DAY_TYPE_META } from './trainingMeta';
import type { TrainingStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<TrainingStackParamList, 'WorkoutDetail'>;
type ExerciseItem = WorkoutWithExercises['exercises'][number];

export function WorkoutDetailScreen({ navigation, route }: Props): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  const { workoutId, dayTitle } = route.params;
  const insets = useSafeAreaInsets();

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
    if (!detail) return;
    setStarting(true);
    if (useTrainingStore.getState().activeSession) await discardSession();
    await startSession(detail.id, detail.title);
    setStarting(false);
    navigation.navigate('LiveSession', { workoutId: detail.id, workoutTitle: detail.title });
  }, [detail, discardSession, startSession, navigation]);

  const handleStart = useCallback(() => {
    if (!detail) return;
    if (isResume) {
      navigation.navigate('LiveSession', { workoutId: detail.id, workoutTitle: detail.title });
      return;
    }
    if (activeSession) {
      Alert.alert(
        'Sesión en curso',
        `Ya tenés "${activeSession.workoutTitle}" en curso. ¿Querés descartarla y empezar esta rutina?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Descartar y empezar', style: 'destructive', onPress: () => void begin() },
        ]
      );
      return;
    }
    void begin();
  }, [detail, isResume, activeSession, begin, navigation]);

  const renderExercise = ({ item }: { item: ExerciseItem }) => {
    const detailParts: string[] = [`${item.sets} x ${item.reps}`];
    if (item.weight_kg != null) detailParts.push(`${item.weight_kg} kg`);
    if (item.tempo) detailParts.push(`Tempo ${item.tempo}`);
    if (item.rest_seconds != null) detailParts.push(`Descanso ${item.rest_seconds}s`);

    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Ver detalle de ${item.exercise.name}`}
        onPress={() => setSelectedExercise(item)}
        style={({ pressed }) => [styles.exerciseRow, pressed && styles.pressed]}
      >
        {item.exercise.image_url ? (
          <Image source={{ uri: item.exercise.image_url }} style={styles.exerciseImage} contentFit="cover" />
        ) : (
          <View style={[styles.exerciseImage, styles.exercisePlaceholder]}>
            <Ionicons name="barbell-outline" size={22} color={colors.text.tertiary} />
          </View>
        )}
        <View style={styles.exerciseInfo}>
          <AppText variant="body14SemiBold" color={colors.text.primary} numberOfLines={2}>
            {item.exercise.name}
          </AppText>
          <AppText variant="body12" color={colors.text.secondary} numberOfLines={2}>
            {detailParts.join(' · ')}
          </AppText>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.text.tertiary} />
      </Pressable>
    );
  };

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
          title="Rutina no disponible"
          message="No encontramos esta rutina. Volvé al programa e intentá de nuevo."
          actionLabel="Volver"
          onAction={() => navigation.goBack()}
        />
      );
    }

    const typeMeta = DAY_TYPE_META[detail.workout_type];

    return (
      <FlatList
        data={detail.exercises}
        keyExtractor={(item) => item.id}
        renderItem={renderExercise}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={
          <View style={styles.metaWrap}>
            <View style={styles.chipsRow}>
              <Chip label={typeMeta.label} active />
              {detail.duration_min != null ? <Chip label={`${detail.duration_min} min`} /> : null}
              <Chip label={`${detail.blocks} ${detail.blocks === 1 ? 'bloque' : 'bloques'}`} />
              {detail.calories_est != null ? <Chip label={`~${detail.calories_est} kcal`} /> : null}
            </View>
            {detail.notes ? (
              <AppText variant="body13" color={colors.text.secondary} style={styles.notes}>
                {detail.notes}
              </AppText>
            ) : null}
            <AppText variant="caps12" color={colors.text.tertiary} style={styles.listTitle}>
              Ejercicios ({detail.exercises.length})
            </AppText>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            pillar="training"
            title="Sin ejercicios"
            message="Esta rutina todavía no tiene ejercicios cargados."
            compact
          />
        }
      />
    );
  };

  return (
    <View style={[styles.flex, { paddingTop: insets.top + spacing.md }]}>
      <View style={styles.header}>
        <IconButton icon="chevron-back" onPress={() => navigation.goBack()} accessibilityLabel="Volver" />
        <View style={styles.headerTitles}>
          {dayTitle ? (
            <AppText variant="caps11" color={colors.text.tertiary} numberOfLines={1}>
              {dayTitle}
            </AppText>
          ) : null}
          <AppText variant="h3" color={colors.text.primary} numberOfLines={1}>
            {detail?.title ?? 'Rutina'}
          </AppText>
        </View>
      </View>

      <View style={styles.flex}>{renderBody()}</View>

      {detail ? (
        <View style={[styles.footer, { bottom: layout.tabBarHeight + spacing.md }]}>
          <Button
            label={isResume ? 'Continuar entrenamiento' : 'Empezar entrenamiento'}
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
            {selectedExercise.exercise.image_url ? (
              <Image
                source={{ uri: selectedExercise.exercise.image_url }}
                style={styles.sheetImage}
                contentFit="cover"
              />
            ) : null}

            {(
              [
                { title: 'Músculos principales', items: selectedExercise.exercise.target_muscles },
                { title: 'Músculos secundarios', items: selectedExercise.exercise.secondary_muscles },
                { title: 'Equipamiento', items: selectedExercise.exercise.equipment },
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
              ) : null
            )}

            {selectedExercise.exercise.instructions && selectedExercise.exercise.instructions.length > 0 ? (
              <View style={styles.sheetSection}>
                <AppText variant="caps12" color={colors.text.tertiary} style={styles.sheetLabel}>
                  Instrucciones
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
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  notes: { marginTop: spacing.sm },
  listTitle: { marginTop: spacing.lg },
  listContent: {
    paddingHorizontal: layout.screenPadding,
    paddingBottom: layout.tabBarHeight + spacing.xxl + 72,
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
  pressed: { opacity: 0.8 },
  exerciseImage: {
    width: 56,
    height: 56,
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
