import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppText } from '../../components/common';
import { hapticMedium, hapticSuccess } from '../../lib/haptics';
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

/** Devuelve el índice del primer segmento cuyo `cumulativeMs[i]` (fin) es
 * mayor al tiempo transcurrido — es decir, el segmento en curso. */
function segStart(index: number, cumulativeMs: number[]): number {
  return index <= 0 ? 0 : (cumulativeMs[index - 1] ?? 0);
}

export function IntervalSessionScreen({ navigation, route }: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { workoutId, workoutTitle } = route.params;

  const workoutDetail = useTrainingStore((s) => s.workoutDetail);
  const loadWorkoutDetail = useTrainingStore((s) => s.loadWorkoutDetail);
  const logIntervalWorkout = useTrainingStore((s) => s.logIntervalWorkout);
  const userId = useAuthStore((s) => s.session?.user.id);
  const { language } = useTranslation();

  useEffect(() => {
    if (workoutDetail?.id !== workoutId) void loadWorkoutDetail(workoutId);
  }, [workoutId, workoutDetail?.id, loadWorkoutDetail]);

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

  // Reloj basado en timestamps reales (no en un contador que se decrementa):
  // así el progreso sigue siendo correcto aunque la app quede en background
  // (donde los setInterval de JS se suspenden) — al volver, se recalcula todo
  // a partir de Date.now() en vez de quedar "congelado" o perder tiempo.
  const startedAtRef = useRef<number | null>(null);
  const pausedElapsedRef = useRef(0);
  const [paused, setPaused] = useState(false);
  const [, forceTick] = useState(0);

  // Arranca el reloj una sola vez por rutina, apenas el timeline está listo.
  useEffect(() => {
    if (timeline.length > 0 && startedAtRef.current == null) {
      startedAtRef.current = Date.now();
      pausedElapsedRef.current = 0;
      setPaused(false);
    }
  }, [timeline.length]);

  // Fuerza un re-render cada 250ms (mientras no está en pausa) para que el
  // contador se vea andar; y también al volver del background, para reflejar
  // de inmediato el tiempo real transcurrido.
  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => forceTick((t) => t + 1), 250);
    return () => clearInterval(id);
  }, [paused]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') forceTick((t) => t + 1);
    });
    return () => sub.remove();
  }, []);

  const elapsedMs = paused
    ? pausedElapsedRef.current
    : startedAtRef.current != null
      ? Math.max(0, Date.now() - startedAtRef.current)
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

  // Ejercicios cuyo segmento ya se completó del todo (para registrar el entreno).
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
    if (paused) pausedElapsedRef.current = clamped;
    else startedAtRef.current = Date.now() - clamped;
    forceTick((t) => t + 1);
  };

  const handleBack = () => { jumpToMs(segStart(Math.max(0, segIndex - 1), cumulativeMs)); hapticMedium(); };
  const handleNext = () => {
    if (segIndex + 1 >= timeline.length) { jumpToMs(totalMs); hapticSuccess(); return; }
    jumpToMs(segStart(segIndex + 1, cumulativeMs));
    hapticMedium();
  };
  const togglePause = () => {
    if (paused) { startedAtRef.current = Date.now() - pausedElapsedRef.current; setPaused(false); }
    else { pausedElapsedRef.current = elapsedMs; setPaused(true); }
  };

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
    }
  }, [finished, userId, detail, totalSeconds, completedNow, logIntervalWorkout]);

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
        <Pressable style={styles.emptyBtn} onPress={() => navigation.goBack()}>
          <AppText style={styles.emptyBtnText}>Volver</AppText>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable hitSlop={12} onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={26} color={C.lime} />
        </Pressable>
        <AppText style={styles.brand}>{workoutTitle?.toUpperCase() || 'METODO R3SET'}</AppText>
        <Ionicons name="tv-outline" size={22} color={C.muted} />
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
        <>
          <ScrollView contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
            {/* Ejercicio actual */}
            <View style={styles.titleBlock}>
              <AppText style={styles.eyebrow}>{isRest ? 'DESCANSO' : 'EJERCICIO ACTUAL'}</AppText>
              <AppText style={styles.exName}>{current?.name.toUpperCase()}</AppText>
              {current?.roundLabel ? (
                <View style={styles.chipsRow}>
                  <View style={styles.chip}><AppText style={styles.chipText}>{current.roundLabel}</AppText></View>
                </View>
              ) : null}
            </View>

            {/* Imagen / canvas */}
            <View style={styles.canvas}>
              {current?.imageUrl ? (
                <Image source={{ uri: current.imageUrl }} style={styles.canvasImg} resizeMode="cover" />
              ) : (
                <View style={[styles.canvasImg, styles.center, { backgroundColor: C.surfaceLowest }]}>
                  <Ionicons name={isRest ? 'cafe-outline' : 'barbell-outline'} size={48} color={C.faint} />
                </View>
              )}
            </View>

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
                <View style={styles.metricFoot}>
                  <Ionicons name="time-outline" size={14} color={C.cyan} />
                  <AppText style={[styles.metricFootText, { color: C.cyan }]}>LOGRADO</AppText>
                </View>
              </View>
              <View style={styles.metricCard}>
                <AppText style={styles.metricLabel}>COMPLETION</AppText>
                <AppText style={styles.metricValue}>{completionPct}%</AppText>
                <View style={styles.metricFoot}>
                  <Ionicons name="ellipse" size={10} color={C.lime} />
                  <AppText style={[styles.metricFootText, { color: C.lime }]}>{segIndex + 1}/{timeline.length}</AppText>
                </View>
              </View>
            </View>

            {/* Siguiente */}
            {next ? (
              <View style={styles.nextCard}>
                <View style={styles.nextThumb}>
                  {next.imageUrl ? (
                    <Image source={{ uri: next.imageUrl }} style={styles.nextThumbImg} resizeMode="cover" />
                  ) : (
                    <Ionicons name={next.kind === 'rest' ? 'cafe-outline' : 'barbell-outline'} size={20} color={C.muted} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <AppText style={styles.nextLabel}>SIGUIENTE</AppText>
                  <AppText style={styles.nextName}>{next.name.toUpperCase()}</AppText>
                </View>
                <Ionicons name="chevron-forward" size={18} color={C.muted} />
              </View>
            ) : null}
          </ScrollView>

          {/* Controles */}
          <View style={[styles.controls, { paddingBottom: insets.bottom + 12 }]}>
            <Control icon="play-back" label="ATRÁS" onPress={handleBack} />
            <Pressable style={styles.primaryBtn} onPress={togglePause}>
              <Ionicons name={paused ? 'play' : 'pause'} size={34} color="#000" />
            </Pressable>
            <Control icon="stop" label="DETENER" color={C.cyan} onPress={confirmStop} />
            <Control icon="play-forward" label="SIGUIENTE" onPress={handleNext} />
          </View>
        </>
      )}
    </View>
  );
}

function Control({ icon, label, onPress, color }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; color?: string }): React.JSX.Element {
  return (
    <Pressable style={styles.control} onPress={onPress} hitSlop={8}>
      <Ionicons name={icon} size={26} color={color ?? C.muted} />
      <AppText style={[styles.controlLabel, color ? { color } : null]}>{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 12,
  },
  brand: { color: C.lime, fontSize: 17, fontWeight: '800', letterSpacing: 0.5 },
  titleBlock: { paddingHorizontal: 24, paddingTop: 16, gap: 6 },
  eyebrow: { color: C.lime, fontSize: 10, fontWeight: '800', letterSpacing: 2 },
  exName: { color: C.text, fontSize: 30, fontWeight: '800', lineHeight: 32 },
  chipsRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  chip: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 },
  chipText: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  canvas: { width: '100%', aspectRatio: 16 / 10, backgroundColor: C.surfaceLowest, marginTop: 16, overflow: 'hidden' },
  canvasImg: { width: '100%', height: '100%' },
  progressTrack: { height: 4, backgroundColor: 'rgba(255,255,255,0.06)', marginHorizontal: 24, marginTop: 20, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: C.lime },
  timerCard: {
    marginHorizontal: 24, marginTop: 16, backgroundColor: C.surfaceLow, borderRadius: 14,
    paddingVertical: 22, alignItems: 'center', borderLeftWidth: 4, borderLeftColor: C.lime,
  },
  timerLabel: { color: C.muted, fontSize: 10, fontWeight: '700', letterSpacing: 3, marginBottom: 6 },
  timerBig: { color: C.lime, fontSize: 60, fontWeight: '800', letterSpacing: -1, fontVariant: ['tabular-nums'] },
  segTrackRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', paddingHorizontal: 20, marginTop: 12 },
  segTrackTime: { color: 'rgba(255,255,255,0.25)', fontSize: 10 },
  segTrack: { flex: 1, height: 2, backgroundColor: 'rgba(255,255,255,0.1)', marginHorizontal: 12, position: 'relative' },
  segDot: { position: 'absolute', top: -3, width: 8, height: 8, borderRadius: 4, backgroundColor: C.lime, marginLeft: -4 },
  metricsRow: { flexDirection: 'row', gap: 14, marginHorizontal: 24, marginTop: 14 },
  metricCard: { flex: 1, backgroundColor: C.surface, borderRadius: 12, padding: 16 },
  metricLabel: { color: C.muted, fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginBottom: 4 },
  metricValue: { color: C.text, fontSize: 24, fontWeight: '800' },
  metricFoot: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  metricFootText: { fontSize: 10, fontWeight: '700' },
  nextCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    marginHorizontal: 24, marginTop: 14, padding: 14, borderRadius: 12,
    backgroundColor: 'rgba(38,38,38,0.5)',
  },
  nextThumb: { width: 52, height: 52, borderRadius: 8, backgroundColor: C.surfaceLowest, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  nextThumbImg: { width: '100%', height: '100%', opacity: 0.7 },
  nextLabel: { color: C.cyan, fontSize: 9, fontWeight: '700', letterSpacing: 2 },
  nextName: { color: C.text, fontSize: 16, fontWeight: '800' },
  controls: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
    paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(14,14,14,0.9)',
  },
  control: { alignItems: 'center', gap: 4 },
  controlLabel: { color: C.muted, fontSize: 9, fontWeight: '700', letterSpacing: 1 },
  primaryBtn: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: C.lime,
    alignItems: 'center', justifyContent: 'center', marginTop: -20,
  },
  emptyText: { color: C.text, fontSize: 16, textAlign: 'center', marginBottom: 20 },
  emptyBtn: { backgroundColor: C.lime, borderRadius: 12, paddingHorizontal: 28, paddingVertical: 12, marginTop: 20 },
  emptyBtnText: { color: '#000', fontWeight: '800', fontSize: 15 },
  doneTitle: { color: C.text, fontSize: 24, fontWeight: '800', marginTop: 16 },
  doneSub: { color: C.muted, fontSize: 14, marginTop: 4 },
});
