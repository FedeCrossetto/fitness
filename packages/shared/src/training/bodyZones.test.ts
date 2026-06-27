import { describe, expect, it } from 'vitest';
import { bodyPartToBodyZone, collectWorkedZones, muscleLabelToBodyZone, zonesFromExercise } from './bodyZones';
import type { WorkoutSessionDetail } from './workoutSession';

describe('muscleLabelToBodyZone', () => {
  it('maps English and Spanish muscle names', () => {
    expect(muscleLabelToBodyZone('trapezius')).toBe('trapecios');
    expect(muscleLabelToBodyZone('Trapecios')).toBe('trapecios');
    expect(muscleLabelToBodyZone('pectorals')).toBe('pecho');
    expect(muscleLabelToBodyZone('delts')).toBe('deltoides');
  });
});

describe('bodyPartToBodyZone', () => {
  it('maps coarse body parts', () => {
    expect(bodyPartToBodyZone('pecho')).toBe('pecho');
    expect(bodyPartToBodyZone('espalda')).toBe('dorsales');
  });
});

describe('collectWorkedZones', () => {
  const detail: WorkoutSessionDetail = {
    workoutId: 'w1',
    exercises: [
      {
        workoutExerciseId: 'we1',
        exerciseId: 'e1',
        exerciseName: 'Encogimientos',
        imageUrl: null,
        bodyPart: 'espalda',
        targetMuscles: ['trapezius'],
        sets: [
          { id: 's1', setNumber: 1, weightKg: 20, reps: 12, completed: true },
          { id: 's2', setNumber: 2, weightKg: 20, reps: 12, completed: true },
        ],
        targetSets: 2,
        targetReps: '12',
        targetWeightKg: null,
        restSeconds: 60,
        previousLabel: null,
        previousSets: [],
        notes: '',
      },
      {
        workoutExerciseId: 'we2',
        exerciseId: 'e2',
        exerciseName: 'Press banca',
        imageUrl: null,
        bodyPart: 'pecho',
        targetMuscles: ['pectorals'],
        sets: [{ id: 's3', setNumber: 1, weightKg: 60, reps: 8, completed: true }],
        targetSets: 1,
        targetReps: '8',
        targetWeightKg: null,
        restSeconds: 90,
        previousLabel: null,
        previousSets: [],
        notes: '',
      },
    ],
  };

  it('aggregates zones from completed exercises', () => {
    expect(collectWorkedZones(detail)).toEqual([
      { id: 'trapecios', completedSets: 2 },
      { id: 'pecho', completedSets: 1 },
    ]);
  });

  it('ignores exercises without completed sets', () => {
    const empty = {
      ...detail,
      exercises: detail.exercises.map((exercise) => ({
        ...exercise,
        sets: exercise.sets.map((set) => ({ ...set, completed: false })),
      })),
    };
    expect(collectWorkedZones(empty)).toEqual([]);
  });
});

describe('zonesFromExercise', () => {
  it('falls back to bodyPart when muscles are missing', () => {
    expect(
      zonesFromExercise({
        bodyPart: 'hombros',
        sets: [],
      }),
    ).toEqual(['deltoides']);
  });
});
