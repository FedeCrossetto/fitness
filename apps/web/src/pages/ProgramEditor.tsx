import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type {
  ExerciseRow,
  ProgramRow,
  TrainingDayRow,
  TrainingPhaseRow,
  WorkoutExerciseRow,
  WorkoutRow,
} from '@reset-fitness/shared/types/database';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { Spinner } from '@/components/ui';
import { PlusIcon } from '@/components/icons';
import { AssignProgramModal } from '@/components/AssignProgramModal';

type CatalogExercise = Pick<ExerciseRow, 'id' | 'name' | 'image_url' | 'target_muscles'>;
type WorkoutExerciseWithExercise = WorkoutExerciseRow & { exercise: CatalogExercise | null };
type DayWithWorkout = TrainingDayRow & {
  workout: (WorkoutRow & { exercises: WorkoutExerciseWithExercise[] }) | null;
};

/** Un programa nuevo siempre tiene una única fase contenedora (invisible acá) —
 * ver comentario en la migración 20260708010000_program_library.sql. Si por
 * algún motivo no existe todavía, se crea al cargar. */
export function ProgramEditorPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const { session } = useAuth();
  const trainerId = session?.user.id ?? null;
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [program, setProgram] = useState<ProgramRow | null>(null);
  const [phaseId, setPhaseId] = useState<string | null>(null);
  const [days, setDays] = useState<DayWithWorkout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);

  const [nameDraft, setNameDraft] = useState('');
  const [noteDraft, setNoteDraft] = useState('');
  const [durationDraft, setDurationDraft] = useState('');

  const load = useCallback(async () => {
    if (!id || !trainerId) return;
    try {
      const { data: programRow, error: pErr } = await supabase.from('programs').select('*').eq('id', id).maybeSingle();
      if (pErr) throw pErr;
      if (!programRow) { setError('Programa no encontrado.'); setLoading(false); return; }
      const p = programRow as ProgramRow;
      setProgram(p);
      setNameDraft(p.name);
      setNoteDraft(p.note ?? '');
      setDurationDraft(p.duration_weeks ? String(p.duration_weeks) : '');

      let { data: phaseRows } = await supabase
        .from('training_phases')
        .select('*')
        .eq('program_key', p.program_key)
        .order('sort_order')
        .limit(1);
      let phase = ((phaseRows as TrainingPhaseRow[] | null) ?? [])[0];
      if (!phase) {
        const { data: created } = await supabase
          .from('training_phases')
          .insert({ program_key: p.program_key, trainer_id: trainerId, phase_number: 1, name: p.name, sort_order: 0, is_active: true })
          .select()
          .single();
        phase = created as TrainingPhaseRow;
      }
      setPhaseId(phase.id);

      const { data: dayRows, error: dErr } = await supabase
        .from('training_days')
        .select('*, workout:workouts(*, exercises:workout_exercises(sort_order, *, exercise:exercises(id, name, image_url, target_muscles)))')
        .eq('phase_id', phase.id)
        .order('day_number');
      if (dErr) throw dErr;
      setDays((dayRows ?? []) as unknown as DayWithWorkout[]);
      setError(null);
    } catch {
      setError('No pudimos cargar el programa.');
    } finally {
      setLoading(false);
    }
  }, [id, trainerId]);

  useEffect(() => { void load(); }, [load]);

  const saveProgramField = async (patch: Partial<Pick<ProgramRow, 'name' | 'note' | 'duration_weeks'>>) => {
    if (!program) return;
    await supabase.from('programs').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', program.id);
    setProgram((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const addRoutine = async () => {
    if (!trainerId || !phaseId) return;
    const nextNumber = days.reduce((m, d) => Math.max(m, d.day_number), 0) + 1;
    const { data: workout, error: wErr } = await supabase
      .from('workouts')
      .insert({ trainer_id: trainerId, title: `Rutina ${nextNumber}`, workout_type: 'fuerza', blocks: 1 })
      .select('id')
      .single();
    if (wErr || !workout) return;
    await supabase.from('training_days').insert({
      phase_id: phaseId,
      day_number: nextNumber,
      title: `Rutina ${nextNumber}`,
      day_type: 'fuerza',
      workout_id: (workout as { id: string }).id,
      sort_order: days.length,
    });
    await load();
  };

  const deleteRoutine = async (day: DayWithWorkout) => {
    if (!confirm('¿Eliminar esta rutina?')) return;
    if (day.workout) await supabase.from('workout_exercises').delete().eq('workout_id', day.workout.id);
    await supabase.from('training_days').delete().eq('id', day.id);
    if (day.workout) await supabase.from('workouts').delete().eq('id', day.workout.id);
    await load();
  };

  const renameRoutine = async (dayId: string, title: string) => {
    await supabase.from('training_days').update({ title }).eq('id', dayId);
    setDays((prev) => prev.map((d) => (d.id === dayId ? { ...d, title } : d)));
  };

  const duplicateProgram = async () => {
    if (!program) return;
    const { data: newId, error: cloneErr } = await supabase.rpc('clone_program', {
      p_program_id: program.id,
      p_new_name: `${program.name} (copia)`,
      p_client_id: null,
    });
    if (cloneErr || !newId) { showToast('error', 'No pudimos duplicar el programa.'); return; }
    showToast('success', 'Programa duplicado.');
    navigate(`/programs/${newId}`);
  };

  // ── Resumen: total real de ejercicios/sets + distribución muscular real
  // (a partir de exercise.target_muscles), sin gráfico de radar — ver
  // conversación de scope: "puede quedar con data mockeada", acá va con
  // data real pero visualización simple (tabla), no el spider chart de Hevy.
  const summary = useMemo(() => {
    let totalExercises = 0;
    let totalSets = 0;
    const muscleCount = new Map<string, number>();
    for (const day of days) {
      for (const we of day.workout?.exercises ?? []) {
        totalExercises += 1;
        const sets = we.sets ?? 0;
        totalSets += sets;
        for (const muscle of we.exercise?.target_muscles ?? []) {
          muscleCount.set(muscle, (muscleCount.get(muscle) ?? 0) + sets);
        }
      }
    }
    const muscleRows = Array.from(muscleCount.entries()).sort((a, b) => b[1] - a[1]);
    return { totalExercises, totalSets, muscleRows };
  }, [days]);

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}><Spinner size={28} /></div>;
  if (error || !program) return <div><Link to="/programs" className="back-link">← Volver a programas</Link><div className="empty-state"><div className="t">{error ?? 'Programa no encontrado'}</div></div></div>;

  const sortedDays = [...days].sort((a, b) => a.day_number - b.day_number);

  return (
    <div>
      <Link to="/programs" className="back-link">← Volver a programas</Link>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, alignItems: 'start', marginTop: 8 }}>
        <div>
          <div className="row-between" style={{ marginBottom: 16 }}>
            <h1 className="page-title" style={{ margin: 0 }}>Editar Programa</h1>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn secondary sm" onClick={() => void duplicateProgram()}>Duplicar programa</button>
              <button type="button" className="btn primary sm" onClick={() => setAssignOpen(true)}>Asignar programa</button>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <div className="add-client-section-label">Título del programa</div>
            <input
              className="add-client-email-input"
              style={{ width: '100%', marginBottom: 14 }}
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={() => nameDraft.trim() && nameDraft !== program.name && void saveProgramField({ name: nameDraft.trim() })}
            />
            <div style={{ display: 'flex', gap: 14 }}>
              <div style={{ flex: 1 }}>
                <div className="add-client-section-label">Duración (semanas)</div>
                <input
                  className="add-client-email-input"
                  style={{ width: '100%' }}
                  type="number"
                  min={1}
                  value={durationDraft}
                  onChange={(e) => setDurationDraft(e.target.value)}
                  onBlur={() => {
                    const n = Number(durationDraft) || null;
                    if (n !== program.duration_weeks) void saveProgramField({ duration_weeks: n });
                  }}
                />
              </div>
            </div>
            <div style={{ marginTop: 14 }}>
              <div className="add-client-section-label">Nota del programa</div>
              <textarea
                className="add-client-email-input"
                style={{ width: '100%', minHeight: 70, resize: 'vertical' }}
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                onBlur={() => noteDraft !== (program.note ?? '') && void saveProgramField({ note: noteDraft || null })}
              />
            </div>
          </div>

          <div className="row-between" style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Rutinas <span className="clients-tab-count" style={{ marginLeft: 6 }}>{sortedDays.length}</span></div>
            <button type="button" className="btn primary sm" onClick={() => void addRoutine()}>
              <PlusIcon size={14} /> Agregar rutina
            </button>
          </div>

          {sortedDays.length === 0 ? (
            <div className="card"><p className="muted" style={{ margin: 0 }}>Este programa no tiene rutinas todavía.</p></div>
          ) : (
            sortedDays.map((day) => (
              <RoutineCard
                key={day.id}
                day={day}
                onOpen={() => navigate(`/routines/${day.id}`)}
                onRename={(title) => void renameRoutine(day.id, title)}
                onDelete={() => void deleteRoutine(day)}
              />
            ))
          )}
        </div>

        <div className="card">
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Resumen</div>
          <SummaryRow label="Total de ejercicios" value={summary.totalExercises} />
          <SummaryRow label="Total de series" value={summary.totalSets} />
          {summary.muscleRows.length > 0 && (
            <>
              <div style={{ fontWeight: 650, fontSize: 12.5, color: 'var(--text-tertiary)', marginTop: 18, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                Series por grupo muscular
              </div>
              {summary.muscleRows.map(([muscle, sets]) => (
                <div key={muscle} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{muscle}</span>
                  <span style={{ fontWeight: 600 }}>{sets}</span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {assignOpen && <AssignProgramModal program={program} onClose={() => setAssignOpen(false)} />}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: number }): React.JSX.Element {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
      <span className="muted" style={{ fontSize: 13 }}>{label}</span>
      <span style={{ fontWeight: 700, fontSize: 15 }}>{value}</span>
    </div>
  );
}

function RoutineCard({
  day,
  onOpen,
  onRename,
  onDelete,
}: {
  day: DayWithWorkout;
  onOpen: () => void;
  onRename: (title: string) => void;
  onDelete: () => void;
}): React.JSX.Element {
  const [title, setTitle] = useState(day.title);
  const exercises = [...(day.workout?.exercises ?? [])].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="card" style={{ marginBottom: 12, cursor: 'pointer' }} onClick={onOpen}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <input
          className="inline-input"
          style={{ fontWeight: 650, fontSize: 14.5 }}
          value={title}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title.trim() && title !== day.title && onRename(title.trim())}
        />
        <button
          type="button"
          className="icon-btn sm"
          title="Eliminar rutina"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
        >
          ✕
        </button>
      </div>
      {exercises.length === 0 ? (
        <p className="muted" style={{ margin: '10px 0 0', fontSize: 12.5 }}>Sin ejercicios — abrí la rutina para agregarlos.</p>
      ) : (
        <div className="muted" style={{ marginTop: 8, fontSize: 12.5, lineHeight: 1.7 }}>
          {exercises.map((we) => `${we.sets ?? 0}× ${we.exercise?.name ?? 'Ejercicio'}`).join(' · ')}
        </div>
      )}
    </div>
  );
}
