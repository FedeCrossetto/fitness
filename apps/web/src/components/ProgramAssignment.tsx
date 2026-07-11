import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ProgramRow } from '@reset-fitness/shared/types/database';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';

function addDays(iso: string, days: number): Date {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d;
}
function fmt(d: Date): string {
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
}
function todayIso(): string {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

/** Programas de este cliente — puede tener varios en simultáneo (rangos de
 * fecha distintos). El "activo hoy" lo resuelve la base sola (ver
 * resolve_active_program_key); acá los agrupamos en Activo / Próximos /
 * Programas anteriores (esta última es solo de lectura, no se puede borrar
 * — se arma sola con los que ya terminaron, para poder revisarlos). */
export function ProgramAssignment({ clientId }: { clientId: string }): React.JSX.Element {
  const { profile: trainerProfile } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [templates, setTemplates] = useState<ProgramRow[]>([]);
  const [clientName, setClientName] = useState('');
  const [programs, setPrograms] = useState<ProgramRow[]>([]);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectValue, setSelectValue] = useState('');
  const [assigning, setAssigning] = useState(false);

  const load = async () => {
    if (!trainerProfile?.id) return;
    setLoading(true);
    const [{ data: templateRows }, { data: clientRow }, { data: programRows }] = await Promise.all([
      supabase.from('programs').select('*').eq('trainer_id', trainerProfile.id).is('client_id', null).order('name'),
      supabase.from('profiles').select('full_name, assigned_program_key').eq('id', clientId).maybeSingle(),
      supabase.from('programs').select('*').eq('client_id', clientId).order('start_date', { ascending: true }),
    ]);
    setTemplates((templateRows as ProgramRow[] | null) ?? []);
    const client = clientRow as { full_name: string | null; assigned_program_key: string | null } | null;
    setClientName(client?.full_name ?? '');
    setActiveKey(client?.assigned_program_key ?? null);
    setPrograms((programRows as ProgramRow[] | null) ?? []);
    setLoading(false);
  };

  useEffect(() => { void load(); }, [trainerProfile?.id, clientId]);

  const { active, upcoming, past, unscheduled } = useMemo(() => {
    const today = todayIso();
    const active: ProgramRow[] = [];
    const upcoming: ProgramRow[] = [];
    const past: ProgramRow[] = [];
    const unscheduled: ProgramRow[] = [];
    for (const p of programs) {
      if (p.program_key === activeKey) { active.push(p); continue; }
      if (!p.start_date || !p.duration_weeks) { unscheduled.push(p); continue; }
      if (p.start_date > today) upcoming.push(p);
      else past.push(p); // no es la activa: o ya terminó, o quedó superpuesta por otro programa
    }
    return { active, upcoming, past, unscheduled };
  }, [programs, activeKey]);

  const assignProgram = async (program: ProgramRow) => {
    if (assigning) return;
    setAssigning(true);
    const cloneName = clientName ? `${program.name} for ${clientName}` : program.name;
    const { data: newId, error } = await supabase.rpc('clone_program', {
      p_program_id: program.id,
      p_new_name: cloneName,
      p_client_id: clientId,
    });
    if (error || !newId) {
      setAssigning(false);
      showToast('error', 'No pudimos asignar el programa.');
      return;
    }
    // profiles.assigned_program_key se recalcula solo (trigger en `programs`).
    setAssigning(false);
    setSelectValue('');
    showToast('success', 'Programa asignado.');
    void load();
  };

  if (loading) return <div className="card"><p className="muted" style={{ margin: 0 }}>Cargando programas…</p></div>;

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="section-title" style={{ marginBottom: 12 }}>Programa asignado</div>

      {active.length > 0 ? (
        active.map((p) => <ProgramLine key={p.id} program={p} tag="Activo hoy" tagColor="var(--good, #16a34a)" onEdit={() => navigate(`/programs/${p.id}`)} />)
      ) : (
        <p className="muted" style={{ margin: '0 0 12px' }}>
          {unscheduled.length > 0 || upcoming.length > 0
            ? 'Este cliente no tiene un programa activo para hoy (ver abajo sus otros programas).'
            : 'Este cliente todavía no tiene un programa asignado.'}
        </p>
      )}

      {upcoming.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div className="add-client-section-label">Próximos</div>
          {upcoming.map((p) => <ProgramLine key={p.id} program={p} tag="Agendado" tagColor="var(--text-tertiary)" onEdit={() => navigate(`/programs/${p.id}`)} />)}
        </div>
      )}

      {unscheduled.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div className="add-client-section-label">Sin fecha (ilimitados)</div>
          {unscheduled.map((p) => <ProgramLine key={p.id} program={p} onEdit={() => navigate(`/programs/${p.id}`)} />)}
        </div>
      )}

      {past.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div className="add-client-section-label">Programas anteriores</div>
          <p className="muted" style={{ margin: '0 0 8px', fontSize: 11.5 }}>No son el programa activo hoy — quedan acá para poder revisarlos.</p>
          {past.map((p) => <ProgramLine key={p.id} program={p} muted onEdit={() => navigate(`/programs/${p.id}`)} />)}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 16, alignItems: 'center' }}>
        <select
          className="inline-select"
          style={{ flex: 1 }}
          value={selectValue}
          onChange={(e) => setSelectValue(e.target.value)}
        >
          <option value="">Asignar otro programa…</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <button
          type="button"
          className="btn secondary sm"
          disabled={!selectValue || assigning}
          onClick={() => {
            const program = templates.find((t) => t.id === selectValue);
            if (program) void assignProgram(program);
          }}
        >
          {assigning ? 'Asignando…' : 'Asignar'}
        </button>
      </div>
    </div>
  );
}

function ProgramLine({
  program,
  tag,
  tagColor,
  muted,
  onEdit,
}: {
  program: ProgramRow;
  tag?: string;
  tagColor?: string;
  muted?: boolean;
  onEdit: () => void;
}): React.JSX.Element {
  const dateRange = program.start_date && program.duration_weeks
    ? `${fmt(new Date(program.start_date))} – ${fmt(addDays(program.start_date, program.duration_weeks * 7 - 1))}`
    : null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ minWidth: 0, opacity: muted ? 0.65 : 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 650, fontSize: 14 }}>{program.name}</span>
          {tag && (
            <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em', color: tagColor ?? 'var(--text-tertiary)' }}>
              {tag}
            </span>
          )}
        </div>
        <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
          {dateRange ?? 'Sin fecha — ilimitado'}
        </div>
      </div>
      <button type="button" className="btn secondary sm" onClick={onEdit}>Editar</button>
    </div>
  );
}
