import type { Language } from '@reset-fitness/shared';
import { localizedExercise } from './exerciseI18n';
import type { ExerciseRow, WorkoutExerciseRow } from '../types/database';

/** Un segmento reproducible del player de intervalos: un ejercicio o un
 * descanso, con su duración y (si viene de un circuito) la ronda. */
export interface IntervalSegment {
  key: string;
  kind: 'exercise' | 'rest';
  name: string;
  seconds: number;
  imageUrl: string | null;
  /** "RONDA 2/4" para los ejercicios de un circuito; null si no aplica. */
  roundLabel: string | null;
  /** null en descansos; usado para registrar qué ejercicios se completaron. */
  exerciseId: string | null;
}

type IntervalItem = WorkoutExerciseRow & { exercise: ExerciseRow | null };

const DEFAULT_SEGMENT_SECONDS = 30;

function segmentFrom(item: IntervalItem, roundLabel: string | null, suffix: string, language: Language): IntervalSegment {
  const isRest = item.kind === 'rest';
  const name = isRest ? 'Descanso' : (item.exercise ? (localizedExercise(item.exercise, language).name ?? item.exercise.name) : 'Ejercicio');
  return {
    key: `${item.id}-${suffix}`,
    kind: isRest ? 'rest' : 'exercise',
    name,
    seconds: item.duration_seconds ?? DEFAULT_SEGMENT_SECONDS,
    imageUrl: isRest ? null : (item.exercise?.image_url ?? null),
    roundLabel,
    exerciseId: isRest ? null : item.exercise_id,
  };
}

/** Expande la rutina de intervalos a la lista lineal de segmentos que el player
 * reproduce en orden: los circuitos se repiten `circuit_rounds` veces. */
export function buildIntervalTimeline(items: IntervalItem[], language: Language): IntervalSegment[] {
  const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order);
  const segments: IntervalSegment[] = [];
  let i = 0;
  while (i < sorted.length) {
    const it = sorted[i];
    const group = it.circuit_group;
    // Corrida de items contiguos del mismo circuito → repetir por rondas.
    if (group && sorted[i + 1]?.circuit_group === group) {
      const run: IntervalItem[] = [];
      while (i < sorted.length && sorted[i].circuit_group === group) { run.push(sorted[i]); i++; }
      const rounds = Math.max(1, run[0].circuit_rounds ?? 1);
      for (let r = 1; r <= rounds; r++) {
        for (const member of run) {
          segments.push(segmentFrom(member, `RONDA ${r}/${rounds}`, `r${r}`, language));
        }
      }
    } else {
      segments.push(segmentFrom(it, null, 'x', language));
      i++;
    }
  }
  return segments;
}

/** mm:ss a partir de segundos. */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}
