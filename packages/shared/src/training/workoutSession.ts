export interface WorkoutSessionSet {
  id: string;
  setNumber: number;
  weightKg: number | null;
  reps: number | null;
  completed: boolean;
}

export interface WorkoutSessionPreviousSet {
  setNumber: number;
  weightKg: number;
  reps: number;
}

export interface WorkoutSessionExercise {
  workoutExerciseId: string;
  exerciseId: string;
  exerciseName: string;
  imageUrl: string | null;
  /** Zona corporal para fallback visual cuando no hay GIF. */
  bodyPart?: string | null;
  /** Músculos principales del catálogo — usados en el mapa corporal post-entreno. */
  targetMuscles?: string[] | null;
  secondaryMuscles?: string[] | null;
  targetSets: number;
  targetReps: string;
  targetWeightKg: number | null;
  restSeconds: number | null;
  /** @deprecated Usar previousSets — resumen de la última serie completada */
  previousLabel: string | null;
  previousSets: WorkoutSessionPreviousSet[];
  notes: string;
  sets: WorkoutSessionSet[];
}

export interface WorkoutSessionDetail {
  workoutId: string;
  exercises: WorkoutSessionExercise[];
}

export function parseRepsNumber(reps: string | null | undefined): number | null {
  if (!reps) return null;
  const match = reps.match(/\d+/);
  return match ? Number.parseInt(match[0], 10) : null;
}

export function createDefaultSets(
  workoutExerciseId: string,
  count: number,
  _defaultWeightKg: number | null,
  _defaultReps: string,
): WorkoutSessionSet[] {
  return Array.from({ length: Math.max(1, count) }, (_, index) => ({
    id: `${workoutExerciseId}-set-${index + 1}`,
    setNumber: index + 1,
    weightKg: null,
    reps: null,
    completed: false,
  }));
}

export function computeSessionVolumeKg(detail: Pick<WorkoutSessionDetail, 'exercises'>): number {
  let total = 0;
  for (const exercise of detail.exercises) {
    for (const set of exercise.sets) {
      if (!set.completed || set.weightKg == null || set.reps == null) continue;
      total += set.weightKg * set.reps;
    }
  }
  return Math.round(total);
}

export function countCompletedSets(detail: Pick<WorkoutSessionDetail, 'exercises'>): number {
  return detail.exercises.reduce(
    (sum, exercise) => sum + exercise.sets.filter((set) => set.completed).length,
    0,
  );
}

export function formatSetPreviousLabel(set: WorkoutSessionSet): string | null {
  if (set.weightKg == null || set.reps == null) return null;
  return `${set.weightKg}kg x ${set.reps}`;
}

export function findPreviousSetsForExercise(
  logs: { session_detail: WorkoutSessionDetail | null }[],
  exerciseId: string,
): WorkoutSessionPreviousSet[] {
  for (const log of logs) {
    const detail = log.session_detail;
    if (!detail) continue;
    const exercise = detail.exercises.find((item) => item.exerciseId === exerciseId);
    if (!exercise) continue;
    const sets = exercise.sets
      .filter((set) => set.completed && set.weightKg != null && set.reps != null)
      .map((set) => ({
        setNumber: set.setNumber,
        weightKg: set.weightKg!,
        reps: set.reps!,
      }));
    if (sets.length > 0) return sets;
  }
  return [];
}

export function formatPreviousSetLine(set: WorkoutSessionPreviousSet): string {
  return `${set.weightKg} kg × ${set.reps}`;
}

export function findPreviousExerciseLabel(
  logs: { session_detail: WorkoutSessionDetail | null }[],
  exerciseId: string,
): string | null {
  for (const log of logs) {
    const detail = log.session_detail;
    if (!detail) continue;
    const exercise = detail.exercises.find((item) => item.exerciseId === exerciseId);
    if (!exercise) continue;
    const completed = exercise.sets.filter((set) => set.completed);
    const last = completed[completed.length - 1];
    const label = last ? formatSetPreviousLabel(last) : null;
    if (label) return label;
  }
  return null;
}

export interface WorkoutFeedExerciseLine {
  name: string;
  completedSets: number;
}

export function summarizeWorkoutForFeed(detail: WorkoutSessionDetail | null | undefined): WorkoutFeedExerciseLine[] {
  if (!detail) return [];
  return detail.exercises
    .map((exercise) => ({
      name: exercise.exerciseName,
      completedSets: exercise.sets.filter((set) => set.completed).length,
    }))
    .filter((line) => line.completedSets > 0);
}

export function formatWorkoutVolume(volumeKg: number | null | undefined): string {
  if (volumeKg == null || volumeKg <= 0) return '0 kg';
  return `${volumeKg.toLocaleString('es-AR')} kg`;
}

export function formatWorkoutDuration(minutes: number | null | undefined, seconds: number | null | undefined): string {
  const totalSeconds = seconds ?? (minutes != null ? minutes * 60 : 0);
  if (totalSeconds <= 0) return '0 min';
  const mins = Math.floor(totalSeconds / 60);
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  if (hrs > 0) return `${hrs}h ${rem}min`;
  return `${mins} min`;
}
