import { supabase } from '../lib/supabase';
import { addDays, todayISO } from '../lib/dates';

export interface TrophyStats {
  /** Total de días con todas las metas cumplidas */
  total: number;
  /** Días consecutivos con trofeo (hacia atrás desde hoy o ayer) */
  currentStreak: number;
  /** Últimos 7 días (dom → sáb): true si hay trofeo ese día */
  lastWeek: boolean[];
  /** Fechas ISO con trofeo en la ventana consultada */
  dates: string[];
}

function computeTrophyStreak(sortedDatesDesc: string[]): number {
  if (sortedDatesDesc.length === 0) return 0;

  const today = todayISO();
  const yesterday = addDays(today, -1);
  const newest = sortedDatesDesc[0];
  if (newest !== today && newest !== yesterday) return 0;

  let streak = 1;
  for (let i = 1; i < sortedDatesDesc.length; i++) {
    if (addDays(sortedDatesDesc[i]!, 1) === sortedDatesDesc[i - 1]) streak++;
    else break;
  }
  return streak;
}

/** Lunes → domingo de la semana calendario actual */
function buildLastWeek(dateSet: Set<string>): boolean[] {
  const today = todayISO();
  const jsDay = new Date(`${today}T12:00:00`).getDay();
  const mondayOffset = jsDay === 0 ? -6 : 1 - jsDay;
  const week: boolean[] = [];
  for (let i = 0; i < 7; i++) {
    week.push(dateSet.has(addDays(today, mondayOffset + i)));
  }
  return week;
}

export async function getTrophyStats(userId: string): Promise<TrophyStats> {
  const since = new Date();
  since.setDate(since.getDate() - 90);
  const sinceISO = since.toISOString().slice(0, 10);

  const [{ count, error: countErr }, { data, error: dataErr }] = await Promise.all([
    supabase
      .from('user_trophy_days')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId),
    supabase
      .from('user_trophy_days')
      .select('date')
      .eq('user_id', userId)
      .gte('date', sinceISO)
      .order('date', { ascending: false }),
  ]);

  if (countErr) throw countErr;
  if (dataErr) throw dataErr;

  const dates = (data ?? []).map((r) => r.date);
  const dateSet = new Set(dates);

  return {
    total: count ?? 0,
    currentStreak: computeTrophyStreak(dates),
    lastWeek: buildLastWeek(dateSet),
    dates,
  };
}

/** ¿Ya hay trofeo para hoy? */
export async function hasTrophyToday(userId: string): Promise<boolean> {
  const today = todayISO();
  const { data, error } = await supabase
    .from('user_trophy_days')
    .select('id')
    .eq('user_id', userId)
    .eq('date', today)
    .maybeSingle();

  if (error) throw error;
  return data != null;
}
