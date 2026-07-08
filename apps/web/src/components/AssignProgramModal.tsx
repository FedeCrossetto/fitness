import { useEffect, useMemo, useState } from 'react';
import type { ProfileRow, ProgramRow } from '@reset-fitness/shared/types/database';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { resolveAvatarUrl, initials } from '@/lib/avatarUrl';

type ClientOption = Pick<ProfileRow, 'id' | 'full_name' | 'avatar_url' | 'assigned_program_key'>;
type AssignedInfo = Pick<ProgramRow, 'program_key' | 'name' | 'start_date' | 'duration_weeks'>;

const DURATION_OPTIONS = [4, 6, 8, 12, 16];
const WEEKDAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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

/** Asigna un programa de la librería a uno o más clientes — SIEMPRE clona el
 * programa (una copia individual por cliente vía el RPC clone_program), como
 * "Copy Program to Clients" de Hevy. Con Schedule activado, además guarda
 * start_date/duration_weeks en la copia y bloquea ese rango en el calendario
 * de conflicto; sin Schedule ("unlimited") no bloquea nada. */
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
  const [assignedInfoByKey, setAssignedInfoByKey] = useState<Map<string, AssignedInfo>>(new Map());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const [scheduleEnabled, setScheduleEnabled] = useState(true);
  const [durationWeeks, setDurationWeeks] = useState<number>(program.duration_weeks ?? 6);
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());

  useEffect(() => {
    if (!trainerProfile?.id) return;
    void (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, assigned_program_key')
        .eq('trainer_id', trainerProfile.id)
        .order('full_name');
      const clientRows = (data as ClientOption[] | null) ?? [];
      setClients(clientRows);

      const keys = Array.from(new Set(clientRows.map((c) => c.assigned_program_key).filter((k): k is string => !!k)));
      if (keys.length > 0) {
        const { data: assignedRows } = await supabase
          .from('programs')
          .select('program_key, name, start_date, duration_weeks')
          .in('program_key', keys);
        const map = new Map<string, AssignedInfo>();
        for (const row of (assignedRows as AssignedInfo[] | null) ?? []) map.set(row.program_key, row);
        setAssignedInfoByKey(map);
      }
      setLoading(false);
    })();
  }, [trainerProfile?.id]);

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

  const withoutProgram = useMemo(() => filtered.filter((c) => !c.assigned_program_key), [filtered]);
  const withProgram = useMemo(() => filtered.filter((c) => !!c.assigned_program_key), [filtered]);

  // Rangos bloqueados por clientes seleccionados que ya tienen un programa
  // agendado (start_date + duration_weeks) — solo programas asignados con
  // Schedule activado bloquean; sin fecha de inicio, no bloquean nada.
  const blockedRanges = useMemo(() => {
    const ranges: { start: Date; end: Date }[] = [];
    for (const c of withProgram) {
      if (!selected.has(c.id) || !c.assigned_program_key) continue;
      const info = assignedInfoByKey.get(c.assigned_program_key);
      if (!info?.start_date || !info.duration_weeks) continue;
      const start = new Date(info.start_date);
      ranges.push({ start, end: addDays(start, info.duration_weeks * 7) });
    }
    return ranges;
  }, [withProgram, selected, assignedInfoByKey]);

  const isBlocked = (day: Date) =>
    blockedRanges.some((r) => day >= new Date(r.start.toDateString()) && day < new Date(r.end.toDateString()));

  const assign = async () => {
    if (selected.size === 0 || saving) return;
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
        const { data: cloned } = await supabase.from('programs').select('program_key').eq('id', newId).maybeSingle();
        const newKey = (cloned as { program_key: string } | null)?.program_key;
        if (newKey) await supabase.from('profiles').update({ assigned_program_key: newKey }).eq('id', id);
      }),
    );
    setSaving(false);
    showToast('success', `Programa copiado a ${selected.size} cliente${selected.size === 1 ? '' : 's'}.`);
    onClose();
  };

  const days = monthGrid(calendarMonth);
  const monthLabel = calendarMonth.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });

  return (
    <div className="invite-qr-backdrop" onClick={onClose}>
      <div className="assign-program-modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <div style={{ fontWeight: 700, fontSize: 17 }}>Copy Workout Program to Clients</div>
          <button type="button" className="btn secondary sm" onClick={onClose}>✕</button>
        </div>
        <p className="muted" style={{ fontSize: 12.5, margin: '0 0 16px' }}>
          Copying "{program.name}" to a client will create individual copies of the program for each client. This
          copy can be edited through the client's program page.
        </p>

        <div className="assign-program-body">
          <div className="assign-program-clients">
            <div className="search-field" style={{ marginBottom: 12 }}>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search Client" />
            </div>

            {loading ? (
              <p className="muted">Cargando clientes…</p>
            ) : clients.length === 0 ? (
              <p className="muted">Todavía no tenés clientes.</p>
            ) : (
              <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                {withoutProgram.length > 0 && (
                  <>
                    <div className="assign-program-section-label">Clients without an assigned Program</div>
                    {withoutProgram.map((c) => (
                      <ClientRow key={c.id} client={c} checked={selected.has(c.id)} onToggle={() => toggle(c.id)} />
                    ))}
                  </>
                )}
                {withProgram.length > 0 && (
                  <>
                    <div className="assign-program-section-label" style={{ marginTop: 14 }}>Clients with an assigned Program</div>
                    {withProgram.map((c) => (
                      <ClientRow
                        key={c.id}
                        client={c}
                        checked={selected.has(c.id)}
                        onToggle={() => toggle(c.id)}
                        subLabel={c.assigned_program_key ? assignedInfoByKey.get(c.assigned_program_key)?.name : undefined}
                      />
                    ))}
                  </>
                )}
              </div>
            )}
          </div>

          <div className="assign-program-schedule">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ fontWeight: 650 }}>Schedule</span>
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
                <div className="assign-program-section-label">Duration</div>
                <select
                  className="inline-select"
                  style={{ width: '100%', marginBottom: 14 }}
                  value={durationWeeks}
                  onChange={(e) => setDurationWeeks(Number(e.target.value))}
                >
                  {DURATION_OPTIONS.map((w) => (
                    <option key={w} value={w}>{w} weeks</option>
                  ))}
                </select>

                <div className="assign-program-section-label">Start Date</div>
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
                      const isSelected = toIsoDate(day) === toIsoDate(startDate);
                      const blocked = isBlocked(day);
                      return (
                        <button
                          key={i}
                          type="button"
                          className={`assign-calendar-day${inMonth ? '' : ' dim'}${isSelected ? ' selected' : ''}${blocked ? ' blocked' : ''}`}
                          onClick={() => setStartDate(day)}
                        >
                          {day.getDate()}
                        </button>
                      );
                    })}
                  </div>
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
          <button type="button" className="btn primary" disabled={selected.size === 0 || saving} onClick={() => void assign()}>
            {saving ? 'Copiando…' : `Copy Program${selected.size > 0 ? ` (${selected.size})` : ''}`}
          </button>
        </div>
      </div>

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
        .assign-calendar-day.blocked { background: rgba(249,115,22,0.18); color: #f97316; }
        .assign-calendar-day.selected { background: var(--accent, #3b82f6); color: #fff; }
        @media (max-width: 640px) { .assign-program-body { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
}

function ClientRow({
  client,
  checked,
  onToggle,
  subLabel,
}: {
  client: ClientOption;
  checked: boolean;
  onToggle: () => void;
  subLabel?: string;
}): React.JSX.Element {
  const resolved = resolveAvatarUrl(client.avatar_url);
  return (
    <label className="client-row-menu-item" style={{ cursor: 'pointer' }}>
      <input type="checkbox" checked={checked} onChange={onToggle} style={{ marginRight: 4 }} />
      {resolved ? (
        <span className="avatar sm" style={{ padding: 0, overflow: 'hidden' }}>
          <img src={resolved} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} />
        </span>
      ) : (
        <span className="avatar sm">{initials(client.full_name)}</span>
      )}
      <span style={{ flex: 1 }}>
        {client.full_name ?? 'Alumno'}
        {subLabel ? <div className="muted" style={{ fontSize: 11 }}>{subLabel}</div> : null}
      </span>
    </label>
  );
}
