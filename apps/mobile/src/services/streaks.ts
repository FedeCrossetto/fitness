import { supabase } from '../lib/supabase';
import { addDays, todayISO } from '../lib/dates';
import { getTrophyStats } from './trophies';

export interface StreakInfo {
  current: number;
  /** Días activos de los últimos 7 (para visualización semanal) */
  lastWeek: boolean[];
}

export interface Achievement {
  key: string;
  title: string;
  description: string;
  achieved: boolean;
  icon: string;
}

/** Racha = días consecutivos (hasta hoy) con al menos un workout_log o meal_log. */
export async function computeStreak(userId: string): Promise<StreakInfo> {
  const since = addDays(todayISO(), -60);
  const [workoutsRes, mealsRes] = await Promise.all([
    supabase.from('workout_logs').select('date').eq('user_id', userId).gte('date', since),
    supabase.from('meal_logs').select('date').eq('user_id', userId).gte('date', since),
  ]);

  const activeDays = new Set<string>([
    ...(workoutsRes.data ?? []).map((r) => r.date),
    ...(mealsRes.data ?? []).map((r) => r.date),
  ]);

  let current = 0;
  let cursor = todayISO();
  // Si hoy todavía no registró nada, la racha cuenta desde ayer.
  if (!activeDays.has(cursor)) cursor = addDays(cursor, -1);
  while (activeDays.has(cursor)) {
    current += 1;
    cursor = addDays(cursor, -1);
  }

  const lastWeek: boolean[] = [];
  for (let i = 6; i >= 0; i -= 1) {
    lastWeek.push(activeDays.has(addDays(todayISO(), -i)));
  }

  return { current, lastWeek };
}

export async function computeAchievements(userId: string): Promise<Achievement[]> {
  const [workoutsRes, mealsRes, hydrationRes, streak, trophyStats] = await Promise.all([
    supabase.from('workout_logs').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('meal_logs').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('hydration_logs').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    computeStreak(userId),
    getTrophyStats(userId),
  ]);

  const workouts = workoutsRes.count ?? 0;
  const meals = mealsRes.count ?? 0;
  const hydrationDays = hydrationRes.count ?? 0;

  return [
    { key: 'first-trophy', title: 'Primer trofeo', description: 'Completaste todas tus metas en un día', achieved: trophyStats.total >= 1, icon: 'trophy' },
    { key: 'trophy-7', title: 'Coleccionista', description: '7 días con todas las metas cumplidas', achieved: trophyStats.total >= 7, icon: 'trophy' },
    { key: 'trophy-30', title: 'Campeón', description: '30 trofeos acumulados', achieved: trophyStats.total >= 30, icon: 'medal' },
    { key: 'trophy-streak-3', title: 'Racha perfecta x3', description: '3 días seguidos con trofeo', achieved: trophyStats.currentStreak >= 3, icon: 'flame' },
    { key: 'trophy-streak-7', title: 'Semana impecable', description: '7 días seguidos con trofeo', achieved: trophyStats.currentStreak >= 7, icon: 'flame' },
    { key: 'first-workout', title: 'Primer entreno', description: 'Completaste tu primera sesión', achieved: workouts >= 1, icon: 'barbell' },
    { key: 'ten-workouts', title: 'Constancia de hierro', description: '10 entrenamientos completados', achieved: workouts >= 10, icon: 'barbell' },
    { key: 'first-meal', title: 'Primera comida', description: 'Registraste tu primera comida', achieved: meals >= 1, icon: 'restaurant' },
    { key: 'fifty-meals', title: 'Nutrición pro', description: '50 comidas registradas', achieved: meals >= 50, icon: 'nutrition' },
    { key: 'hydration-week', title: 'Semana hidratada', description: '7 días registrando agua', achieved: hydrationDays >= 7, icon: 'water' },
    { key: 'streak-3', title: 'Racha activa x3', description: '3 días seguidos registrando actividad', achieved: streak.current >= 3, icon: 'flash' },
    { key: 'streak-7', title: 'Racha activa x7', description: 'Una semana registrando actividad', achieved: streak.current >= 7, icon: 'flash' },
  ];
}
