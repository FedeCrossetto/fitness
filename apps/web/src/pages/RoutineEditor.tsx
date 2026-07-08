import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { ExerciseRow, TrainingDayRow, TrainingPhaseRow, WorkoutExerciseRow, WorkoutRow } from '@reset-fitness/shared/types/database';
import { supabase } from '@/lib/supabase';
import { Spinner } from '@/components/ui';
import { DumbbellIcon } from '@/components/icons';

type CatalogExercise = Pick<ExerciseRow, 'id' | 'name' | 'image_url' | 'target_muscles' | 'equipment'>;
type WorkoutExerciseWithExercise = WorkoutExerciseRow & { exercise: CatalogExercise | null };
type DayWithWorkout = TrainingDayRow & {
  workout: (WorkoutRow & { exercises: WorkoutExerciseWithExercise[] }) | null;
  phase: Pick<TrainingPhaseRow, 'program_key'> | null;
};

/** Editor de rutina de pantalla completa — título/nota + tabla de sets/reps/kg
 * por ejercicio a la izquierda, picker de ejercicios a la derecha. Look & feel:
 * app.hevycoach.com/routines/:id. */
export function RoutineEditorPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const [day, setDay] = useState<DayWithWorkout | null>(null);
  const [programId, setProgramId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const { data, error: dErr } = await supabase
        .from('training_days')
        .select('*, workout:workouts(*, exercises:workout_exercises(sort_order, *, exercise:exercises(id, name, image_url, target_muscles, equipment))), phase:training_phases(program_key)')
        .eq('id', id)
        .maybeSingle();
      if (dErr) throw dErr;
      if (!data) { setError('Rutina no encontrada.'); setLoading(false); return; }
      const row = data as unknown as DayWithWorkout;
      setDay(row);
      setTitleDraft(row.title);
      if (row.phase?.program_key) {
        const { data: programRow } = await supabase.from('programs').select('id').eq('program_key', row.phase.program_key).maybeSingle();
        setProgramId((programRow as { id: string } | null)?.id ?? null);
      }
      setError(null);
    } catch {
      setError('No pudimos cargar la rutina.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const saveTitle = async (title: string) => {
    if (!day || !title.trim() || title === day.title) return;
    await supabase.from('training_days').update({ title: title.trim() }).eq('id', day.id);
    setDay((prev) => (prev ? { ...prev, title: title.trim() } : prev));
  };

  const addExercise = async (exercise: CatalogExercise) => {
    if (!day?.workout) return;
    const nextOrder = day.workout.exercises?.length ?? 0;
    await supabase.from('workout_exercises').insert({
      workout_id: day.workout.id,
      exercise_id: exercise.id,
      sort_order: nextOrder,
      sets: 3,
      reps: '10',
    });
    await load();
  };

  const saveExercise = async (weId: string, patch: Partial<Pick<WorkoutExerciseRow, 'sets' | 'reps' | 'rest_seconds' | 'weight_kg'>>) => {
    await supabase.from('workout_exercises').update(patch).eq('id', weId);
  };

  const removeExercise = async (weId: string) => {
    await supabase.from('workout_exercises').delete().eq('id', weId);
    await load();
  };

  const moveExercise = async (from: number, to: number) => {
    if (!day?.workout) return;
    const items = [...day.workout.exercises].sort((a, b) => a.sort_order - b.sort_order);
    if (to < 0 || to >= items.length) return;
    const [removed] = items.splice(from, 1);
    items.splice(to, 0, removed);
    await Promise.all(items.map((it, idx) => supabase.from('workout_exercises').update({ sort_order: idx }).eq('id', it.id)));
    await load();
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}><Spinner size={28} /></div>;
  if (error || !day) {
    return (
      <div>
        <Link to="/programs" className="back-link">← Volver a programas</Link>
        <div className="empty-state"><div className="t">{error ?? 'Rutina no encontrada'}</div></div>
      </div>
    );
  }

  const exercises = [...(day.workout?.exercises ?? [])].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div>
      <Link to={programId ? `/programs/${programId}` : '/programs'} className="back-link">← Volver al programa</Link>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20, alignItems: 'start', marginTop: 8 }}>
        <div>
          <h1 className="page-title" style={{ marginBottom: 16 }}>Editar Rutina</h1>

          <div className="card" style={{ marginBottom: 16 }}>
            <div className="add-client-section-label">Título de la rutina</div>
            <input
              className="add-client-email-input"
              style={{ width: '100%' }}
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={() => void saveTitle(titleDraft)}
            />
          </div>

          {exercises.length === 0 ? (
            <div className="card"><p className="muted" style={{ margin: 0 }}>Todavía no agregaste ejercicios. Elegí uno del panel de la derecha.</p></div>
          ) : (
            exercises.map((we, index) => (
              <ExerciseCard
                key={we.id}
                we={we}
                index={index}
                count={exercises.length}
                onSave={(patch) => void saveExercise(we.id, patch)}
                onRemove={() => void removeExercise(we.id)}
                onMoveUp={() => void moveExercise(index, index - 1)}
                onMoveDown={() => void moveExercise(index, index + 1)}
              />
            ))
          )}
        </div>

        <ExercisePickerPanel onPick={(ex) => void addExercise(ex)} />
      </div>
    </div>
  );
}

function ExerciseCard({
  we,
  index,
  count,
  onSave,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  we: WorkoutExerciseWithExercise;
  index: number;
  count: number;
  onSave: (patch: Partial<Pick<WorkoutExerciseRow, 'sets' | 'reps' | 'rest_seconds' | 'weight_kg'>>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}): React.JSX.Element {
  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="ex-thumb ex-thumb-icon" aria-hidden><DumbbellIcon size={16} /></div>
          <span style={{ fontWeight: 650, fontSize: 14.5 }}>{we.exercise?.name ?? 'Ejercicio'}</span>
        </div>
        <div className="ex-move">
          <button type="button" className="icon-btn sm" title="Subir" disabled={index === 0} onClick={onMoveUp}>↑</button>
          <button type="button" className="icon-btn sm" title="Bajar" disabled={index === count - 1} onClick={onMoveDown}>↓</button>
          <button type="button" className="icon-btn sm" title="Quitar" onClick={onRemove}>✕</button>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Field label="Series" defaultValue={we.sets ?? ''} onBlurNum={(v) => onSave({ sets: v ?? 0 })} />
        <Field label="Reps" defaultValue={we.reps ?? ''} onBlurStr={(v) => onSave({ reps: v })} />
        <Field label="Peso (kg)" defaultValue={we.weight_kg ?? ''} onBlurNum={(v) => onSave({ weight_kg: v })} />
        <Field label="Descanso (seg)" defaultValue={we.rest_seconds ?? ''} onBlurNum={(v) => onSave({ rest_seconds: v })} />
      </div>
    </div>
  );
}

function Field({
  label,
  defaultValue,
  onBlurNum,
  onBlurStr,
}: {
  label: string;
  defaultValue: string | number;
  onBlurNum?: (v: number | null) => void;
  onBlurStr?: (v: string) => void;
}): React.JSX.Element {
  return (
    <div>
      <div className="add-client-section-label" style={{ marginBottom: 4 }}>{label}</div>
      <input
        className="add-client-email-input"
        style={{ width: 100 }}
        defaultValue={defaultValue}
        onBlur={(e) => {
          if (onBlurStr) onBlurStr(e.target.value);
          if (onBlurNum) onBlurNum(e.target.value === '' ? null : Number(e.target.value));
        }}
      />
    </div>
  );
}

function ExercisePickerPanel({ onPick }: { onPick: (ex: CatalogExercise) => void }): React.JSX.Element {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CatalogExercise[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const t = setTimeout(() => {
      void (async () => {
        let q = supabase.from('exercises').select('id, name, image_url, target_muscles, equipment').order('name').limit(60);
        if (query.trim()) q = q.ilike('name', `%${query.trim()}%`);
        const { data } = await q;
        if (!active) return;
        setResults((data ?? []) as CatalogExercise[]);
        setLoading(false);
      })();
    }, 200);
    return () => { active = false; clearTimeout(t); };
  }, [query]);

  return (
    <div className="card" style={{ position: 'sticky', top: 20 }}>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>Ejercicios</div>
      <input
        className="add-client-email-input"
        style={{ width: '100%', marginBottom: 12 }}
        placeholder="Buscar ejercicio…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div style={{ maxHeight: 480, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {loading ? (
          <div className="muted" style={{ padding: 12 }}>Buscando…</div>
        ) : results.length === 0 ? (
          <div className="muted" style={{ padding: 12 }}>Sin resultados.</div>
        ) : (
          results.map((ex) => (
            <button key={ex.id} type="button" className="picker-row" onClick={() => onPick(ex)}>
              <div className="ex-thumb ex-thumb-icon" aria-hidden><DumbbellIcon size={14} /></div>
              <div className="ex-info">
                <span className="ex-name">{ex.name}</span>
                {ex.target_muscles?.length ? <span className="muted ex-sub">{ex.target_muscles.join(', ')}</span> : null}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
