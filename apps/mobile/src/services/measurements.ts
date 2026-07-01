import { anyClient } from '../lib/supabase';
import type { BodyMeasurementRow } from '../types/database';
import { toISODate, todayISO } from '../lib/dates';

type ConsultationAnswer = { label: string; answer: string | string[] };

type MeasureField = 'weight_kg' | 'body_fat_pct' | 'chest_cm' | 'waist_cm' | 'hips_cm' | 'arms_cm' | 'legs_cm';

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
    chest_cm: pick('chest_cm'),
    waist_cm: pick('waist_cm'),
    hips_cm: pick('hips_cm'),
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

  const saved = await upsert({ user_id: userId, date, gender, weight_kg: weight, body_fat_pct: null, chest_cm: null, waist_cm: null, hips_cm: null, arms_cm: null, legs_cm: null });
  if (!saved) return measurements;

  const rest = measurements.filter((m) => m.id !== saved.id);
  return [saved, ...rest].sort((a, b) => (a.date < b.date ? 1 : -1));
}
