import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type {
  ExerciseRow,
  ProgramRow,
  TrainingDayRow,
  WorkoutExerciseRow,
  WorkoutRow,
} from '@reset-fitness/shared/types/database';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { useTranslation } from '@/hooks/useTranslation';
import { localizedExercise } from '@/lib/exerciseI18n';
import { CardMenu } from '@/components/CardMenu';
import { ConfirmDialog } from '@/components/ui';
import { addDaysIso as addDays, fmtEsAr as fmt, isCurrentProgram, parseIsoDateLocal, resolveActiveProgramKey, todayIso } from '@/lib/activeProgram';

type CatalogExercise = Pick<ExerciseRow, 'id' | 'name' | 'target_muscles' | 'metadata'>;
type WorkoutExerciseWithExercise = WorkoutExerciseRow & { exercise: CatalogExercise | null };
type DayWithWorkout = TrainingDayRow & {
  workout: (WorkoutRow & { exercises: WorkoutExerciseWithExercise[] }) | null;
};

/** Columna derecha del tab Entrenamiento (estilo Hevy): arriba la card del
 * programa ACTIVO con su detalle día por día y un menú de tres puntos
 * (Editar / Reemplazar / Copiar a mi biblioteca / Quitar); abajo la card de
 * "Programas anteriores". El programa activo se resuelve en vivo (misma
 * lógica que resolve_active_program_key en la base). */
export function ClientProgramPanel({ clientId }: { clientId: string }): React.JSX.Element {
  const { profile: trainerProfile } = useAuth();
  const { showToast } = useToast();
  const { language } = useTranslation();
  const navigate = useNavigate();

  const [templates, setTemplates] = useState<ProgramRow[]>([]);
  const [clientName, setClientName] = useState('');
  const [programs, setPrograms] = useState<ProgramRow[]>([]);
  const [days, setDays] = useState<DayWithWorkout[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<ProgramRow | null>(null);
  const [replaceTarget, setReplaceTarget] = useState<ProgramRow | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
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
    setClientName((clientRow as { full_name: string | null } | null)?.full_name ?? '');
    setPrograms((programRows as ProgramRow[] | null) ?? []);
    setLoading(false);
  };

  useEffect(() => { void load(); }, [trainerProfile?.id, clientId]);

  const activeKey = useMemo(() => resolveActiveProgramKey(programs), [programs]);

  const { active, others } = useMemo(() => {
    const today = todayIso();
    let active: ProgramRow | null = null;
    const others: { program: ProgramRow; tag?: string }[] = [];
    for (const p of programs) {
      if (!active && !p.archived_at && p.program_key === activeKey) { active = p; continue; }
      let tag: string | undefined;
      if (p.archived_at) tag = undefined;
      else if (!p.start_date || !p.duration_weeks) tag = 'Sin fecha';
      else if (p.start_date > today) tag = 'Agendado';
      others.push({ program: p, tag });
    }
    // Agendados primero, después sin fecha, después los ya terminados.
    others.sort((a, b) => rank(a.tag) - rank(b.tag));
    return { active, others };
  }, [programs, activeKey]);

  // Detalle día por día del programa activo.
  useEffect(() => {
    if (!active) { setDays([]); return; }
    void (async () => {
      const { data: phaseRows } = await supabase
        .from('training_phases').select('id').eq('program_key', active.program_key).order('sort_order').limit(1);
      const phaseId = ((phaseRows as { id: string }[] | null) ?? [])[0]?.id;
      if (!phaseId) { setDays([]); return; }
      const { data: dayRows } = await supabase
        .from('training_days')
        .select('*, workout:workouts(*, exercises:workout_exercises(sort_order, *, exercise:exercises(id, name, target_muscles, metadata)))')
        .eq('phase_id', phaseId)
        .order('day_number');
      setDays(((dayRows ?? []) as unknown as DayWithWorkout[]).map((d) => ({
        ...d,
        workout: d.workout ? { ...d.workout, exercises: [...d.workout.exercises].sort((a, b) => a.sort_order - b.sort_order) } : null,
      })));
    })();
  // active identity changes when programs reload
  }, [active?.id]);

  const weekInfo = useMemo(() => {
    if (!active?.start_date || !active.duration_weeks) return null;
    const start = parseIsoDateLocal(active.start_date);
    const diffDays = Math.floor((Date.now() - start.getTime()) / 86400000);
    const week = Math.min(active.duration_weeks, Math.max(1, Math.floor(diffDays / 7) + 1));
    return `Semana ${week} de ${active.duration_weeks}`;
  }, [active]);

  // ── Acciones ──────────────────────────────────────────────────
  const assignProgram = async (program: ProgramRow): Promise<string | null> => {
    if (assigning) return null;
    setAssigning(true);
    const cloneName = clientName ? `${program.name} for ${clientName}` : program.name;
    const { data: newId, error } = await supabase.rpc('clone_program', {
      p_program_id: program.id, p_new_name: cloneName, p_client_id: clientId,
    });
    setAssigning(false);
    if (error || !newId) { showToast('error', 'No pudimos asignar el programa.'); return null; }
    showToast('success', 'Programa asignado.');
    void load();
    return newId as string;
  };

  const deleteClientProgram = async (program: ProgramRow) => {
    const { data: phaseRows } = await supabase.from('training_phases').select('id').eq('program_key', program.program_key);
    const phaseIds = ((phaseRows as { id: string }[] | null) ?? []).map((p) => p.id);
    if (phaseIds.length > 0) {
      const { data: dayRows } = await supabase.from('training_days').select('id, workout_id').in('phase_id', phaseIds);
      const workoutIds = ((dayRows as { id: string; workout_id: string | null }[] | null) ?? [])
        .map((d) => d.workout_id).filter((id): id is string => !!id);
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
      p_program_id: program.id, p_new_name: `${program.name} (copia)`, p_client_id: null,
    });
    showToast(error ? 'error' : 'success', error ? 'No pudimos copiar el programa.' : 'Programa copiado a "Mi biblioteca".');
  };

  const currentPrograms = useMemo(() => programs.filter((p) => isCurrentProgram(p)), [programs]);

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

  const assignNew = (program: ProgramRow) => {
    setAssignOpen(false);
    if (!program.start_date && currentPrograms.length > 0) { setUnlimitedWarning(program); return; }
    void assignProgram(program);
  };

  const confirmUnlimitedAssign = async () => {
    if (!unlimitedWarning) return;
    const program = unlimitedWarning;
    setUnlimitedWarning(null);
    const ids = currentPrograms.map((p) => p.id);
    if (ids.length > 0) await supabase.from('programs').update({ archived_at: new Date().toISOString() }).in('id', ids);
    await assignProgram(program);
  };

  if (loading) return <div className="card"><p className="muted" style={{ margin: 0 }}>Cargando programa…</p></div>;

  return (
    <>
      {/* ── Card: Programa activo ── */}
      {active && (
        <ActiveCard
          program={active}
          weekInfo={weekInfo}
          days={days}
          language={language}
          onEdit={() => navigate(`/programs/${active.id}`)}
          onReplace={() => setReplaceTarget(active)}
          onCopy={() => void copyToLibrary(active)}
          onRemove={() => setRemoveTarget(active)}
        />
      )}

      {!active && (
        <div className="card">
          <div className="section-title" style={{ marginBottom: 6 }}>Programa activo</div>
          <p className="muted" style={{ margin: '0 0 12px' }}>Este cliente no tiene un programa activo para hoy.</p>
          <button type="button" className="btn secondary sm" onClick={() => setAssignOpen(true)}>Asignar programa</button>
        </div>
      )}

      {/* ── Card: Programas anteriores ── */}
      {others.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="section-title" style={{ marginBottom: 4 }}>Historial de programas</div>
          <p className="muted" style={{ margin: '0 0 8px', fontSize: 11.5 }}>No son el programa activo hoy — quedan acá para poder revisarlos.</p>
          {others.map(({ program, tag }) => (
            <ProgramRowItem
              key={program.id}
              program={program}
              tag={tag}
              onEdit={() => navigate(`/programs/${program.id}`)}
              onReplace={() => setReplaceTarget(program)}
              onCopy={() => void copyToLibrary(program)}
              onRemove={() => setRemoveTarget(program)}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!removeTarget}
        title="Quitar programa"
        message={`¿Quitar "${removeTarget?.name}" de este cliente? Se borra esta copia del programa y sus rutinas (los días y ejercicios planificados). El historial de entrenamientos que el cliente ya completó NO se borra.`}
        confirmLabel="Quitar" cancelLabel="Cancelar" danger
        onCancel={() => setRemoveTarget(null)}
        onConfirm={() => void confirmRemove()}
      />

      <ConfirmDialog
        open={!!unlimitedWarning}
        title="Asignar programa sin fecha"
        message={`"${unlimitedWarning?.name}" queda ilimitado (sin fecha de fin). Como el cliente no puede tener más de un programa activo a la vez, esto archiva ${currentPrograms.length === 1 ? 'el programa vigente' : `los ${currentPrograms.length} programas vigentes`} y pasan a "Programas anteriores".`}
        confirmLabel="Asignar de todos modos" cancelLabel="Cancelar" danger
        onCancel={() => setUnlimitedWarning(null)}
        onConfirm={() => void confirmUnlimitedAssign()}
      />

      {(replaceTarget || assignOpen) && (
        <div className="invite-qr-backdrop" onClick={() => { setReplaceTarget(null); setAssignOpen(false); }}>
          <div className="assign-program-modal" style={{ width: 'min(420px, 92vw)' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>
              {replaceTarget ? `Reemplazar "${replaceTarget.name}"` : 'Asignar programa'}
            </div>
            <p className="muted" style={{ fontSize: 12.5, margin: '0 0 14px' }}>
              {replaceTarget
                ? 'Elegí el programa nuevo — conserva la misma fecha/duración y se borra el anterior.'
                : 'Elegí un programa de tu biblioteca para asignárselo a este cliente.'}
            </p>
            <SearchableAssign
              templates={templates}
              assigning={assigning}
              buttonLabel={replaceTarget ? 'Reemplazar' : 'Asignar'}
              onAssign={(program) => (replaceTarget ? void doReplace(program) : assignNew(program))}
            />
          </div>
        </div>
      )}
    </>
  );
}

function rank(tag?: string): number {
  if (tag === 'Agendado') return 0;
  if (tag === 'Sin fecha') return 1;
  return 2;
}

// ── Card del programa activo (nombre + semana + kebab + días) ──
function ActiveCard({
  program, weekInfo, days, language, onEdit, onReplace, onCopy, onRemove,
}: {
  program: ProgramRow;
  weekInfo: string | null;
  days: DayWithWorkout[];
  language: 'es' | 'en';
  onEdit: () => void; onReplace: () => void; onCopy: () => void; onRemove: () => void;
}): React.JSX.Element {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="card apd-card">
      <div className="apd-head">
        <button type="button" className="apd-title-btn" onClick={onEdit}>{program.name}</button>
        <div className="apd-head-right">
          {weekInfo && <span className="apd-week">{weekInfo}</span>}
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
      </div>

      {days.length === 0 ? (
        <p className="muted" style={{ margin: '12px 0 0' }}>Este programa todavía no tiene rutinas.</p>
      ) : (
        <div className="apd-days">
          {days.map((d) => (
            <div key={d.id} className="apd-day">
              <div className="apd-day-name">Día {d.day_number}{d.title ? ` - ${d.title}` : ''}</div>
              {d.workout && d.workout.exercises.length > 0 ? (
                <p className="apd-day-exs">
                  {d.workout.exercises.map((we) => {
                    const name = we.exercise ? localizedExercise(we.exercise, language).name : 'Ejercicio';
                    return `${we.sets ?? 1} × ${name}`;
                  }).join(', ')}
                </p>
              ) : (
                <p className="apd-day-exs">Descanso</p>
              )}
            </div>
          ))}
        </div>
      )}

      <style>{`
        .apd-card { padding: 0; overflow: hidden; }
        .apd-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 16px 18px; border-bottom: 1px solid var(--border); }
        .apd-title-btn { background: none; border: none; padding: 0; font-size: 15px; font-weight: 700; color: var(--text-primary); cursor: pointer; text-align: left; letter-spacing: -0.01em; }
        .apd-title-btn:hover { color: var(--accent-text); }
        .apd-head-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
        .apd-week { font-size: 12.5px; color: var(--text-tertiary); white-space: nowrap; }
        .apd-days { max-height: 460px; overflow-y: auto; padding: 4px 18px 14px; }
        .apd-day { padding: 12px 0; border-bottom: 1px solid var(--border); }
        .apd-day:last-child { border-bottom: none; }
        .apd-day-name { font-weight: 700; font-size: 13.5px; margin-bottom: 4px; }
        .apd-day-exs { margin: 0; font-size: 12.5px; line-height: 1.6; color: var(--text-tertiary); }
      `}</style>
    </div>
  );
}

// ── Fila de "Programas anteriores" ──
function ProgramRowItem({
  program, tag, onEdit, onReplace, onCopy, onRemove,
}: {
  program: ProgramRow;
  tag?: string;
  onEdit: () => void; onReplace: () => void; onCopy: () => void; onRemove: () => void;
}): React.JSX.Element {
  const [menuOpen, setMenuOpen] = useState(false);
  const dateRange = program.start_date && program.duration_weeks
    ? `${fmt(parseIsoDateLocal(program.start_date))} – ${fmt(addDays(program.start_date, program.duration_weeks * 7 - 1))}`
    : null;
  return (
    <div
      role="button" tabIndex={0} onClick={onEdit}
      onKeyDown={(e) => { if (e.key === 'Enter') onEdit(); }}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '9px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 650, fontSize: 13.5 }}>{program.name}</span>
          {tag && (
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em', color: 'var(--text-tertiary)' }}>{tag}</span>
          )}
        </div>
        <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{dateRange ?? 'Sin fecha — ilimitado'}</div>
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

// ── Selector buscable de programas de la biblioteca ──
function SearchableAssign({
  templates, assigning, onAssign, buttonLabel = 'Asignar',
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
          className="inline-select" style={{ width: '100%' }}
          placeholder="Buscar programa…"
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
                <button key={t.id} type="button" className="searchable-assign-item"
                  onClick={() => { setSelected(t); setQuery(''); setOpen(false); }}>
                  {t.name}
                </button>
              ))
            )}
          </div>
        )}
      </div>
      <button type="button" className="btn primary sm" disabled={!selected || assigning}
        onClick={() => { if (selected) { onAssign(selected); setSelected(null); setQuery(''); } }}>
        {assigning ? '…' : buttonLabel}
      </button>
      <style>{`
        .searchable-assign-pop { position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 20; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; box-shadow: 0 8px 24px rgba(0,0,0,0.15); max-height: 220px; overflow-y: auto; padding: 4px; }
        .searchable-assign-item { display: block; width: 100%; text-align: left; background: none; border: none; cursor: pointer; padding: 8px 10px; font-size: 13px; border-radius: 6px; color: var(--text-primary); }
        .searchable-assign-item:hover { background: var(--surface-hover, rgba(0,0,0,0.04)); }
        .searchable-assign-empty { padding: 8px 10px; font-size: 12.5px; color: var(--text-tertiary); }
      `}</style>
    </div>
  );
}
