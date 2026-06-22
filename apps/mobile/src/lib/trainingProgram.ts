import type { WorkoutLogRow } from '../types/database';
import type { PhaseWithDays } from '../stores/trainingStore';

export type DayWithPhase = PhaseWithDays['days'][number] & { phase: PhaseWithDays };

export function getCompletedWorkoutNames(logs: WorkoutLogRow[]): Set<string> {
  return new Set(logs.filter((l) => l.completed).map((l) => l.workout_name));
}

export function isTrainableDay(day: PhaseWithDays['days'][number]): boolean {
  return day.day_type !== 'descanso' && day.workout != null;
}

export function isCardioDay(day: PhaseWithDays['days'][number]): boolean {
  return day.day_type === 'cardio' && day.workout != null;
}

export function isRestDay(day: PhaseWithDays['days'][number]): boolean {
  return day.day_type === 'descanso' || day.workout == null;
}

export function flattenDays(phases: PhaseWithDays[]): DayWithPhase[] {
  return phases.flatMap((phase) => phase.days.map((day) => ({ ...day, phase })));
}

export function getTrainableDays(phases: PhaseWithDays[]): DayWithPhase[] {
  return flattenDays(phases).filter(isTrainableDay);
}

export function isDayCompleted(
  day: PhaseWithDays['days'][number],
  completedNames: Set<string>,
): boolean {
  return Boolean(day.workout && completedNames.has(day.workout.title));
}

export function getNextWorkoutDay(
  phases: PhaseWithDays[],
  completedNames: Set<string>,
): DayWithPhase | null {
  return getTrainableDays(phases).find((day) => !isDayCompleted(day, completedNames)) ?? null;
}

export function getPhaseProgress(
  phase: PhaseWithDays,
  completedNames: Set<string>,
): number {
  const trainable = phase.days.filter(isTrainableDay);
  if (trainable.length === 0) return 0;
  const done = trainable.filter((day) => isDayCompleted(day, completedNames)).length;
  return done / trainable.length;
}

export function getProgramStats(phases: PhaseWithDays[], completedNames: Set<string>) {
  const trainable = getTrainableDays(phases);
  const completedCount = trainable.filter((day) => isDayCompleted(day, completedNames)).length;
  const totalDays = phases.reduce((sum, phase) => sum + phase.days.length, 0);
  return {
    phaseCount: phases.length,
    totalDays,
    trainableCount: trainable.length,
    completedCount,
    progress: trainable.length > 0 ? completedCount / trainable.length : 0,
    allCompleted: trainable.length > 0 && completedCount >= trainable.length,
  };
}
