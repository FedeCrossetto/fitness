import type { WorkoutSessionDetail, WorkoutSessionExercise } from './workoutSession';

/**
 * Zonas musculares canónicas de la app. Los nombres coinciden con los archivos PNG
 * en apps/mobile/assets/body/zones/{male|female}/{id}.png
 */
export type BodyZoneId =
  | 'trapecios'
  | 'deltoides'
  | 'pecho'
  | 'dorsales'
  | 'biceps'
  | 'triceps'
  | 'antebrazos'
  | 'abdominales'
  | 'oblicuos'
  | 'lumbar'
  | 'cuadriceps'
  | 'isquiotibiales'
  | 'gluteos'
  | 'gemelos';

export const BODY_ZONE_IDS: BodyZoneId[] = [
  'trapecios',
  'deltoides',
  'pecho',
  'dorsales',
  'biceps',
  'triceps',
  'antebrazos',
  'abdominales',
  'oblicuos',
  'lumbar',
  'cuadriceps',
  'isquiotibiales',
  'gluteos',
  'gemelos',
];

export type WorkedZoneEntry = {
  id: BodyZoneId;
  /** Series completadas que contribuyeron a esta zona. */
  completedSets: number;
};

type MuscleInput = Pick<
  WorkoutSessionExercise,
  'bodyPart' | 'targetMuscles' | 'secondaryMuscles' | 'sets'
>;

/** Mapea nombres de catálogo (wger / ExerciseDB, EN o ES) → zona visual. */
export function muscleLabelToBodyZone(label: string): BodyZoneId | null {
  const h = label.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');

  if (/trapez|trapecio/.test(h)) return 'trapecios';
  if (/deltoid|deltoide|shoulder|hombro|\bdelt/.test(h)) return 'deltoides';
  if (/pectoral|pecho|chest/.test(h)) return 'pecho';
  if (/lat|dorsal|espalda|back|romboide/.test(h)) return 'dorsales';
  if (/bicep|bícep/.test(h)) return 'biceps';
  if (/tricep|trícep/.test(h)) return 'triceps';
  if (/forearm|antebrazo/.test(h)) return 'antebrazos';
  if (/oblicu|oblique/.test(h)) return 'oblicuos';
  if (/abs|abdominal|rectus|core|waist/.test(h)) return 'abdominales';
  if (/spine|lumbar|erector|lower back/.test(h)) return 'lumbar';
  if (/quad|cuadricep|cuádricep|thigh|upper leg/.test(h)) return 'cuadriceps';
  if (/hamstring|isquio/.test(h)) return 'isquiotibiales';
  if (/glute|glúteo/.test(h)) return 'gluteos';
  if (/calf|gemelo|soleus|lower leg/.test(h)) return 'gemelos';

  return null;
}

export function bodyPartToBodyZone(bodyPart: string | null | undefined): BodyZoneId | null {
  if (!bodyPart) return null;
  const h = bodyPart.toLowerCase();

  if (/pecho|chest/.test(h)) return 'pecho';
  if (/espalda|back/.test(h)) return 'dorsales';
  if (/hombro|shoulder/.test(h)) return 'deltoides';
  if (/brazo|arm|upper arm/.test(h)) return 'biceps';
  if (/pierna|leg|upper leg/.test(h)) return 'cuadriceps';
  if (/core|abdominal|abs|waist/.test(h)) return 'abdominales';
  if (/lower leg|gemelo|calf/.test(h)) return 'gemelos';

  return muscleLabelToBodyZone(bodyPart);
}

export function zonesFromExercise(exercise: MuscleInput): BodyZoneId[] {
  const zones = new Set<BodyZoneId>();

  for (const muscle of exercise.targetMuscles ?? []) {
    const zone = muscleLabelToBodyZone(muscle);
    if (zone) zones.add(zone);
  }

  if (zones.size === 0) {
    const fallback = bodyPartToBodyZone(exercise.bodyPart);
    if (fallback) zones.add(fallback);
  }

  return [...zones];
}

export function collectWorkedZones(
  detail: WorkoutSessionDetail | null | undefined,
  options?: { includeSecondary?: boolean },
): WorkedZoneEntry[] {
  if (!detail) return [];

  const includeSecondary = options?.includeSecondary ?? false;
  const totals = new Map<BodyZoneId, number>();

  for (const exercise of detail.exercises) {
    const completedSets = exercise.sets.filter((set) => set.completed).length;
    if (completedSets <= 0) continue;

    const zoneIds = zonesFromExercise(exercise);
    if (includeSecondary) {
      for (const muscle of exercise.secondaryMuscles ?? []) {
        const zone = muscleLabelToBodyZone(muscle);
        if (zone && !zoneIds.includes(zone)) zoneIds.push(zone);
      }
    }

    for (const zoneId of zoneIds) {
      totals.set(zoneId, (totals.get(zoneId) ?? 0) + completedSets);
    }
  }

  return [...totals.entries()]
    .map(([id, completedSets]) => ({ id, completedSets }))
    .sort((a, b) => b.completedSets - a.completedSets || a.id.localeCompare(b.id));
}
