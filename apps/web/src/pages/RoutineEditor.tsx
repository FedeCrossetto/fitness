import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { ExerciseRow, TrainingDayRow, TrainingPhaseRow, WorkoutExerciseRow, WorkoutRow } from '@reset-fitness/shared/types/database';
import { supabase } from '@/lib/supabase';
import { Spinner } from '@/components/ui';
import { DumbbellIcon, PlusIcon, TrendingUpIcon, GripIcon } from '@/components/icons';
import { ExerciseDetailModal } from '@/components/ExerciseDetailModal';
import { startSortableDrag } from '@/lib/sortableDrag';

const REST_OPTIONS: [number, string][] = [
  [0, 'Off'], [30, '00:30'], [45, '00:45'], [60, '01:00'], [90, '01:30'],
  [120, '02:00'], [180, '03:00'], [240, '04:00'], [300, '05:00'],
];

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
  const [detailExercise, setDetailExercise] = useState<ExerciseRow | null>(null);
  const [draggedExIndex, setDraggedExIndex] = useState<number | null>(null);

  const openDetail = async (exerciseId: string) => {
    const { data } = await supabase.from('exercises').select('*').eq('id', exerciseId).maybeSingle();
    if (data) setDetailExercise(data as ExerciseRow);
  };

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

  const currentOrder = () => [...(day?.workout?.exercises ?? [])].sort((a, b) => a.sort_order - b.sort_order);

  // Reordena SOLO el estado local (vista en vivo mientras se arrastra).
  const reorderExercisesLocal = (from: number, to: number) => {
    setDay((prev) => {
      if (!prev?.workout) return prev;
      const items = [...prev.workout.exercises].sort((a, b) => a.sort_order - b.sort_order);
      if (to < 0 || to >= items.length || from === to) return prev;
      const [removed] = items.splice(from, 1);
      items.splice(to, 0, removed);
      return { ...prev, workout: { ...prev.workout, exercises: items.map((it, idx) => ({ ...it, sort_order: idx })) } };
    });
  };

  // Persiste el orden actual (al soltar el drag).
  const commitExerciseOrder = async () => {
    const items = currentOrder();
    await Promise.all(items.map((it, idx) => supabase.from('workout_exercises').update({ sort_order: idx }).eq('id', it.id)));
  };

  // Reorden con flechas ↑/↓ (accesible): computa y persiste el array directo.
  const moveExercise = (from: number, to: number) => {
    const items = currentOrder();
    if (to < 0 || to >= items.length || from === to) return;
    const [removed] = items.splice(from, 1);
    items.splice(to, 0, removed);
    setDay((prev) => (prev?.workout ? { ...prev, workout: { ...prev.workout, exercises: items.map((it, idx) => ({ ...it, sort_order: idx })) } } : prev));
    void Promise.all(items.map((it, idx) => supabase.from('workout_exercises').update({ sort_order: idx }).eq('id', it.id)));
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

  const backTo = programId ? `/programs/${programId}` : '/programs';

  return (
    <div>
      <div className="prog-editor-head">
        <Link to={backTo} className="prog-editor-back" aria-label="Volver al programa">←</Link>
        <h1 className="prog-editor-title">Editar rutina</h1>
        <span className="prog-editor-back" style={{ cursor: 'default', color: 'var(--hevy-blue)', borderColor: 'var(--hevy-blue-soft)' }} aria-hidden>
          <TrendingUpIcon size={18} />
        </span>
      </div>

      <div className="prog-editor-grid" style={{ gridTemplateColumns: 'minmax(0,1fr) 360px' }}>
        <div>
          <div className="field-label">Título de la rutina</div>
          <input
            className="hevy-input"
            style={{ marginBottom: 20 }}
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={() => void saveTitle(titleDraft)}
          />

          {exercises.length === 0 ? (
            <div className="prog-drop">Todavía no agregaste ejercicios.<br /><span style={{ fontSize: 13 }}>Elegí uno del panel de la derecha.</span></div>
          ) : (
            exercises.map((we, index) => (
              <ExerciseCard
                key={we.id}
                we={we}
                index={index}
                count={exercises.length}
                dragging={draggedExIndex === index}
                onSave={(patch) => void saveExercise(we.id, patch)}
                onRemove={() => void removeExercise(we.id)}
                onMoveUp={() => void moveExercise(index, index - 1)}
                onMoveDown={() => void moveExercise(index, index + 1)}
                onOpenDetail={() => we.exercise && void openDetail(we.exercise.id)}
                onDragStart={(e) => startSortableDrag({
                  event: e, index, cardSelector: '.rex-card', dataAttr: 'exIndex',
                  move: reorderExercisesLocal, commit: () => void commitExerciseOrder(),
                  setDragIndex: setDraggedExIndex,
                })}
              />
            ))
          )}
        </div>

        <ExercisePickerPanel onPick={(ex) => void addExercise(ex)} onDetail={(id) => void openDetail(id)} />
      </div>

      {detailExercise && (
        <ExerciseDetailModal exercise={detailExercise} onClose={() => setDetailExercise(null)} />
      )}
    </div>
  );
}

function ExerciseCard({
  we,
  index,
  count,
  dragging,
  onSave,
  onRemove,
  onMoveUp,
  onMoveDown,
  onOpenDetail,
  onDragStart,
}: {
  we: WorkoutExerciseWithExercise;
  index: number;
  count: number;
  dragging: boolean;
  onSave: (patch: Partial<Pick<WorkoutExerciseRow, 'sets' | 'reps' | 'rest_seconds' | 'weight_kg'>>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onOpenDetail: () => void;
  onDragStart: (e: React.MouseEvent) => void;
}): React.JSX.Element {
  const thumbStyle = we.exercise?.image_url ? { backgroundImage: `url(${we.exercise.image_url})` } : undefined;
  return (
    <div className={`rex-card${dragging ? ' dragging' : ''}`} data-ex-index={index} onMouseDown={onDragStart}>
      <div className="rex-head">
        <span className="rex-grip" aria-hidden><GripIcon size={16} /></span>
        <div className="rex-thumb" style={thumbStyle} onClick={onOpenDetail} title="Ver detalle">
          {we.exercise?.image_url ? null : <DumbbellIcon size={18} />}
        </div>
        <span className="rex-name" onClick={onOpenDetail}>{we.exercise?.name ?? 'Ejercicio'}</span>
        <div className="ex-move">
          <button type="button" className="icon-btn sm" title="Subir" disabled={index === 0} onClick={onMoveUp}>↑</button>
          <button type="button" className="icon-btn sm" title="Bajar" disabled={index === count - 1} onClick={onMoveDown}>↓</button>
          <button type="button" className="icon-btn sm" title="Quitar" onClick={onRemove}>✕</button>
        </div>
      </div>

      <div className="rex-resttimer">
        <label>Descanso:</label>
        <select
          className="rex-select"
          defaultValue={String(we.rest_seconds ?? 0)}
          onChange={(e) => onSave({ rest_seconds: Number(e.target.value) || null })}
        >
          {REST_OPTIONS.map(([secs, label]) => (
            <option key={secs} value={secs}>{label}</option>
          ))}
        </select>
      </div>

      <div className="rex-sets-head">
        <span>Serie</span>
        <span>Reps</span>
        <span>Kg</span>
        <span>Series</span>
        <span />
      </div>
      <div className="rex-sets-row">
        <span className="rex-setnum">1</span>
        <input
          className="rex-input"
          defaultValue={we.reps ?? ''}
          onBlur={(e) => onSave({ reps: e.target.value })}
        />
        <input
          className="rex-input"
          inputMode="decimal"
          defaultValue={we.weight_kg ?? ''}
          onBlur={(e) => onSave({ weight_kg: e.target.value === '' ? null : Number(e.target.value) })}
        />
        <input
          className="rex-input"
          inputMode="numeric"
          defaultValue={we.sets ?? ''}
          onBlur={(e) => onSave({ sets: e.target.value === '' ? 0 : Number(e.target.value) })}
        />
        <span />
      </div>
    </div>
  );
}

function ExercisePickerPanel({ onPick, onDetail }: { onPick: (ex: CatalogExercise) => void; onDetail: (id: string) => void }): React.JSX.Element {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CatalogExercise[]>([]);
  const [loading, setLoading] = useState(false);
  const [equipment, setEquipment] = useState('');
  const [muscle, setMuscle] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    const t = setTimeout(() => {
      void (async () => {
        let q = supabase.from('exercises').select('id, name, image_url, target_muscles, equipment').order('name').limit(200);
        if (query.trim()) q = q.ilike('name', `%${query.trim()}%`);
        const { data } = await q;
        if (!active) return;
        setResults((data ?? []) as CatalogExercise[]);
        setLoading(false);
      })();
    }, 200);
    return () => { active = false; clearTimeout(t); };
  }, [query]);

  // Opciones de filtro derivadas de los resultados cargados.
  const equipmentOpts = useMemo(
    () => Array.from(new Set(results.flatMap((e) => e.equipment ?? []))).sort(),
    [results],
  );
  const muscleOpts = useMemo(
    () => Array.from(new Set(results.flatMap((e) => e.target_muscles ?? []))).sort(),
    [results],
  );
  const filtered = results.filter(
    (e) =>
      (!equipment || (e.equipment ?? []).includes(equipment)) &&
      (!muscle || (e.target_muscles ?? []).includes(muscle)),
  );

  return (
    <div className="card summary-card">
      <div className="picker-head">
        <button type="button" className="link-blue" onClick={() => window.open('/exercises', '_self')}>
          <PlusIcon size={15} /> Ejercicio personalizado
        </button>
      </div>
      <div className="picker-filters">
        <select className="picker-select" value={equipment} onChange={(e) => setEquipment(e.target.value)}>
          <option value="">Equipo</option>
          {equipmentOpts.map((op) => <option key={op} value={op}>{op}</option>)}
        </select>
        <select className="picker-select" value={muscle} onChange={(e) => setMuscle(e.target.value)}>
          <option value="">Músculos</option>
          {muscleOpts.map((op) => <option key={op} value={op}>{op}</option>)}
        </select>
      </div>
      <div className="search-field" style={{ width: '100%', marginBottom: 12 }}>
        <input
          style={{ width: '100%' }}
          placeholder="Buscar ejercicios…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div style={{ maxHeight: 520, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {loading ? (
          <div className="muted" style={{ padding: 12 }}>Buscando…</div>
        ) : filtered.length === 0 ? (
          <div className="muted" style={{ padding: 12 }}>Sin resultados.</div>
        ) : (
          filtered.map((ex) => (
            <div key={ex.id} className="picker-row" onClick={() => onDetail(ex.id)}>
              <div
                className="ex-thumb ex-thumb-icon"
                aria-hidden
                style={ex.image_url ? { backgroundImage: `url(${ex.image_url})` } : undefined}
              >
                {ex.image_url ? null : <DumbbellIcon size={14} />}
              </div>
              <div className="ex-info">
                <span className="ex-name">{ex.name}</span>
                {ex.target_muscles?.length ? <span className="muted ex-sub">{ex.target_muscles.join(', ')}</span> : null}
              </div>
              <button
                type="button"
                className="picker-add"
                onClick={(e) => { e.stopPropagation(); onPick(ex); }}
                title="Agregar a la rutina"
              >
                <PlusIcon size={15} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
