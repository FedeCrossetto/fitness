export type LiveActivitySetState = {
  exerciseName: string;
  currentSet: number;
  exerciseSetCount: number;
  weightKg: number | null;
  reps: number | null;
};

export type StartLiveActivityParams = LiveActivitySetState & {
  workoutTitle: string;
  /** epoch en segundos */
  startedAt: number;
  completed: number;
  total: number;
};

export type UpdateLiveActivityParams = LiveActivitySetState & {
  completed: number;
  total: number;
};
