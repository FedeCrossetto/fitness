import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Image, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppText } from '../../components/common';
import { ExercisePreviewSheet } from '../../components/training/ExercisePreviewSheet';
import { hapticMedium, hapticSuccess, hapticTap } from '../../lib/haptics';
import { useAuthStore } from '../../stores/authStore';
import { useTranslation } from '../../stores/i18nStore';
import { useTrainingStore } from '../../stores/trainingStore';
import { buildIntervalTimeline, formatClock, type IntervalSegment } from '../../lib/trainingIntervals';
import type { TrainingStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<TrainingStackParamList, 'IntervalSession'>;

// Paleta inmersiva del player (independiente del tema de la app), estilo
// "METODO R3SET": fondo negro + acento lima + secundario cyan.
const C = {
  bg: '#0e0e0e',
  lime: '#D1FF26',
  cyan: '#00e3fd',
  surface: '#1a1a1a',
  surfaceLow: '#131313',
  surfaceLowest: '#000000',
  text: '#ffffff',
  muted: 'rgba(255,255,255,0.4)',
  faint: 'rgba(255,255,255,0.1)',
};

function segStart(index: number, cumulativeMs: number[]): number {
  return index <= 0 ? 0 : (cumulativeMs[index - 1] ?? 0);
}

export function IntervalSessionScreen({ navigation, route }: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { height: winHeight } = useWindowDimensions();
  const nextCardHeight = Math.round(winHeight * 0.15);
  const { workoutId, workoutTitle } = route.params;

  const workoutDetail = useTrainingStore((s) => s.workoutDetail);
  const loadWorkoutDetail = useTrainingStore((s) => s.loadWorkoutDetail);
  const logIntervalWorkout = useTrainingStore((s) => s.logIntervalWorkout);
  const activeInterval = useTrainingStore((s) => s.activeIntervalSession);
  const startIntervalSession = useTrainingStore((s) => s.startIntervalSession);
  const updateIntervalSession = useTrainingStore((s) => s.updateIntervalSession);
  const discardIntervalSession = useTrainingStore((s) => s.discardIntervalSession);
  const userId = useAuthStore((s) => s.session?.user.id);
  const { language } = useTranslation();

  useEffect(() => {
    if (workoutDetail?.id !== workoutId) void loadWorkoutDetail(workoutId);
  }, [workoutId, workoutDetail?.id, loadWorkoutDetail]);

  // Arranca la sesión en el store una sola vez por rutina — si ya había una
  // activa para este mismo workoutId (venimos de minimizarla), la retoma tal
  // cual en vez de resetear el reloj.
  useEffect(() => {
    const current = useTrainingStore.getState().activeIntervalSession;
    if (!current || current.workoutId !== workoutId) {
      startIntervalSession(workoutId, workoutTitle ?? '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workoutId]);

  const detail = workoutDetail?.id === workoutId ? workoutDetail : null;
  const timeline = useMemo<IntervalSegment[]>(() => (detail ? buildIntervalTimeline(detail.exercises, language) : []), [detail, language]);
  const cumulativeMs = useMemo(() => {
    const arr: number[] = [];
    let sum = 0;
    for (const seg of timeline) { sum += seg.seconds * 1000; arr.push(sum); }
    return arr;
  }, [timeline]);
  const totalMs = cumulativeMs[cumulativeMs.length - 1] ?? 0;
  const totalSeconds = Math.round(totalMs / 1000);

  // Ejercicio (actual o siguiente) tocado para ver su detalle/video en grande.
  const [previewSegment, setPreviewSegment] = useState<IntervalSegment | null>(null);

  const paused = activeInterval?.paused ?? false;

  // Reloj basado en timestamps reales, guardado en el store (no en refs
  // locales) — así sigue corriendo si el usuario minimiza esta pantalla, y
  // se recalcula solo al volver del background (setInterval se suspende ahí).
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setNowMs(Date.now()), 250);
    return () => clearInterval(id);
  }, [paused]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => { if (state === 'active') setNowMs(Date.now()); });
    return () => sub.remove();
  }, []);

  const elapsedMs = activeInterval
    ? (paused ? activeInterval.pausedElapsedMs : Math.max(0, nowMs - activeInterval.startedAt))
    : 0;

  let segIndex = 0;
  while (segIndex < timeline.length && (cumulativeMs[segIndex] ?? 0) <= elapsedMs) segIndex++;
  const finished = timeline.length > 0 && elapsedMs >= totalMs;
  const current = finished ? null : timeline[segIndex] ?? null;
  const next = finished ? null : timeline[segIndex + 1] ?? null;
  const remaining = current ? Math.max(0, Math.ceil(((cumulativeMs[segIndex] ?? 0) - elapsedMs) / 1000)) : 0;
  const elapsedSeconds = Math.min(totalSeconds, Math.floor(elapsedMs / 1000));
  const completionPct = totalSeconds > 0 ? Math.round((elapsedSeconds / totalSeconds) * 100) : 0;
  const curSegStartMs = segStart(segIndex, cumulativeMs);
  const segProgress = current ? Math.min(1, (elapsedMs - curSegStartMs) / (current.seconds * 1000 || 1)) : 0;
  const isRest = current?.kind === 'rest';

  const completedNow = useMemo(() => {
    const upTo = finished ? timeline.length : segIndex;
    const ids = new Set<string>();
    for (let i = 0; i < upTo; i++) {
      const seg = timeline[i];
      if (seg?.kind === 'exercise' && seg.exerciseId) ids.add(seg.exerciseId);
    }
    return Array.from(ids);
  }, [timeline, segIndex, finished]);

  const jumpToMs = (targetMs: number) => {
    const clamped = Math.max(0, Math.min(totalMs, targetMs));
    if (paused) updateIntervalSession({ pausedElapsedMs: clamped });
    else updateIntervalSession({ startedAt: Date.now() - clamped });
    setNowMs(Date.now());
  };

  const handleBack = () => { jumpToMs(segStart(Math.max(0, segIndex - 1), cumulativeMs)); hapticMedium(); };
  const handleNext = () => {
    if (segIndex + 1 >= timeline.length) { jumpToMs(totalMs); hapticSuccess(); return; }
    jumpToMs(segStart(segIndex + 1, cumulativeMs));
    hapticMedium();
  };
  const togglePause = () => {
    if (paused) updateIntervalSession({ startedAt: Date.now() - (activeInterval?.pausedElapsedMs ?? 0), paused: false });
    else updateIntervalSession({ pausedElapsedMs: elapsedMs, paused: true });
  };

  // Minimizar: vuelve a la pantalla anterior SIN descartar la sesión — sigue
  // corriendo en el store y se puede retomar desde el banner (Inicio/Entreno).
  const minimize = () => { hapticTap(); navigation.goBack(); };

  // Al terminar (naturalmente), registra el entreno una sola vez.
  const loggedRef = useRef(false);
  useEffect(() => {
    if (finished && !loggedRef.current && userId && detail) {
      loggedRef.current = true;
      void logIntervalWorkout(userId, {
        workoutId: detail.id,
        workoutName: detail.title,
        workoutType: detail.workout_type,
        durationSeconds: totalSeconds,
        completedExercises: completedNow,
      });
      void discardIntervalSession();
    }
  }, [finished, userId, detail, totalSeconds, completedNow, logIntervalWorkout, discardIntervalSession]);

  const confirmStop = () => {
    Alert.alert(
      'Detener entreno',
      'Se va a guardar tu progreso hasta acá.',
      [
        { text: 'Seguir', style: 'cancel' },
        {
          text: 'Detener y guardar',
          style: 'destructive',
          onPress: () => {
            if (userId && detail && !loggedRef.current) {
              loggedRef.current = true;
              void logIntervalWorkout(userId, {
                workoutId: detail.id,
                workoutName: detail.title,
                workoutType: detail.workout_type,
                durationSeconds: elapsedSeconds,
                completedExercises: completedNow,
              });
            }
            void discardIntervalSession();
            navigation.goBack();
          },
        },
      ],
    );
  };

  if (!detail) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color={C.lime} />
      </View>
    );
  }

  if (timeline.length === 0) {
    return (
      <View style={[styles.screen, styles.center, { padding: 24 }]}>
        <AppText style={styles.emptyText}>Esta rutina no tiene ejercicios todavía.</AppText>
        <Pressable style={styles.emptyBtn} onPress={() => { void discardIntervalSession(); navigation.goBack(); }}>
          <AppText style={styles.emptyBtnText}>Volver</AppText>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingBottom: insets.bottom }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <Pressable hitSlop={12} onPress={minimize}>
          <Ionicons name="chevron-down" size={26} color={C.lime} />
        </Pressable>
        <AppText style={styles.brand} numberOfLines={1}>{workoutTitle?.toUpperCase() || 'METODO R3SET'}</AppText>
        <Ionicons name="tv-outline" size={20} color={C.muted} />
      </View>

      {finished ? (
        <View style={[styles.center, { flex: 1, padding: 24 }]}>
          <Ionicons name="checkmark-circle" size={64} color={C.lime} />
          <AppText style={styles.doneTitle}>¡Completado!</AppText>
          <AppText style={styles.doneSub}>{formatClock(totalSeconds)} de trabajo · guardado en tu historial</AppText>
          <Pressable style={styles.emptyBtn} onPress={() => navigation.goBack()}>
            <AppText style={styles.emptyBtnText}>Finalizar</AppText>
          </Pressable>
        </View>
      ) : (
        <View style={styles.content}>
          {/* Ejercicio actual */}
          <View style={styles.titleBlock}>
            <AppText style={styles.eyebrow}>{isRest ? 'DESCANSO' : 'EJERCICIO ACTUAL'}</AppText>
            <AppText style={styles.exName} numberOfLines={2}>{current?.name.toUpperCase()}</AppText>
            {current?.roundLabel ? (
              <View style={styles.chip}><AppText style={styles.chipText}>{current.roundLabel}</AppText></View>
            ) : null}
          </View>

          {/* Imagen / canvas — tocar abre el detalle (y video, si lo tiene). */}
          <Pressable
            style={styles.canvas}
            disabled={!current || current.kind !== 'exercise'}
            onPress={() => current && setPreviewSegment(current)}
          >
            {current?.imageUrl ? (
              <Image source={{ uri: current.imageUrl }} style={styles.canvasImg} resizeMode="cover" />
            ) : (
              <View style={[styles.canvasImg, styles.center, { backgroundColor: C.surfaceLowest }]}>
                <Ionicons name={isRest ? 'cafe-outline' : 'barbell-outline'} size={40} color={C.faint} />
              </View>
            )}
          </Pressable>

          {/* Progreso general */}
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${completionPct}%` }]} />
          </View>

          {/* Timer grande */}
          <View style={styles.timerCard}>
            <AppText style={styles.timerLabel}>TIEMPO RESTANTE</AppText>
            <AppText style={styles.timerBig}>{formatClock(remaining)}</AppText>
            <View style={styles.segTrackRow}>
              <AppText style={styles.segTrackTime}>00:00</AppText>
              <View style={styles.segTrack}>
                <View style={[styles.segDot, { left: `${Math.min(100, segProgress * 100)}%` }]} />
              </View>
              <AppText style={styles.segTrackTime}>{formatClock(current?.seconds ?? 0)}</AppText>
            </View>
          </View>

          {/* Métricas */}
          <View style={styles.metricsRow}>
            <View style={styles.metricCard}>
              <AppText style={styles.metricLabel}>COMPLETADO</AppText>
              <AppText style={styles.metricValue}>{formatClock(elapsedSeconds)}</AppText>
            </View>
            <View style={styles.metricCard}>
              <AppText style={styles.metricLabel}>COMPLETION</AppText>
              <AppText style={styles.metricValue}>{completionPct}%</AppText>
            </View>
            <View style={styles.metricCard}>
              <AppText style={styles.metricLabel}>PASO</AppText>
              <AppText style={styles.metricValue}>{segIndex + 1}/{timeline.length}</AppText>
            </View>
          </View>

          {/* Siguiente — ~15% de la pantalla: texto a la izquierda, miniatura a la derecha. */}
          {next ? (
            <View style={[styles.nextCard, { height: nextCardHeight }]}>
              <View style={styles.nextCardText}>
                <View style={styles.nextCardLabelRow}>
                  <Ionicons name={next.kind === 'rest' ? 'cafe-outline' : 'barbell-outline'} size={14} color={C.cyan} />
                  <AppText style={styles.nextLabel}>SIGUIENTE</AppText>
                </View>
                <AppText style={styles.nextCardName} numberOfLines={2}>{next.name.toUpperCase()}</AppText>
              </View>
              <Pressable
                style={styles.nextCardThumb}
                disabled={next.kind !== 'exercise'}
                onPress={() => setPreviewSegment(next)}
              >
                {next.imageUrl ? (
                  <Image source={{ uri: next.imageUrl }} style={styles.nextCardThumbImg} resizeMode="cover" />
                ) : (
                  <Ionicons name={next.kind === 'rest' ? 'cafe-outline' : 'barbell-outline'} size={28} color={C.faint} />
                )}
              </Pressable>
            </View>
          ) : (
            <View style={{ height: nextCardHeight }} />
          )}
        </View>
      )}

      {!finished && (
        <View style={[styles.controls, { paddingBottom: 10 }]}>
          <Control icon="play-back" label="ATRÁS" onPress={handleBack} />
          <Pressable style={styles.primaryBtn} onPress={togglePause}>
            <Ionicons name={paused ? 'play' : 'pause'} size={32} color="#000" />
          </Pressable>
          <Control icon="stop" label="DETENER" color={C.cyan} onPress={confirmStop} />
          <Control icon="play-forward" label="SIGUIENTE" onPress={handleNext} />
        </View>
      )}

      <ExercisePreviewSheet
        visible={previewSegment !== null}
        onClose={() => setPreviewSegment(null)}
        exerciseId={previewSegment?.exerciseId ?? null}
        fallback={previewSegment ? { name: previewSegment.name, image_url: previewSegment.imageUrl } : undefined}
      />
    </View>
  );
}

function Control({ icon, label, onPress, color }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; color?: string }): React.JSX.Element {
  return (
    <Pressable style={styles.control} onPress={onPress} hitSlop={8}>
      <Ionicons name={icon} size={24} color={color ?? C.muted} />
      <AppText style={[styles.controlLabel, color ? { color } : null]}>{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 10, gap: 10,
  },
  brand: { flex: 1, textAlign: 'center', color: C.lime, fontSize: 15, lineHeight: 19, fontWeight: '800', letterSpacing: 0.5 },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 4, paddingBottom: 12, gap: 12 },
  titleBlock: { gap: 4 },
  eyebrow: { color: C.lime, fontSize: 10, lineHeight: 13, fontWeight: '800', letterSpacing: 2 },
  exName: { color: C.text, fontSize: 22, lineHeight: 25, fontWeight: '800' },
  chip: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, marginTop: 4 },
  chipText: { color: 'rgba(255,255,255,0.7)', fontSize: 10, lineHeight: 13, fontWeight: '700', letterSpacing: 0.5 },
  canvas: { width: '100%', height: 130, backgroundColor: C.surfaceLowest, borderRadius: 12, overflow: 'hidden' },
  canvasImg: { width: '100%', height: '100%' },
  progressTrack: { height: 4, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: C.lime },
  timerCard: {
    backgroundColor: C.surfaceLow, borderRadius: 14,
    paddingVertical: 14, alignItems: 'center', borderLeftWidth: 4, borderLeftColor: C.lime,
  },
  timerLabel: { color: C.muted, fontSize: 10, lineHeight: 13, fontWeight: '700', letterSpacing: 3, marginBottom: 4 },
  timerBig: { color: C.lime, fontSize: 48, lineHeight: 54, fontWeight: '800', letterSpacing: 0, fontVariant: ['tabular-nums'] },
  segTrackRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', paddingHorizontal: 20, marginTop: 10 },
  segTrackTime: { color: 'rgba(255,255,255,0.25)', fontSize: 10, lineHeight: 13 },
  segTrack: { flex: 1, height: 2, backgroundColor: 'rgba(255,255,255,0.1)', marginHorizontal: 12, position: 'relative' },
  segDot: { position: 'absolute', top: -3, width: 8, height: 8, borderRadius: 4, backgroundColor: C.lime, marginLeft: -4 },
  metricsRow: { flexDirection: 'row', gap: 10 },
  metricCard: { flex: 1, backgroundColor: C.surface, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 10, alignItems: 'center' },
  metricLabel: { color: C.muted, fontSize: 9, lineHeight: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 4 },
  metricValue: { color: C.text, fontSize: 18, lineHeight: 22, fontWeight: '800', fontVariant: ['tabular-nums'] },
  nextCard: {
    flexDirection: 'row', alignItems: 'stretch', gap: 12,
    padding: 10, borderRadius: 14,
    backgroundColor: 'rgba(38,38,38,0.5)',
  },
  nextCardText: { flex: 1, justifyContent: 'center', gap: 4 },
  nextCardLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  nextLabel: { color: C.cyan, fontSize: 10, lineHeight: 13, fontWeight: '700', letterSpacing: 1.5 },
  nextCardName: { color: C.text, fontSize: 16, lineHeight: 20, fontWeight: '800' },
  nextCardThumb: {
    aspectRatio: 1, borderRadius: 10, overflow: 'hidden',
    backgroundColor: C.surfaceLowest, alignItems: 'center', justifyContent: 'center',
  },
  nextCardThumbImg: { width: '100%', height: '100%' },
  controls: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
    paddingHorizontal: 16, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
  },
  control: { alignItems: 'center', gap: 3 },
  controlLabel: { color: C.muted, fontSize: 9, lineHeight: 12, fontWeight: '700', letterSpacing: 1 },
  primaryBtn: {
    width: 58, height: 58, borderRadius: 29, backgroundColor: C.lime,
    alignItems: 'center', justifyContent: 'center', marginTop: -16,
  },
  emptyText: { color: C.text, fontSize: 16, textAlign: 'center', marginBottom: 20 },
  emptyBtn: { backgroundColor: C.lime, borderRadius: 12, paddingHorizontal: 28, paddingVertical: 12, marginTop: 20 },
  emptyBtnText: { color: '#000', fontWeight: '800', fontSize: 15 },
  doneTitle: { color: C.text, fontSize: 24, lineHeight: 29, fontWeight: '800', marginTop: 16 },
  doneSub: { color: C.muted, fontSize: 14, lineHeight: 18, marginTop: 4, textAlign: 'center' },
});
