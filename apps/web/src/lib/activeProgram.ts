/** Fechas de `programs` son `date` (YYYY-MM-DD) — parsearlas con `new Date(iso)`
 * las lee como UTC medianoche y se corren un día en zonas UTC-negativas
 * (Argentina). Todo el módulo trabaja en fecha LOCAL. */
export function parseIsoDateLocal(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDaysIso(iso: string, days: number): Date {
  const d = parseIsoDateLocal(iso);
  d.setDate(d.getDate() + days);
  return d;
}

export function todayIso(): string {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

export function fmtEsAr(d: Date): string {
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export interface ProgramForResolve {
  id: string;
  program_key: string;
  start_date: string | null;
  duration_weeks: number | null;
  archived_at?: string | null;
  created_at: string;
}

/** Replica en el cliente la lógica de `resolve_active_program_key` (SQL) para
 * que el panel del coach (web) muestre siempre el programa activo de HOY sin
 * depender de `profiles.assigned_program_key` cacheado, que solo se
 * recalcula cuando se escribe en `programs` — si un programa agendado
 * termina y nadie edita nada ese día, la columna cacheada queda vieja. */
export function resolveActiveProgramKey(programs: ProgramForResolve[]): string | null {
  const today = parseIsoDateLocal(todayIso());
  const dated = programs
    .filter((p) => !p.archived_at && p.start_date && p.duration_weeks)
    .filter((p) => {
      const start = parseIsoDateLocal(p.start_date!);
      const end = addDaysIso(p.start_date!, p.duration_weeks! * 7);
      return today >= start && today < end;
    })
    .sort((a, b) => (b.start_date ?? '').localeCompare(a.start_date ?? ''));
  if (dated.length > 0) return dated[0].program_key;

  const unscheduled = programs
    .filter((p) => !p.archived_at && !p.start_date)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  return unscheduled[0]?.program_key ?? null;
}

/** "Vigente" = no archivado y no ya terminado (agendado con fecha pasada).
 * Son los programas que hay que archivar cuando se asigna uno nuevo sin
 * fecha (ilimitado), para que dejen de competir por ser el activo. */
export function isCurrentProgram(p: ProgramForResolve, today = todayIso()): boolean {
  if (p.archived_at) return false;
  if (!p.start_date || !p.duration_weeks) return true; // sin fecha = ilimitado, siempre vigente
  const end = addDaysIso(p.start_date, p.duration_weeks * 7);
  return end > parseIsoDateLocal(today);
}
