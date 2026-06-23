import { describe, expect, it } from 'vitest';
import {
  computeSessionVolumeKg,
  countCompletedSets,
  parseRepsNumber,
  summarizeWorkoutForFeed,
  type WorkoutSessionDetail,
} from './workoutSession';

const sampleDetail: WorkoutSessionDetail = {
  workoutId: 'w1',
  exercises: [
    {
      workoutExerciseId: 'we1',
      exerciseId: 'e1',
      exerciseName: 'Sentadilla',
      imageUrl: null,
      targetSets: 3,
      targetReps: '8',
      targetWeightKg: 60,
      restSeconds: 90,
      previousLabel: null,
      previousSets: [],
      notes: '',
      sets: [
        { id: 's1', setNumber: 1, weightKg: 60, reps: 8, completed: true },
        { id: 's2', setNumber: 2, weightKg: 60, reps: 8, completed: true },
        { id: 's3', setNumber: 3, weightKg: 60, reps: 6, completed: false },
      ],
    },
  ],
};

describe('parseRepsNumber', () => {
  it('parses first number from rep range', () => {
    expect(parseRepsNumber('6-8')).toBe(6);
    expect(parseRepsNumber('10')).toBe(10);
    expect(parseRepsNumber(null)).toBeNull();
  });
});

describe('computeSessionVolumeKg', () => {
  it('sums completed sets only', () => {
    expect(computeSessionVolumeKg(sampleDetail)).toBe(60 * 8 + 60 * 8);
  });
});

describe('countCompletedSets', () => {
  it('counts completed sets across exercises', () => {
    expect(countCompletedSets(sampleDetail)).toBe(2);
  });
});

describe('summarizeWorkoutForFeed', () => {
  it('returns exercise lines with completed set counts', () => {
    expect(summarizeWorkoutForFeed(sampleDetail)).toEqual([
      { name: 'Sentadilla', completedSets: 2 },
    ]);
  });

  it('returns empty for null detail', () => {
    expect(summarizeWorkoutForFeed(null)).toEqual([]);
  });
});
