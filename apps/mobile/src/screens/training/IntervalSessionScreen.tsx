import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
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
  const totalSeconds = useMemo(() => timeline.reduce((sum, s) => sum + s.seconds, 0), [timeline]);
  const completedExerciseIds = useMemo(
    () => Array.from(new Set((detail?.exercises ?? []).filter((e) => e.kind !== 'rest' && e.exercise_id).map((e) => e.exercise_id as string))),
    [detail],
  );

  const [index, setIndex] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [paused, setPaused] = useState(false);
  const [finished, setFinished] = useState(false);

  // Arranca (o reinicia) el reloj cuando el timeline queda listo.
  useEffect(() => {
    if (timeline.length > 0) { setIndex(0); setRemaining(timeline[0].seconds); setFinished(false); }
  }, [timeline]);

  const goTo = (i: number) => {
    if (i < 0 || timeline.length === 0) return;
    if (i >= timeline.length) { setFinished(true); hapticSuccess(); return; }
    setIndex(i);
    setRemaining(timeline[i].seconds);
    hapticMedium();
  };

  const confirmStop = () => {
    Alert.alert('Detener entreno', '¿Seguro que querés salir? No se va a guardar.', [
      { text: 'Seguir', style: 'cancel' },
      { text: 'Detener', style: 'destructive', onPress: () => navigation.goBack() },
    ]);
  };

  // Cuenta regresiva del segmento actual.
  useEffect(() => {
    if (paused || finished || timeline.length === 0) return;
    const id = setInterval(() => setRemaining((r) => (r <= 1 ? 0 : r - 1)), 1000);
    return () => clearInterval(id);
  }, [paused, finished, index, timeline.length]);

  // Al llegar a 0, avanza al siguiente segmento (o termina).
  useEffect(() => {
    if (!finished && timeline.length > 0 && remaining === 0) goTo(index + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining]);

  // Al terminar, registra el entreno una sola vez (cuenta para stats/racha).
  const loggedRef = useRef(false);
  useEffect(() => {
    if (finished && !loggedRef.current && userId && detail) {
      loggedRef.current = true;
      void logIntervalWorkout(userId, {
        workoutId: detail.id,
        workoutName: detail.title,
        workoutType: detail.workout_type,
        durationSeconds: totalSeconds,
        completedExercises: completedExerciseIds,
      });
    }
  }, [finished, userId, detail, totalSeconds, completedExerciseIds, logIntervalWorkout]);

  const current = timeline[index] ?? null;
  const next = timeline[index + 1] ?? null;

  const elapsed = useMemo(() => {
    let e = 0;
    for (let j = 0; j < index; j++) e += timeline[j]?.seconds ?? 0;
    if (current) e += current.seconds - remaining;
    return e;
  }, [index, remaining, current, timeline]);
  const completionPct = totalSeconds > 0 ? Math.round((elapsed / totalSeconds) * 100) : 0;
  const segProgress = current && current.seconds > 0 ? (current.seconds - remaining) / current.seconds : 0;

  const isRest = current?.kind === 'rest';

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
                <AppText style={styles.metricValue}>{formatClock(elapsed)}</AppText>
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
                  <AppText style={[styles.metricFootText, { color: C.lime }]}>{index + 1}/{timeline.length}</AppText>
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
            <Control icon="play-back" label="ATRÁS" onPress={() => (index > 0 ? goTo(index - 1) : setRemaining(current?.seconds ?? 0))} />
            <Pressable style={styles.primaryBtn} onPress={() => setPaused((p) => !p)}>
              <Ionicons name={paused ? 'play' : 'pause'} size={34} color="#000" />
            </Pressable>
            <Control icon="stop" label="DETENER" color={C.cyan} onPress={confirmStop} />
            <Control icon="play-forward" label="SIGUIENTE" onPress={() => goTo(index + 1)} />
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
  timerBig: { color: C.lime, fontSize: 60, fontWeight: '800', letterSpacing: -1 },
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
