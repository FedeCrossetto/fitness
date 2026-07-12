import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ProgramRow } from '@reset-fitness/shared/types/database';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { CardMenu } from '@/components/CardMenu';
import { ConfirmDialog } from '@/components/ui';
import { addDaysIso as addDays, fmtEsAr as fmt, isCurrentProgram, parseIsoDateLocal, resolveActiveProgramKey, todayIso } from '@/lib/activeProgram';

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
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<ProgramRow | null>(null);
  const [replaceTarget, setReplaceTarget] = useState<ProgramRow | null>(null);
  const [unlimitedWarning, setUnlimitedWarning] = useState<ProgramRow | null>(null);

  const load = async () => {
    if (!trainerProfile?.id) return;
    setLoading(true);
    const [{ data: templateRows }, { data: clientRow }, { data: programRows }] = await Promise.all([
      supabase.from('programs').select('*').eq('trainer_id', trainerProfile.id).is('client_id', null).order('name'),
      supabase.from('profiles').select('full_name').eq('id', clientId).maybeSingle(),
      supabase.from('programs').select('*').eq('client_id', clientId).order('start_date', { ascending: true }),
    ]);
    setTemplates((templateRows as ProgramRow[] | null) ?? []);
    const client = clientRow as { full_name: string | null } | null;
    setClientName(client?.full_name ?? '');
    setPrograms((programRows as ProgramRow[] | null) ?? []);
    setLoading(false);
  };

  useEffect(() => { void load(); }, [trainerProfile?.id, clientId]);

  // "Activo hoy" se calcula EN VIVO acá (misma lógica que resolve_active_program_key
  // en la base) en vez de leer profiles.assigned_program_key, que solo se
  // recalcula cuando se escribe en `programs` — si un programa agendado
  // termina y nadie edita nada ese día, la columna cacheada queda vieja.
  const activeKey = useMemo(() => resolveActiveProgramKey(programs), [programs]);

  const { active, upcoming, past, unscheduled } = useMemo(() => {
    const today = todayIso();
    const active: ProgramRow[] = [];
    const upcoming: ProgramRow[] = [];
    const past: ProgramRow[] = [];
    const unscheduled: ProgramRow[] = [];
    for (const p of programs) {
      if (p.archived_at) { past.push(p); continue; }
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
      return null;
    }
    // profiles.assigned_program_key se recalcula solo (trigger en `programs`).
    setAssigning(false);
    showToast('success', 'Programa asignado.');
    void load();
    return newId as string;
  };

  const deleteClientProgram = async (program: ProgramRow) => {
    const { data: phaseRows } = await supabase.from('training_phases').select('id').eq('program_key', program.program_key);
    const phaseIds = ((phaseRows as { id: string }[] | null) ?? []).map((p) => p.id);
    if (phaseIds.length > 0) {
      const { data: dayRows } = await supabase.from('training_days').select('id, workout_id').in('phase_id', phaseIds);
      const dayList = (dayRows as { id: string; workout_id: string | null }[] | null) ?? [];
      const workoutIds = dayList.map((d) => d.workout_id).filter((id): id is string => !!id);
      if (workoutIds.length > 0) {
        await supabase.from('workout_exercises').delete().in('workout_id', workoutIds);
        await supabase.from('workouts').delete().in('id', workoutIds);
      }
      await supabase.from('training_days').delete().in('phase_id', phaseIds);
      await supabase.from('training_phases').delete().in('id', phaseIds);
    }
    await supabase.from('programs').delete().eq('id', program.id);
  };

  const confirmRemove = async () => {
    if (!removeTarget) return;
    await deleteClientProgram(removeTarget);
    setRemoveTarget(null);
    showToast('success', 'Programa quitado.');
    void load();
  };

  const copyToLibrary = async (program: ProgramRow) => {
    const { error } = await supabase.rpc('clone_program', {
      p_program_id: program.id,
      p_new_name: `${program.name} (copia)`,
      p_client_id: null,
    });
    if (error) {
      showToast('error', 'No pudimos copiar el programa a tu biblioteca.');
      return;
    }
    showToast('success', 'Programa copiado a "Mi biblioteca".');
  };

  // Programas vigentes (no archivados y que todavía no terminaron, sin
  // importar si ganaron o no el desempate de "activo hoy") — los que hay
  // que archivar cuando se asigna un programa nuevo SIN FECHA, para que
  // ninguno siga compitiendo por ser el activo.
  const currentPrograms = useMemo(() => programs.filter((p) => isCurrentProgram(p)), [programs]);

  const archiveCurrentPrograms = async () => {
    const ids = currentPrograms.map((p) => p.id);
    if (ids.length === 0) return;
    await supabase.from('programs').update({ archived_at: new Date().toISOString() }).in('id', ids);
  };

  const assignFromBottomSelector = (program: ProgramRow) => {
    if (!program.start_date && currentPrograms.length > 0) {
      setUnlimitedWarning(program);
      return;
    }
    void assignProgram(program);
  };

  const confirmUnlimitedAssign = async () => {
    if (!unlimitedWarning) return;
    const program = unlimitedWarning;
    setUnlimitedWarning(null);
    await archiveCurrentPrograms();
    await assignProgram(program);
  };

  const doReplace = async (newTemplate: ProgramRow) => {
    if (!replaceTarget) return;
    const old = replaceTarget;
    setReplaceTarget(null);
    const newId = await assignProgram(newTemplate);
    if (!newId) return;
    if (old.start_date && old.duration_weeks) {
      await supabase.from('programs').update({ start_date: old.start_date, duration_weeks: old.duration_weeks }).eq('id', newId);
    }
    await deleteClientProgram(old);
    showToast('success', 'Programa reemplazado.');
    void load();
  };

  if (loading) return <div className="card"><p className="muted" style={{ margin: 0 }}>Cargando programas…</p></div>;

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="section-title" style={{ marginBottom: 12 }}>Programa asignado</div>

      {active.length > 0 ? (
        active.map((p) => (
          <ProgramLine
            key={p.id}
            program={p}
            tag="Activo hoy"
            tagColor="var(--good, #16a34a)"
            onEdit={() => navigate(`/programs/${p.id}`)}
            onRemove={() => setRemoveTarget(p)}
            onReplace={() => setReplaceTarget(p)}
            onCopy={() => void copyToLibrary(p)}
          />
        ))
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
          {upcoming.map((p) => (
            <ProgramLine
              key={p.id}
              program={p}
              tag="Agendado"
              tagColor="var(--text-tertiary)"
              onEdit={() => navigate(`/programs/${p.id}`)}
              onRemove={() => setRemoveTarget(p)}
              onReplace={() => setReplaceTarget(p)}
              onCopy={() => void copyToLibrary(p)}
            />
          ))}
        </div>
      )}

      {unscheduled.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div className="add-client-section-label">Sin fecha (ilimitados)</div>
          {unscheduled.map((p) => (
            <ProgramLine
              key={p.id}
              program={p}
              onEdit={() => navigate(`/programs/${p.id}`)}
              onRemove={() => setRemoveTarget(p)}
              onReplace={() => setReplaceTarget(p)}
              onCopy={() => void copyToLibrary(p)}
            />
          ))}
        </div>
      )}

      {past.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div className="add-client-section-label">Programas anteriores</div>
          <p className="muted" style={{ margin: '0 0 8px', fontSize: 11.5 }}>No son el programa activo hoy — quedan acá para poder revisarlos.</p>
          {past.map((p) => (
            <ProgramLine
              key={p.id}
              program={p}
              muted
              onEdit={() => navigate(`/programs/${p.id}`)}
              onRemove={() => setRemoveTarget(p)}
              onReplace={() => setReplaceTarget(p)}
              onCopy={() => void copyToLibrary(p)}
            />
          ))}
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <SearchableAssign
          templates={templates}
          assigning={assigning}
          onAssign={assignFromBottomSelector}
        />
      </div>

      <ConfirmDialog
        open={!!removeTarget}
        title="Quitar programa"
        message={`¿Quitar "${removeTarget?.name}" de este cliente? Se borra esta copia del programa y sus rutinas (los días y ejercicios planificados). El historial de entrenamientos que el cliente ya completó NO se borra.`}
        confirmLabel="Quitar"
        cancelLabel="Cancelar"
        danger
        onCancel={() => setRemoveTarget(null)}
        onConfirm={() => void confirmRemove()}
      />

      <ConfirmDialog
        open={!!unlimitedWarning}
        title="Asignar programa sin fecha"
        message={`"${unlimitedWarning?.name}" queda ilimitado (sin fecha de fin). Como el cliente no puede tener más de un programa activo a la vez, esto archiva ${currentPrograms.length === 1 ? 'el programa vigente' : `los ${currentPrograms.length} programas vigentes`} de este cliente y pasan a "Programas anteriores".`}
        confirmLabel="Asignar de todos modos"
        cancelLabel="Cancelar"
        danger
        onCancel={() => setUnlimitedWarning(null)}
        onConfirm={() => void confirmUnlimitedAssign()}
      />

      {replaceTarget && (
        <div className="invite-qr-backdrop" onClick={() => setReplaceTarget(null)}>
          <div className="assign-program-modal" style={{ width: 'min(420px, 92vw)' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Reemplazar "{replaceTarget.name}"</div>
            <p className="muted" style={{ fontSize: 12.5, margin: '0 0 14px' }}>
              Elegí el programa nuevo — conserva la misma fecha/duración y se borra el anterior.
            </p>
            <SearchableAssign
              templates={templates}
              assigning={assigning}
              onAssign={(program) => void doReplace(program)}
              buttonLabel="Reemplazar"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function SearchableAssign({
  templates,
  assigning,
  onAssign,
  buttonLabel = 'Asignar',
}: {
  templates: ProgramRow[];
  assigning: boolean;
  onAssign: (program: ProgramRow) => void;
  buttonLabel?: string;
}): React.JSX.Element {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<ProgramRow | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter((t) => t.name.toLowerCase().includes(q));
  }, [templates, query]);

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
      <div ref={boxRef} style={{ position: 'relative', flex: 1 }}>
        <input
          className="inline-select"
          style={{ width: '100%' }}
          placeholder="Asignar otro programa…"
          value={selected ? selected.name : query}
          onFocus={() => setOpen(true)}
          onChange={(e) => { setSelected(null); setQuery(e.target.value); setOpen(true); }}
        />
        {open && (
          <div className="searchable-assign-pop">
            {filtered.length === 0 ? (
              <div className="searchable-assign-empty">Sin resultados.</div>
            ) : (
              filtered.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="searchable-assign-item"
                  onClick={() => { setSelected(t); setQuery(''); setOpen(false); }}
                >
                  {t.name}
                </button>
              ))
            )}
          </div>
        )}
      </div>
      <button
        type="button"
        className="btn secondary sm"
        disabled={!selected || assigning}
        onClick={() => {
          if (!selected) return;
          onAssign(selected);
          setSelected(null);
          setQuery('');
        }}
      >
        {assigning ? 'Asignando…' : buttonLabel}
      </button>
      <style>{`
        .searchable-assign-pop {
          position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 20;
          background: var(--surface); border: 1px solid var(--border); border-radius: 10px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.15); max-height: 220px; overflow-y: auto; padding: 4px;
        }
        .searchable-assign-item {
          display: block; width: 100%; text-align: left; background: none; border: none; cursor: pointer;
          padding: 8px 10px; font-size: 13px; border-radius: 6px; color: var(--text-primary);
        }
        .searchable-assign-item:hover { background: var(--surface-hover, rgba(0,0,0,0.04)); }
        .searchable-assign-empty { padding: 8px 10px; font-size: 12.5px; color: var(--text-tertiary); }
      `}</style>
    </div>
  );
}

function ProgramLine({
  program,
  tag,
  tagColor,
  muted,
  onEdit,
  onRemove,
  onReplace,
  onCopy,
}: {
  program: ProgramRow;
  tag?: string;
  tagColor?: string;
  muted?: boolean;
  onEdit: () => void;
  onRemove: () => void;
  onReplace: () => void;
  onCopy: () => void;
}): React.JSX.Element {
  const [menuOpen, setMenuOpen] = useState(false);
  const dateRange = program.start_date && program.duration_weeks
    ? `${fmt(parseIsoDateLocal(program.start_date))} – ${fmt(addDays(program.start_date, program.duration_weeks * 7 - 1))}`
    : null;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onEdit}
      onKeyDown={(e) => { if (e.key === 'Enter') onEdit(); }}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
    >
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
      <CardMenu
        open={menuOpen}
        onToggle={() => setMenuOpen((v) => !v)}
        items={[
          { label: 'Editar', onClick: onEdit },
          { label: 'Reemplazar programa', onClick: onReplace },
          { label: 'Copiar a mi biblioteca', onClick: onCopy },
          { label: 'Quitar programa', onClick: onRemove, danger: true },
        ]}
      />
    </div>
  );
}
