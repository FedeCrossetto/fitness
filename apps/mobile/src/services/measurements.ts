import { anyClient } from '../lib/supabase';
import type { BodyMeasurementRow } from '../types/database';
import { toISODate, todayISO } from '../lib/dates';

type ConsultationAnswer = { label: string; answer: string | string[] };

type MeasureField =
  | 'weight_kg' | 'body_fat_pct' | 'lean_body_mass_kg'
  | 'chest_cm' | 'waist_cm' | 'hips_cm' | 'abdomen_cm' | 'neck_cm' | 'shoulder_cm'
  | 'left_bicep_cm' | 'right_bicep_cm' | 'left_forearm_cm' | 'right_forearm_cm'
  | 'left_thigh_cm' | 'right_thigh_cm' | 'left_calf_cm' | 'right_calf_cm'
  | 'arms_cm' | 'legs_cm';

/** Combina medidas nuevas con la fila del día; null/undefined no pisa valores existentes. */
export function mergeMeasurementFields(
  existing: BodyMeasurementRow | undefined,
  incoming: Partial<BodyMeasurementRow>,
  userId: string,
  date: string,
): Omit<BodyMeasurementRow, 'id' | 'created_at' | 'updated_at'> {
  const pick = <K extends MeasureField | 'gender'>(key: K): BodyMeasurementRow[K] => {
    const next = incoming[key];
    if (next !== undefined && next !== null) return next as BodyMeasurementRow[K];
    return (existing?.[key] ?? null) as BodyMeasurementRow[K];
  };

  return {
    user_id: userId,
    date,
    gender: pick('gender'),
    weight_kg: pick('weight_kg'),
    body_fat_pct: pick('body_fat_pct'),
    lean_body_mass_kg: pick('lean_body_mass_kg'),
    chest_cm: pick('chest_cm'),
    waist_cm: pick('waist_cm'),
    hips_cm: pick('hips_cm'),
    abdomen_cm: pick('abdomen_cm'),
    neck_cm: pick('neck_cm'),
    shoulder_cm: pick('shoulder_cm'),
    left_bicep_cm: pick('left_bicep_cm'),
    right_bicep_cm: pick('right_bicep_cm'),
    left_forearm_cm: pick('left_forearm_cm'),
    right_forearm_cm: pick('right_forearm_cm'),
    left_thigh_cm: pick('left_thigh_cm'),
    right_thigh_cm: pick('right_thigh_cm'),
    left_calf_cm: pick('left_calf_cm'),
    right_calf_cm: pick('right_calf_cm'),
    arms_cm: pick('arms_cm'),
    legs_cm: pick('legs_cm'),
  };
}

/** Si el onboarding guardó peso solo en la consulta, lo migra a body_measurements. */
export async function backfillWeightFromConsultation(
  userId: string,
  measurements: BodyMeasurementRow[],
  upsert: (payload: ReturnType<typeof mergeMeasurementFields>) => Promise<BodyMeasurementRow | null>,
): Promise<BodyMeasurementRow[]> {
  if (measurements.some((m) => m.weight_kg !== null)) return measurements;

  const { data: row } = await anyClient
    .from('consultation_responses')
    .select('responses, submitted_at')
    .eq('client_id', userId)
    .maybeSingle();

  if (!row?.responses || !Array.isArray(row.responses)) return measurements;

  const responses = row.responses as ConsultationAnswer[];
  const weightRaw = responses.find((r) => r.label === 'Peso actual (kg)')?.answer;
  const sexRaw = responses.find((r) => r.label === 'Sexo')?.answer;
  const weightStr = typeof weightRaw === 'string' ? weightRaw : '';
  const weight = Number.parseFloat(weightStr.replace(',', '.'));
  const gender =
    sexRaw === 'Masculino' ? ('male' as const)
    : sexRaw === 'Femenino' ? ('female' as const)
    : null;

  if (!Number.isFinite(weight) || weight <= 0 || !gender) return measurements;

  const date =
    typeof row.submitted_at === 'string'
      ? toISODate(new Date(row.submitted_at))
      : todayISO();

  const saved = await upsert(mergeMeasurementFields(undefined, { gender, weight_kg: weight }, userId, date));
  if (!saved) return measurements;

  const rest = measurements.filter((m) => m.id !== saved.id);
  return [saved, ...rest].sort((a, b) => (a.date < b.date ? 1 : -1));
}
