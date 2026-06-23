/** Rangos razonables alineados con la DB (numeric) y el onboarding. */

export const BODY_MEASUREMENT_LIMITS = {
  weight_kg: { min: 30, max: 300, unit: 'kg' },
  body_fat_pct: { min: 3, max: 75, unit: '%' },
  chest_cm: { min: 40, max: 200, unit: 'cm' },
  waist_cm: { min: 40, max: 200, unit: 'cm' },
  hips_cm: { min: 40, max: 200, unit: 'cm' },
  arms_cm: { min: 15, max: 80, unit: 'cm' },
  legs_cm: { min: 30, max: 150, unit: 'cm' },
} as const;

export type BodyMeasurementField = keyof typeof BODY_MEASUREMENT_LIMITS;

export type BodyMeasurementValues = Partial<Record<BodyMeasurementField, number | null>>;

export interface BodyMeasurementValidationFailure {
  ok: false;
  field: BodyMeasurementField;
  min: number;
  max: number;
  unit: string;
}

export type BodyMeasurementValidationResult =
  | { ok: true }
  | BodyMeasurementValidationFailure;

/** Valida solo los campos presentes (no null/undefined). */
export function validateBodyMeasurements(values: BodyMeasurementValues): BodyMeasurementValidationResult {
  for (const field of Object.keys(BODY_MEASUREMENT_LIMITS) as BodyMeasurementField[]) {
    const value = values[field];
    if (value === undefined || value === null) continue;
    const { min, max, unit } = BODY_MEASUREMENT_LIMITS[field];
    if (!Number.isFinite(value) || value < min || value > max) {
      return { ok: false, field, min, max, unit };
    }
  }
  return { ok: true };
}

export function isMeasurementDbError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('numeric field overflow')
    || lower.includes('22003')
    || lower.includes('value too long')
    || lower.includes('check constraint')
  );
}
