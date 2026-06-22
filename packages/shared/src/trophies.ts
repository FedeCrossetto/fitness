/** Helpers de trofeos (días con todas las metas cumplidas). */

export type TrophyRankPeriod = 'all' | '30d' | 'month';

export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/** Racha activa: días consecutivos con trofeo hacia atrás desde hoy o ayer. */
export function computeTrophyStreak(sortedDatesDesc: string[]): number {
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

export function periodStartDate(period: TrophyRankPeriod): string | null {
  if (period === 'all') return null;
  const today = todayISO();
  if (period === '30d') return addDays(today, -29);
  const d = new Date(`${today}T12:00:00`);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

export function filterTrophyDatesInPeriod(dates: string[], period: TrophyRankPeriod): string[] {
  const start = periodStartDate(period);
  if (!start) return dates;
  return dates.filter((d) => d >= start);
}

export interface TrophyLeaderboardClient {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

export interface TrophyLeaderboardEntry {
  userId: string;
  name: string;
  avatarUrl: string | null;
  total: number;
  currentStreak: number;
  rank: number;
}

export function buildTrophyLeaderboard(
  clients: TrophyLeaderboardClient[],
  rows: { user_id: string; date: string }[],
  period: TrophyRankPeriod,
  defaultName: string,
  locale = 'es-AR',
): TrophyLeaderboardEntry[] {
  const byUser = new Map<string, string[]>();
  for (const row of rows) {
    const list = byUser.get(row.user_id) ?? [];
    list.push(row.date);
    byUser.set(row.user_id, list);
  }

  return clients
    .map((p) => {
      const allDates = [...(byUser.get(p.id) ?? [])].sort((a, b) => b.localeCompare(a));
      const periodDates = filterTrophyDatesInPeriod(allDates, period);
      return {
        userId: p.id,
        name: p.full_name ?? defaultName,
        avatarUrl: p.avatar_url,
        total: periodDates.length,
        currentStreak: computeTrophyStreak(allDates),
        rank: 0,
      };
    })
    .sort(
      (a, b) =>
        b.total - a.total
        || b.currentStreak - a.currentStreak
        || a.name.localeCompare(b.name, locale),
    )
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}
