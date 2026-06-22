import type { WorkoutExerciseRow, ExerciseRow } from '../types/database';

export type WorkoutExerciseItem = WorkoutExerciseRow & { exercise: ExerciseRow };

export function formatExercisePrescription(item: Pick<WorkoutExerciseItem, 'sets' | 'reps' | 'weight_kg' | 'tempo' | 'rest_seconds'>): string {
  const parts: string[] = [`${item.sets} x ${item.reps}`];
  if (item.weight_kg != null) parts.push(`${item.weight_kg} kg`);
  if (item.tempo) parts.push(`Tempo ${item.tempo}`);
  if (item.rest_seconds != null) parts.push(`${item.rest_seconds}s`);
  return parts.join(' · ');
}

export function buildSessionComments(session: {
  notes: string;
  heartRate: number | null;
  calories: number | null;
}): string | null {
  const parts: string[] = [];
  const notes = session.notes.trim();
  if (notes) parts.push(notes);
  if (session.heartRate != null) parts.push(`FC media: ${session.heartRate} bpm`);
  if (session.calories != null) parts.push(`Calorías: ${session.calories}`);
  return parts.length > 0 ? parts.join('\n') : null;
}
