import {
  i,
  type BodyMeasurementField,
  type BodyMeasurementValidationFailure,
  type Translations,
} from '@reset-fitness/shared';

const FIELD_LABELS: Record<BodyMeasurementField, (t: Translations) => string> = {
  weight_kg: (t) => t.progress.weight,
  body_fat_pct: (t) => t.progress.fat_pct,
  chest_cm: (t) => t.progress.chest,
  waist_cm: (t) => t.progress.waist,
  hips_cm: (t) => t.progress.hips,
  arms_cm: (t) => t.progress.arms,
  legs_cm: (t) => t.progress.legs,
};

export function formatMeasurementValidationError(
  failure: BodyMeasurementValidationFailure,
  t: Translations,
): string {
  return i(t.progress.measurements_out_of_range, {
    label: FIELD_LABELS[failure.field](t),
    min: failure.min,
    max: failure.max,
    unit: failure.unit,
  });
}
