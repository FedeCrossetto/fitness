/** Helpers de fechas en hora local (las columnas `date` de la DB usan fecha local del usuario). */

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

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MONTH_NAMES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

export function formatLongDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()} de ${MONTH_NAMES[d.getMonth()]}`;
}

export function formatShortDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

export function formatTime(isoTimestamp: string): string {
  const d = new Date(isoTimestamp);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function greetingForNow(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Buen día';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

const DAY_ABBR = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'] as const;
const MONTH_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'] as const;

/** Info de un día para el strip de calendario. */
export function getDayInfo(iso: string): {
  dayNum: number;
  dayAbbr: string;
  monthShort: string;
  year: number;
} {
  const d = new Date(`${iso}T12:00:00`);
  return {
    dayNum: d.getDate(),
    dayAbbr: DAY_ABBR[d.getDay()]!,
    monthShort: MONTH_SHORT[d.getMonth()]!,
    year: d.getFullYear(),
  };
}

/** Genera un array de ISO dates de [start..end] días desde hoy. */
export function buildDateRange(before: number, after: number): string[] {
  const result: string[] = [];
  const today = new Date();
  for (let i = -before; i <= after; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    result.push(toISODate(d));
  }
  return result;
}

/** Formatea "17 de junio" desde un ISO date. */
export function formatDayMonth(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return `${d.getDate()} de ${MONTH_NAMES[d.getMonth()]}`;
}
