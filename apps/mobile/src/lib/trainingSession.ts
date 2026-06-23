import {
  computeSessionVolumeKg,
  countCompletedSets,
  createDefaultSets,
  findPreviousExerciseLabel,
  findPreviousSetsForExercise,
  type WorkoutSessionDetail,
  type WorkoutSessionExercise,
  type WorkoutSessionSet,
} from '@reset-fitness/shared';
import { buildSessionComments } from './trainingExercise';
import type { ExerciseRow, WorkoutExerciseRow } from '../types/database';

type WorkoutDetailForSession = {
  id: string;
  client_id?: string | null;
  exercises: (WorkoutExerciseRow & { exercise: ExerciseRow })[];
};

export type SessionRestState = {
  workoutExerciseId: string;
  endsAt: number;
  totalSeconds: number;
};

export type ActiveSession = {
  workoutId: string;
  workoutTitle: string;
  /** true = rutina personalizada del alumno; puede agregar ejercicios. */
  isCustomWorkout: boolean;
  startedAt: number;
  exercises: WorkoutSessionExercise[];
  notes: string;
  rpe: number | null;
  heartRate: number | null;
  calories: number | null;
  restEnabled: boolean;
  activeRest: SessionRestState | null;
};

export function sessionDetailFromActive(session: ActiveSession): WorkoutSessionDetail {
  return {
    workoutId: session.workoutId,
    exercises: session.exercises,
  };
}

export function completedExerciseIdsFromSession(session: ActiveSession): string[] {
  return session.exercises
    .filter((exercise) => exercise.sets.some((set) => set.completed))
    .map((exercise) => exercise.workoutExerciseId);
}

export function liveCompletedCount(session: ActiveSession): number {
  return countCompletedSets(sessionDetailFromActive(session));
}

export function liveTotalSets(session: ActiveSession): number {
  return session.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0);
}

/** Ejercicio y serie activos para la Live Activity (estilo Hevy). */
export function resolveLiveActivityFocus(session: ActiveSession): {
  exerciseName: string;
  currentSet: number;
  exerciseSetCount: number;
  weightKg: number | null;
  reps: number | null;
} {
  const fallback = {
    exerciseName: session.workoutTitle,
    currentSet: 0,
    exerciseSetCount: 0,
    weightKg: null as number | null,
    reps: null as number | null,
  };
  if (session.exercises.length === 0) return fallback;

  const exercise =
    session.exercises.find((item) => item.sets.some((set) => !set.completed))
    ?? session.exercises[session.exercises.length - 1];
  const set =
    exercise.sets.find((item) => !item.completed)
    ?? exercise.sets[exercise.sets.length - 1];

  if (!set) return { ...fallback, exerciseName: exercise.exerciseName, exerciseSetCount: exercise.sets.length };

  return {
    exerciseName: exercise.exerciseName,
    currentSet: set.setNumber,
    exerciseSetCount: exercise.sets.length,
    weightKg: set.weightKg ?? exercise.targetWeightKg,
    reps: set.reps,
  };
}

export async function buildSessionExercises(
  detail: WorkoutDetailForSession,
  previousLogs: { session_detail: WorkoutSessionDetail | null }[],
): Promise<WorkoutSessionExercise[]> {
  return detail.exercises.map((item) => ({
    workoutExerciseId: item.id,
    exerciseId: item.exercise_id,
    exerciseName: item.exercise.name,
    imageUrl: item.exercise.image_url,
    bodyPart: item.exercise.body_part,
    targetMuscles: item.exercise.target_muscles,
    secondaryMuscles: item.exercise.secondary_muscles,
    targetSets: item.sets,
    targetReps: item.reps,
    targetWeightKg: item.weight_kg,
    restSeconds: item.rest_seconds,
    previousLabel: findPreviousExerciseLabel(previousLogs, item.exercise_id),
    previousSets: findPreviousSetsForExercise(previousLogs, item.exercise_id),
    notes: '',
    sets: createDefaultSets(item.id, item.sets, item.weight_kg, item.reps),
  }));
}

export function updateSetInSession(
  session: ActiveSession,
  workoutExerciseId: string,
  setId: string,
  patch: Partial<Pick<WorkoutSessionSet, 'weightKg' | 'reps' | 'completed'>>,
): ActiveSession {
  return {
    ...session,
    exercises: session.exercises.map((exercise) => {
      if (exercise.workoutExerciseId !== workoutExerciseId) return exercise;
      return {
        ...exercise,
        sets: exercise.sets.map((set) => (set.id === setId ? { ...set, ...patch } : set)),
      };
    }),
  };
}

export function addSetToExercise(session: ActiveSession, workoutExerciseId: string): ActiveSession {
  return {
    ...session,
    exercises: session.exercises.map((exercise) => {
      if (exercise.workoutExerciseId !== workoutExerciseId) return exercise;
      const nextNumber = exercise.sets.length + 1;
      const last = exercise.sets[exercise.sets.length - 1];
      return {
        ...exercise,
        sets: [
          ...exercise.sets,
          {
            id: `${workoutExerciseId}-set-${nextNumber}-${Date.now()}`,
            setNumber: nextNumber,
            weightKg: last?.weightKg ?? exercise.targetWeightKg,
            reps: last?.reps ?? null,
            completed: false,
          },
        ],
      };
    }),
  };
}

export function addExerciseToSession(
  session: ActiveSession,
  exercise: Pick<ExerciseRow, 'id' | 'name' | 'image_url' | 'body_part' | 'target_muscles'> & Pick<Partial<ExerciseRow>, 'secondary_muscles'>,
  previousLogs: { session_detail: WorkoutSessionDetail | null }[],
  persistedWorkoutExerciseId?: string,
): ActiveSession {
  const workoutExerciseId = persistedWorkoutExerciseId ?? `adhoc-${exercise.id}-${Date.now()}`;
  const entry: WorkoutSessionExercise = {
    workoutExerciseId,
    exerciseId: exercise.id,
    exerciseName: exercise.name,
    imageUrl: exercise.image_url,
    bodyPart: exercise.body_part,
    targetMuscles: exercise.target_muscles,
    secondaryMuscles: exercise.secondary_muscles,
    targetSets: 3,
    targetReps: '10',
    targetWeightKg: null,
    restSeconds: 90,
    previousLabel: findPreviousExerciseLabel(previousLogs, exercise.id),
    previousSets: findPreviousSetsForExercise(previousLogs, exercise.id),
    notes: '',
    sets: createDefaultSets(workoutExerciseId, 3, null, '10'),
  };
  return { ...session, exercises: [...session.exercises, entry] };
}

export function startRestAfterSet(session: ActiveSession, workoutExerciseId: string): ActiveSession {
  if (!session.restEnabled) return { ...session, activeRest: null };
  const exercise = session.exercises.find((item) => item.workoutExerciseId === workoutExerciseId);
  const seconds = exercise?.restSeconds;
  if (!seconds || seconds <= 0) return { ...session, activeRest: null };
  return {
    ...session,
    activeRest: {
      workoutExerciseId,
      endsAt: Date.now() + seconds * 1000,
      totalSeconds: seconds,
    },
  };
}

export function clearActiveRest(session: ActiveSession): ActiveSession {
  return { ...session, activeRest: null };
}

export function toggleSessionRestEnabled(session: ActiveSession): ActiveSession {
  const restEnabled = !session.restEnabled;
  return { ...session, restEnabled, activeRest: restEnabled ? session.activeRest : null };
}

export function getRestRemainingSeconds(session: ActiveSession, now = Date.now()): number {
  if (!session.activeRest) return 0;
  return Math.max(0, Math.ceil((session.activeRest.endsAt - now) / 1000));
}

export function formatRestCountdown(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins > 0) return `${mins}:${String(secs).padStart(2, '0')}`;
  return `${secs}s`;
}

function defaultSessionMeta(): Pick<ActiveSession, 'notes' | 'rpe' | 'heartRate' | 'calories' | 'restEnabled' | 'activeRest'> {
  return {
    notes: '',
    rpe: null,
    heartRate: null,
    calories: null,
    restEnabled: true,
    activeRest: null,
  };
}

export function updateExerciseNotes(
  session: ActiveSession,
  workoutExerciseId: string,
  notes: string,
): ActiveSession {
  return {
    ...session,
    exercises: session.exercises.map((exercise) =>
      exercise.workoutExerciseId === workoutExerciseId ? { ...exercise, notes } : exercise,
    ),
  };
}

export function buildFinishPayload(session: ActiveSession, userId: string, elapsedSeconds: number) {
  const detail = sessionDetailFromActive(session);
  return {
    user_id: userId,
    date: new Date().toISOString().slice(0, 10),
    workout_name: session.workoutTitle,
    workout_type: 'fuerza' as const,
    workout_id: session.workoutId,
    duration_min: Math.max(1, Math.round(elapsedSeconds / 60)),
    elapsed_seconds: elapsedSeconds,
    completed_exercises: completedExerciseIdsFromSession(session),
    session_detail: detail,
    total_volume_kg: computeSessionVolumeKg(detail),
    completed_sets: countCompletedSets(detail),
    rpe: session.rpe,
    comments: buildSessionComments(session),
    completed: true,
  };
}

export function normalizeStoredSession(raw: unknown, detail: WorkoutDetailForSession | null): ActiveSession | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Partial<ActiveSession> & { completedExerciseIds?: string[] };
  if (!value.workoutId || !value.workoutTitle || !value.startedAt) return null;

  const migrateExercise = (exercise: WorkoutSessionExercise): WorkoutSessionExercise => ({
    ...exercise,
    previousSets: exercise.previousSets ?? [],
    previousLabel: exercise.previousLabel ?? null,
  });

  if (Array.isArray(value.exercises) && value.exercises.length > 0) {
    return {
      workoutId: value.workoutId,
      workoutTitle: value.workoutTitle,
      isCustomWorkout: value.isCustomWorkout ?? false,
      startedAt: value.startedAt,
      exercises: value.exercises.map((exercise) => migrateExercise(exercise as WorkoutSessionExercise)),
      notes: value.notes ?? '',
      rpe: value.rpe ?? null,
      heartRate: value.heartRate ?? null,
      calories: value.calories ?? null,
      restEnabled: value.restEnabled ?? true,
      activeRest: value.activeRest ?? null,
    };
  }

  if (!detail || detail.id !== value.workoutId) return null;

  const exercises = detail.exercises.map((item) => ({
    workoutExerciseId: item.id,
    exerciseId: item.exercise_id,
    exerciseName: item.exercise.name,
    imageUrl: item.exercise.image_url,
    bodyPart: item.exercise.body_part,
    targetMuscles: item.exercise.target_muscles,
    secondaryMuscles: item.exercise.secondary_muscles,
    targetSets: item.sets,
    targetReps: item.reps,
    targetWeightKg: item.weight_kg,
    restSeconds: item.rest_seconds,
    previousLabel: null,
    previousSets: [],
    notes: '',
    sets: createDefaultSets(item.id, item.sets, item.weight_kg, item.reps).map((set) => ({
      ...set,
      completed: (value.completedExerciseIds ?? []).includes(item.id),
    })),
  }));

  return {
    workoutId: value.workoutId,
    workoutTitle: value.workoutTitle,
    isCustomWorkout: value.isCustomWorkout ?? detail.client_id != null,
    startedAt: value.startedAt,
    exercises,
    ...defaultSessionMeta(),
    notes: value.notes ?? '',
    rpe: value.rpe ?? null,
    heartRate: value.heartRate ?? null,
    calories: value.calories ?? null,
  };
}
