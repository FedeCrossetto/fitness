import { useEffect, useMemo, useState } from 'react';
import type { ProfileRow, ProgramRow } from '@reset-fitness/shared/types/database';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { resolveAvatarUrl, initials } from '@/lib/avatarUrl';
import { ConfirmDialog } from '@/components/ui';

type ClientOption = Pick<ProfileRow, 'id' | 'full_name' | 'avatar_url'>;
type AssignedProgramInfo = Pick<ProgramRow, 'id' | 'name' | 'start_date' | 'duration_weeks' | 'archived_at'>;

/** "Vigente" = no archivado y (sin fecha, o todavía no terminó). Son los
 * programas que compiten por ser "el activo hoy" de ese cliente. */
function isCurrent(p: AssignedProgramInfo, today: Date): boolean {
  if (p.archived_at) return false;
  if (!p.start_date || !p.duration_weeks) return true;
  const start = parseIsoDateLocal(p.start_date);
  const end = new Date(start);
  end.setDate(end.getDate() + p.duration_weeks * 7);
  return end > today;
}

const DURATION_OPTIONS = [4, 6, 8, 12, 16];
const WEEKDAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseIsoDateLocal(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

function monthGrid(monthDate: Date): Date[] {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const first = new Date(year, month, 1);
  // Lunes=0 ... Domingo=6
  const firstWeekday = (first.getDay() + 6) % 7;
  const start = addDays(first, -firstWeekday);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

function formatShort(d: Date): string {
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
}

/** Asigna un programa de la librería a uno o más clientes — SIEMPRE clona el
 * programa (una copia individual por cliente vía el RPC clone_program), como
 * "Copy Program to Clients" de Hevy. Un cliente puede tener varios programas
 * agendados en simultáneo (rangos de fecha distintos) — se bloquea únicamente
 * si el rango elegido se superpone con uno ya agendado de ese cliente. El
 * programa "activo hoy" de cada cliente lo resuelve la base automáticamente
 * (ver resolve_active_program_key). */
export function AssignProgramModal({
  program,
  onClose,
}: {
  program: ProgramRow;
  onClose: () => void;
}): React.JSX.Element {
  const { profile: trainerProfile } = useAuth();
  const { showToast } = useToast();
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [programsByClient, setProgramsByClient] = useState<Map<string, AssignedProgramInfo[]>>(new Map());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const [scheduleEnabled, setScheduleEnabled] = useState(true);
  const [durationWeeks, setDurationWeeks] = useState<number>(program.duration_weeks ?? 6);
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const [unlimitedWarning, setUnlimitedWarning] = useState(false);

  const load = async () => {
    if (!trainerProfile?.id) return;
    const { data: clientRows } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .eq('trainer_id', trainerProfile.id)
      .order('full_name');
    const clientList = (clientRows as ClientOption[] | null) ?? [];
    setClients(clientList);

    if (clientList.length > 0) {
      const { data: progRows } = await supabase
        .from('programs')
        .select('id, client_id, name, start_date, duration_weeks, archived_at')
        .in('client_id', clientList.map((c) => c.id));
      const map = new Map<string, AssignedProgramInfo[]>();
      for (const row of (progRows as (AssignedProgramInfo & { client_id: string })[] | null) ?? []) {
        const list = map.get(row.client_id) ?? [];
        list.push(row);
        map.set(row.client_id, list);
      }
      for (const list of map.values()) list.sort((a, b) => (a.start_date ?? '').localeCompare(b.start_date ?? ''));
      setProgramsByClient(map);
    }
    setLoading(false);
  };

  useEffect(() => { void load(); }, [trainerProfile?.id]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) => (c.full_name ?? '').toLowerCase().includes(q));
  }, [clients, search]);

  const withoutProgram = useMemo(
    () => filtered.filter((c) => (programsByClient.get(c.id)?.length ?? 0) === 0),
    [filtered, programsByClient],
  );
  const withProgram = useMemo(
    () => filtered.filter((c) => (programsByClient.get(c.id)?.length ?? 0) > 0),
    [filtered, programsByClient],
  );

  // Rango propuesto (celeste) — se actualiza en vivo con duración/fecha.
  const previewRange = useMemo(() => {
    if (!scheduleEnabled) return null;
    return { start: startDate, end: addDays(startDate, durationWeeks * 7) };
  }, [scheduleEnabled, startDate, durationWeeks]);

  // Rangos ya agendados de los clientes SELECCIONADOS (naranja).
  const blockedRanges = useMemo(() => {
    const ranges: { start: Date; end: Date }[] = [];
    for (const clientId of selected) {
      for (const info of programsByClient.get(clientId) ?? []) {
        if (info.archived_at || !info.start_date || !info.duration_weeks) continue;
        const start = parseIsoDateLocal(info.start_date);
        ranges.push({ start, end: addDays(start, info.duration_weeks * 7) });
      }
    }
    return ranges;
  }, [selected, programsByClient]);

  const rangesOverlap = (a: { start: Date; end: Date }, b: { start: Date; end: Date }) => a.start < b.end && b.start < a.end;

  const isBlocked = (day: Date) =>
    blockedRanges.some((r) => day >= new Date(r.start.toDateString()) && day < new Date(r.end.toDateString()));

  const isPreviewing = (day: Date) =>
    !!previewRange && day >= new Date(previewRange.start.toDateString()) && day < new Date(previewRange.end.toDateString());

  // Bloquea la confirmación si el rango elegido choca con algún programa ya
  // agendado de CUALQUIER cliente seleccionado.
  const hasConflict = useMemo(() => {
    if (!previewRange) return false;
    return blockedRanges.some((r) => rangesOverlap(previewRange, r));
  }, [previewRange, blockedRanges]);

  // Programas vigentes de los clientes seleccionados — si se asigna un
  // programa SIN FECHA (ilimitado), estos se archivan (pasan a "Programas
  // anteriores") porque un cliente no puede tener más de un programa activo
  // a la vez.
  const currentProgramIdsByClient = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const map = new Map<string, string[]>();
    for (const id of selected) {
      const ids = (programsByClient.get(id) ?? []).filter((p) => isCurrent(p, today)).map((p) => p.id);
      if (ids.length > 0) map.set(id, ids);
    }
    return map;
  }, [selected, programsByClient]);

  const assign = async () => {
    if (selected.size === 0 || saving || hasConflict) return;
    setSaving(true);
    const isoStart = toIsoDate(startDate);
    await Promise.all(
      Array.from(selected).map(async (id) => {
        const client = clients.find((c) => c.id === id);
        const cloneName = client?.full_name ? `${program.name} for ${client.full_name}` : program.name;
        const { data: newId, error } = await supabase.rpc('clone_program', {
          p_program_id: program.id,
          p_new_name: cloneName,
          p_client_id: id,
        });
        if (error || !newId) return;
        const update: Partial<ProgramRow> = scheduleEnabled
          ? { start_date: isoStart, duration_weeks: durationWeeks }
          : { start_date: null };
        await supabase.from('programs').update(update).eq('id', newId);
        if (!scheduleEnabled) {
          const toArchive = currentProgramIdsByClient.get(id);
          if (toArchive && toArchive.length > 0) {
            await supabase.from('programs').update({ archived_at: new Date().toISOString() }).in('id', toArchive);
          }
        }
        // profiles.assigned_program_key se recalcula solo (trigger en `programs`).
      }),
    );
    setSaving(false);
    showToast('success', `Programa copiado a ${selected.size} cliente${selected.size === 1 ? '' : 's'}.`);
    onClose();
  };

  const onAssignClick = () => {
    if (!scheduleEnabled && currentProgramIdsByClient.size > 0) {
      setUnlimitedWarning(true);
      return;
    }
    void assign();
  };

  const days = monthGrid(calendarMonth);
  const monthLabel = calendarMonth.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });

  return (
    <div className="invite-qr-backdrop" onClick={onClose}>
      <div className="assign-program-modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <div style={{ fontWeight: 700, fontSize: 17 }}>Copiar programa a clientes</div>
          <button type="button" className="btn secondary sm" onClick={onClose}>✕</button>
        </div>
        <p className="muted" style={{ fontSize: 12.5, margin: '0 0 16px' }}>
          Copiar "{program.name}" a un cliente crea una copia individual del programa para cada uno. Un cliente puede
          tener varios programas agendados en simultáneo (con fechas distintas) — esta copia se suma a las que ya tenga.
        </p>

        <div className="assign-program-body">
          <div className="assign-program-clients">
            <div className="search-field" style={{ marginBottom: 12 }}>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar cliente" />
            </div>

            {loading ? (
              <p className="muted">Cargando clientes…</p>
            ) : clients.length === 0 ? (
              <p className="muted">Todavía no tenés clientes.</p>
            ) : (
              <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                {withoutProgram.length > 0 && (
                  <>
                    <div className="assign-program-section-label">Clientes sin programa asignado</div>
                    {withoutProgram.map((c) => (
                      <ClientRow key={c.id} client={c} checked={selected.has(c.id)} onToggle={() => toggle(c.id)} />
                    ))}
                  </>
                )}
                {withProgram.length > 0 && (
                  <>
                    <div className="assign-program-section-label" style={{ marginTop: 14 }}>Clientes con programa asignado</div>
                    {withProgram.map((c) => (
                      <ClientRow
                        key={c.id}
                        client={c}
                        checked={selected.has(c.id)}
                        onToggle={() => toggle(c.id)}
                        assignedPrograms={programsByClient.get(c.id) ?? []}
                      />
                    ))}
                  </>
                )}
              </div>
            )}
          </div>

          <div className="assign-program-schedule">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ fontWeight: 650 }}>Agendar</span>
              <button
                type="button"
                className={`assign-toggle${scheduleEnabled ? ' on' : ''}`}
                onClick={() => setScheduleEnabled((v) => !v)}
                aria-pressed={scheduleEnabled}
              >
                <span className="assign-toggle-knob" />
              </button>
            </div>

            {scheduleEnabled ? (
              <>
                <div className="assign-program-section-label">Duración</div>
                <select
                  className="inline-select"
                  style={{ width: '100%', marginBottom: 14 }}
                  value={durationWeeks}
                  onChange={(e) => setDurationWeeks(Number(e.target.value))}
                >
                  {DURATION_OPTIONS.map((w) => (
                    <option key={w} value={w}>{w} semanas</option>
                  ))}
                </select>

                <div className="assign-program-section-label">Fecha de inicio</div>
                <div className="assign-calendar">
                  <div className="assign-calendar-nav">
                    <button type="button" onClick={() => setCalendarMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}>‹</button>
                    <span style={{ textTransform: 'capitalize' }}>{monthLabel}</span>
                    <button type="button" onClick={() => setCalendarMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}>›</button>
                  </div>
                  <div className="assign-calendar-grid assign-calendar-weekdays">
                    {WEEKDAY_LABELS.map((w, i) => <span key={i}>{w}</span>)}
                  </div>
                  <div className="assign-calendar-grid">
                    {days.map((day, i) => {
                      const inMonth = day.getMonth() === calendarMonth.getMonth();
                      const isSelectedDay = toIsoDate(day) === toIsoDate(startDate);
                      const blocked = isBlocked(day);
                      const previewing = isPreviewing(day);
                      const conflict = blocked && previewing;
                      const cls = [
                        'assign-calendar-day',
                        !inMonth && 'dim',
                        isSelectedDay && 'selected',
                        conflict ? 'conflict' : blocked ? 'blocked' : previewing ? 'previewing' : '',
                      ].filter(Boolean).join(' ');
                      return (
                        <button key={i} type="button" className={cls} onClick={() => setStartDate(day)}>
                          {day.getDate()}
                        </button>
                      );
                    })}
                  </div>
                  <div className="assign-calendar-legend">
                    <span><i className="dot previewing" /> Este programa</span>
                    <span><i className="dot blocked" /> Ya agendado</span>
                  </div>
                  {hasConflict && (
                    <p className="assign-conflict-msg">
                      La fecha elegida se superpone con un programa ya agendado de un cliente seleccionado. Cambiá la
                      fecha, la duración, o deseleccioná ese cliente.
                    </p>
                  )}
                </div>
              </>
            ) : (
              <p className="muted" style={{ fontSize: 12.5 }}>
                Sin fecha de inicio ni duración — la copia queda ilimitada y no bloquea el calendario de otros programas.
              </p>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <button type="button" className="btn secondary" onClick={onClose}>Cancelar</button>
          <button type="button" className="btn primary" disabled={selected.size === 0 || saving || hasConflict} onClick={onAssignClick}>
            {saving ? 'Copiando…' : `Copiar programa${selected.size > 0 ? ` (${selected.size})` : ''}`}
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={unlimitedWarning}
        title="Asignar programa sin fecha"
        message={`"${program.name}" queda ilimitado (sin fecha de fin). Como un cliente no puede tener más de un programa activo a la vez, esto archiva el programa vigente de ${currentProgramIdsByClient.size === 1 ? 'ese cliente' : `esos ${currentProgramIdsByClient.size} clientes`} y pasa a "Programas anteriores".`}
        confirmLabel="Asignar de todos modos"
        cancelLabel="Cancelar"
        danger
        onCancel={() => setUnlimitedWarning(false)}
        onConfirm={() => { setUnlimitedWarning(false); void assign(); }}
      />

      <style>{`
        .assign-program-modal {
          background: var(--surface); border-radius: 16px; padding: 24px;
          width: min(760px, 92vw); max-height: 88vh; overflow-y: auto;
        }
        .assign-program-body { display: grid; grid-template-columns: 1.2fr 1fr; gap: 24px; }
        .assign-program-section-label { font-size: 11.5px; font-weight: 700; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.04em; margin: 6px 0; }
        .assign-toggle { width: 40px; height: 24px; border-radius: 999px; border: none; background: var(--border-strong); position: relative; cursor: pointer; padding: 0; transition: background-color 0.15s; }
        .assign-toggle.on { background: var(--accent, #3b82f6); }
        .assign-toggle-knob { position: absolute; top: 2px; left: 2px; width: 20px; height: 20px; border-radius: 50%; background: #fff; transition: transform 0.15s; }
        .assign-toggle.on .assign-toggle-knob { transform: translateX(16px); }
        .assign-calendar-nav { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; font-size: 13px; font-weight: 600; }
        .assign-calendar-nav button { background: none; border: none; cursor: pointer; font-size: 16px; color: var(--text-secondary); }
        .assign-calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
        .assign-calendar-weekdays { margin-bottom: 4px; text-align: center; font-size: 11px; color: var(--text-tertiary); }
        .assign-calendar-day { border: none; background: none; padding: 6px 0; font-size: 12.5px; border-radius: 6px; cursor: pointer; color: var(--text-primary); }
        .assign-calendar-day.dim { color: var(--text-tertiary); opacity: 0.5; }
        .assign-calendar-day.previewing { background: rgba(56, 189, 248, 0.28); color: #075985; font-weight: 650; }
        .assign-calendar-day.blocked { background: rgba(249,115,22,0.18); color: #f97316; }
        .assign-calendar-day.conflict { background: rgba(239,68,68,0.28); color: #b91c1c; font-weight: 650; box-shadow: inset 0 0 0 1.5px rgba(239,68,68,0.6); }
        .assign-calendar-day.selected { background: var(--accent, #3b82f6); color: var(--accent-contrast, #fff); }
        .assign-calendar-legend { display: flex; gap: 14px; margin-top: 10px; font-size: 11.5px; color: var(--text-tertiary); }
        .assign-calendar-legend .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 5px; vertical-align: middle; }
        .assign-calendar-legend .dot.previewing { background: rgb(56, 189, 248); }
        .assign-calendar-legend .dot.blocked { background: #f97316; }
        .assign-conflict-msg { margin: 10px 0 0; font-size: 12px; color: #b91c1c; line-height: 1.5; }
        @media (max-width: 640px) { .assign-program-body { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
}

function ClientRow({
  client,
  checked,
  onToggle,
  assignedPrograms,
}: {
  client: ClientOption;
  checked: boolean;
  onToggle: () => void;
  assignedPrograms?: AssignedProgramInfo[];
}): React.JSX.Element {
  const resolved = resolveAvatarUrl(client.avatar_url);
  return (
    <label className="client-row-menu-item" style={{ cursor: 'pointer', alignItems: 'flex-start' }}>
      <input type="checkbox" checked={checked} onChange={onToggle} style={{ marginRight: 4, marginTop: 3 }} />
      {resolved ? (
        <span className="avatar sm" style={{ padding: 0, overflow: 'hidden', flexShrink: 0 }}>
          <img src={resolved} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} />
        </span>
      ) : (
        <span className="avatar sm" style={{ flexShrink: 0 }}>{initials(client.full_name)}</span>
      )}
      <span style={{ flex: 1, minWidth: 0 }}>
        {client.full_name ?? 'Alumno'}
        {assignedPrograms && assignedPrograms.length > 0 && (
          <div style={{ marginTop: 2 }}>
            {assignedPrograms.map((p) => (
              <div key={p.id} className="muted" style={{ fontSize: 11, lineHeight: 1.6 }}>
                {p.name}
                {p.start_date && p.duration_weeks ? (
                  <> · {formatShort(parseIsoDateLocal(p.start_date))} – {formatShort(addDays(parseIsoDateLocal(p.start_date), p.duration_weeks * 7 - 1))}</>
                ) : (
                  <> · sin fecha</>
                )}
              </div>
            ))}
          </div>
        )}
      </span>
    </label>
  );
}
