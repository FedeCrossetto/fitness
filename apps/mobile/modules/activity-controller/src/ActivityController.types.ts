export type StartLiveActivityParams = {
  workoutTitle: string;
  /** epoch en segundos */
  startedAt: number;
  completed: number;
  total: number;
};

export type UpdateLiveActivityParams = {
  completed: number;
  total: number;
};
