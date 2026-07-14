import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { ExerciseRow, TrainingDayRow, TrainingPhaseRow, WorkoutExerciseRow, WorkoutRow, WorkoutSet } from '@reset-fitness/shared/types/database';
import { supabase } from '@/lib/supabase';
import { Spinner } from '@/components/ui';
import { DumbbellIcon, PlusIcon, TrendingUpIcon, GripIcon } from '@/components/icons';
import { ExerciseDetailModal } from '@/components/ExerciseDetailModal';
import { CardMenu } from '@/components/CardMenu';
import { startSortableDrag } from '@/lib/sortableDrag';
import { createDragGhost } from '@/lib/dragGhost';
import { useTranslation } from '@/hooks/useTranslation';
import { localizedExercise } from '@/lib/exerciseI18n';

const REST_OPTIONS: [number, string][] = [
  [0, 'Off'], [30, '00:30'], [45, '00:45'], [60, '01:00'], [90, '01:30'],
  [120, '02:00'], [180, '03:00'], [240, '04:00'], [300, '05:00'],
];

// RPE objetivo — mismos valores que Hevy (6 a 10 en pasos de 0.5).
const RPE_OPTIONS = [6, 7, 7.5, 8, 8.5, 9, 9.5, 10];

type CatalogExercise = Pick<ExerciseRow, 'id' | 'name' | 'image_url' | 'target_muscles' | 'equipment' | 'metadata'>;
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
  // Índice donde se insertaría el ejercicio arrastrado desde el picker —
  // pinta una card fantasma (hueco) en ese lugar de la lista mientras se arrastra.
  const [pickerDropIndex, setPickerDropIndex] = useState<number | null>(null);
  // Ejercicio recién agregado: enfocamos su primer campo de Reps.
  const [focusRepsWeId, setFocusRepsWeId] = useState<string | null>(null);

  const openDetail = async (exerciseId: string) => {
    const { data } = await supabase.from('exercises').select('*').eq('id', exerciseId).maybeSingle();
    if (data) setDetailExercise(data as ExerciseRow);
  };

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const { data, error: dErr } = await supabase
        .from('training_days')
        .select('*, workout:workouts(*, exercises:workout_exercises(sort_order, *, exercise:exercises(id, name, image_url, target_muscles, equipment, metadata))), phase:training_phases(program_key)')
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

  const addExercise = async (exercise: CatalogExercise, insertAt?: number): Promise<string | null> => {
    if (!day?.workout) return null;
    const items = currentOrder();
    const at = insertAt === undefined ? items.length : Math.max(0, Math.min(insertAt, items.length));
    // Corremos el sort_order de los que quedan después del punto de inserción.
    const toShift = items.slice(at);
    if (toShift.length > 0) {
      await Promise.all(toShift.map((it, i) => supabase.from('workout_exercises').update({ sort_order: at + 1 + i }).eq('id', it.id)));
    }
    // Reps vacías a propósito: el coach las completa (el foco cae en Reps al
    // agregar) — si quedan vacías, la card muestra un warning no bloqueante.
    const { data: inserted } = await supabase.from('workout_exercises').insert({
      workout_id: day.workout.id,
      exercise_id: exercise.id,
      sort_order: at,
      sets: 3,
      reps: '',
    }).select('id').single();
    await load();
    return (inserted as { id: string } | null)?.id ?? null;
  };

  const saveExercise = async (weId: string, patch: Partial<Pick<WorkoutExerciseRow, 'sets' | 'reps' | 'rest_seconds' | 'weight_kg' | 'sets_detail' | 'notes'>>) => {
    await supabase.from('workout_exercises').update(patch).eq('id', weId);
    // Reflejo local para no perder los cambios al reordenar/re-render.
    setDay((prev) => (prev?.workout ? { ...prev, workout: { ...prev.workout, exercises: prev.workout.exercises.map((x) => (x.id === weId ? { ...x, ...patch } : x)) } } : prev));
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
        <div data-routine-drop className="routine-drop-col">
          <div className="field-label">Título de la rutina</div>
          <input
            className="hevy-input"
            style={{ marginBottom: 20 }}
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={() => void saveTitle(titleDraft)}
          />

          {exercises.length === 0 && pickerDropIndex === null ? (
            <div className="prog-drop">Todavía no agregaste ejercicios.<br /><span style={{ fontSize: 13 }}>Elegí uno del panel de la derecha o arrastralo acá.</span></div>
          ) : (
            <>
              {pickerDropIndex === 0 && <div className="rex-card rex-card-placeholder" aria-hidden />}
              {exercises.map((we, index) => (
                <Fragment key={we.id}>
                  <ExerciseCard
                    we={we}
                    index={index}
                    dragging={draggedExIndex === index}
                    onSave={(patch) => void saveExercise(we.id, patch)}
                    onRemove={() => void removeExercise(we.id)}
                    onMoveUp={() => void moveExercise(index, index - 1)}
                    onMoveDown={() => void moveExercise(index, index + 1)}
                    onOpenDetail={() => we.exercise && void openDetail(we.exercise.id)}
                    focusReps={we.id === focusRepsWeId}
                    onRepsFocused={() => setFocusRepsWeId(null)}
                    onDragStart={(e) => startSortableDrag({
                      event: e, index, cardSelector: '.rex-card', dataAttr: 'exIndex',
                      move: reorderExercisesLocal, commit: () => void commitExerciseOrder(),
                      setDragIndex: setDraggedExIndex,
                    })}
                  />
                  {pickerDropIndex === index + 1 && <div className="rex-card rex-card-placeholder" aria-hidden />}
                </Fragment>
              ))}
            </>
          )}
        </div>

        <ExercisePickerPanel
          onPick={(ex, insertAt) => { void addExercise(ex, insertAt).then((newId) => { if (newId) setFocusRepsWeId(newId); }); }}
          onDetail={(id) => void openDetail(id)}
          onDragOverIndex={setPickerDropIndex}
        />
      </div>

      {detailExercise && (
        <ExerciseDetailModal exercise={detailExercise} onClose={() => setDetailExercise(null)} />
      )}
    </div>
  );
}

function initialSets(we: WorkoutExerciseWithExercise): WorkoutSet[] {
  if (we.sets_detail?.length) return we.sets_detail;
  const n = Math.max(we.sets ?? 1, 1);
  return Array.from({ length: n }, () => ({ reps: we.reps ?? '', kg: we.weight_kg ?? null }));
}

function ExerciseCard({
  we,
  index,
  dragging,
  onSave,
  onRemove,
  onMoveUp,
  onMoveDown,
  onOpenDetail,
  onDragStart,
  focusReps,
  onRepsFocused,
}: {
  we: WorkoutExerciseWithExercise;
  index: number;
  dragging: boolean;
  onSave: (patch: Partial<Pick<WorkoutExerciseRow, 'sets' | 'reps' | 'rest_seconds' | 'weight_kg' | 'sets_detail' | 'notes'>>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onOpenDetail: () => void;
  onDragStart: (e: React.MouseEvent) => void;
  focusReps?: boolean;
  onRepsFocused?: () => void;
}): React.JSX.Element {
  const { language } = useTranslation();
  const thumbStyle = we.exercise?.image_url ? { backgroundImage: `url(${we.exercise.image_url})` } : undefined;
  const exName = we.exercise ? localizedExercise(we.exercise, language).name : 'Ejercicio';
  const [menuOpen, setMenuOpen] = useState(false);
  const [sets, setSets] = useState<WorkoutSet[]>(() => initialSets(we));
  const [note, setNote] = useState(we.notes ?? '');
  const firstRepsRef = useRef<HTMLInputElement>(null);

  // Al agregar el ejercicio (drag o click desde el picker), enfocamos el primer
  // campo de Reps para que el coach lo complete de una.
  useEffect(() => {
    if (focusReps) {
      firstRepsRef.current?.focus();
      firstRepsRef.current?.select();
      onRepsFocused?.();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusReps]);

  // Warning no bloqueante: alguna serie sin repeticiones.
  const missingReps = sets.some((s) => !String(s.reps ?? '').trim());
  // RPE objetivo activado = alguna serie ya tiene la key `rpe` (aunque sea null).
  const rpeEnabled = sets.some((s) => s.rpe !== undefined);

  // Persiste el array de sets + un resumen (sets/reps/weight_kg) para compat.
  const persistSets = (next: WorkoutSet[]) => {
    setSets(next);
    const first = next[0];
    onSave({ sets_detail: next, sets: next.length, reps: first?.reps ?? '', weight_kg: first?.kg ?? null });
  };
  const setLocal = (i: number, field: 'reps' | 'kg', value: string) =>
    setSets((prev) => prev.map((s, idx) => (idx === i ? { ...s, [field]: field === 'kg' ? (value === '' ? null : Number(value)) : value } : s)));
  const addSet = () => persistSets([...sets, sets.length ? { ...sets[sets.length - 1] } : { reps: '', kg: null, ...(rpeEnabled ? { rpe: null } : {}) }]);
  const removeSet = (i: number) => persistSets(sets.filter((_, idx) => idx !== i));

  const setRpeLocal = (i: number, value: string) =>
    persistSets(sets.map((s, idx) => (idx === i ? { ...s, rpe: value === '' ? null : Number(value) } : s)));
  // Toggle "RPE objetivo": ON agrega la key `rpe` (null) a cada serie; OFF la
  // quita. Persiste en el JSON de sets_detail, sin columna dedicada.
  const toggleRpe = () =>
    persistSets(sets.map((s) => {
      if (rpeEnabled) { const { rpe: _drop, ...rest } = s; return rest; }
      return { ...s, rpe: s.rpe ?? null };
    }));

  return (
    <div className={`rex-card${dragging ? ' dragging' : ''}`} data-ex-index={index} onMouseDown={onDragStart}>
      <div className="rex-head">
        <span className="rex-grip" aria-hidden><GripIcon size={16} /></span>
        <div className="rex-thumb" style={thumbStyle} onClick={onOpenDetail} title="Ver detalle">
          {we.exercise?.image_url ? null : <DumbbellIcon size={18} />}
        </div>
        <span className="rex-name" onClick={onOpenDetail}>{exName}</span>
        <CardMenu
          open={menuOpen}
          onToggle={() => setMenuOpen((v) => !v)}
          items={[
            { label: 'Ver detalle', onClick: onOpenDetail },
            { label: 'Subir', onClick: onMoveUp },
            { label: 'Bajar', onClick: onMoveDown },
            { label: 'Quitar ejercicio', onClick: onRemove, danger: true },
          ]}
        />
      </div>

      <div className="rex-note">
        <label>Nota</label>
        <textarea
          className="hevy-input"
          rows={1}
          placeholder="Agregá una nota para este ejercicio"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => note !== (we.notes ?? '') && onSave({ notes: note || null })}
        />
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

        <label className="toggle-switch rex-rpe-toggle" title="Mostrar RPE objetivo por serie">
          <input type="checkbox" checked={rpeEnabled} onChange={toggleRpe} />
          <span className="toggle-track"><span className="toggle-thumb" /></span>
          <span className="rex-rpe-toggle-label">RPE objetivo</span>
        </label>
      </div>

      <div className={`rex-sets3-head${rpeEnabled ? ' with-rpe' : ''}`}>
        <span>Serie</span>
        <span>Kg</span>
        <span>Reps</span>
        {rpeEnabled && <span>RPE</span>}
        <span />
      </div>
      {sets.map((s, i) => (
        <div className={`rex-sets3-row${rpeEnabled ? ' with-rpe' : ''}`} key={i}>
          <span className="rex-setnum">{i + 1}</span>
          <input
            className="rex-input"
            inputMode="decimal"
            placeholder="—"
            value={s.kg ?? ''}
            onChange={(e) => setLocal(i, 'kg', e.target.value)}
            onBlur={() => persistSets(sets)}
          />
          <input
            ref={i === 0 ? firstRepsRef : undefined}
            className="rex-input"
            placeholder="—"
            value={s.reps ?? ''}
            onChange={(e) => setLocal(i, 'reps', e.target.value)}
            onBlur={() => persistSets(sets)}
          />
          {rpeEnabled && (
            <select
              className="rex-input rex-rpe-select"
              value={s.rpe ?? ''}
              onChange={(e) => setRpeLocal(i, e.target.value)}
            >
              <option value="">—</option>
              {RPE_OPTIONS.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          )}
          <button type="button" className="rex-set-x" title="Quitar serie" onClick={() => removeSet(i)}>✕</button>
        </div>
      ))}
      {missingReps && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 11.5, color: 'var(--warning)' }}>
          <span aria-hidden>⚠</span> Este ejercicio tiene series sin repeticiones — no van a sumar volumen.
        </div>
      )}
      <button type="button" className="rex-add-set" onClick={addSet}>+ Agregar serie</button>
    </div>
  );
}

function ExercisePickerPanel({
  onPick,
  onDetail,
  onDragOverIndex,
}: {
  onPick: (ex: CatalogExercise, insertAt?: number) => void;
  onDetail: (id: string) => void;
  onDragOverIndex: (index: number | null) => void;
}): React.JSX.Element {
  const { language } = useTranslation();
  const navigate = useNavigate();

  // Calcula en qué índice de la rutina se insertaría el ejercicio según la
  // posición del cursor respecto a las cards existentes (mitad de arriba →
  // antes de esa card; mitad de abajo → después). Sin cards debajo → al final.
  const computeInsertIndex = (clientY: number): number => {
    const cards = Array.from(document.querySelectorAll<HTMLElement>('[data-routine-drop] [data-ex-index]'));
    for (const card of cards) {
      const rect = card.getBoundingClientRect();
      const mid = rect.top + rect.height / 2;
      if (clientY < mid) return Number(card.dataset.exIndex);
    }
    return cards.length;
  };

  // Drag desde el picker hacia la rutina: se arrastra la fila, se muestra
  // una card fantasma "hueco" en la posición de inserción (igual que al
  // reordenar), y al soltar sobre la columna de la rutina se agrega ahí.
  const startPickerDrag = (e: React.MouseEvent, ex: CatalogExercise) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('.picker-add')) return; // el + tiene su propio click
    const row = (e.target as HTMLElement).closest<HTMLElement>('.picker-row');
    if (!row) return;
    const startX = e.clientX, startY = e.clientY;
    let moved = false;
    let ghost: ReturnType<typeof createDragGhost> | null = null;
    let overDrop = false;
    let lastIndex = 0;

    const onMove = (ev: MouseEvent) => {
      if (!moved) {
        if (Math.abs(ev.clientX - startX) < 5 && Math.abs(ev.clientY - startY) < 5) return;
        moved = true;
        document.body.classList.add('is-dragging-card');
        ghost = createDragGhost(row, { clientX: startX, clientY: startY });
      }
      ghost?.move(ev);
      const el = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null;
      const dropCol = el?.closest<HTMLElement>('[data-routine-drop]') ?? null;
      overDrop = !!dropCol;
      if (dropCol) lastIndex = computeInsertIndex(ev.clientY);
      onDragOverIndex(dropCol ? lastIndex : null);
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (!moved) return;
      ghost?.destroy();
      document.body.classList.remove('is-dragging-card');
      // Suprimir el click que abre el detalle tras el drag.
      const suppress = (ce: MouseEvent) => { ce.stopPropagation(); ce.preventDefault(); };
      window.addEventListener('click', suppress, { capture: true });
      setTimeout(() => window.removeEventListener('click', suppress, { capture: true }), 300);
      if (overDrop) onPick(ex, lastIndex);
      onDragOverIndex(null);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CatalogExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [equipment, setEquipment] = useState('');
  const [muscle, setMuscle] = useState('');

  // Cargamos todo una vez y filtramos en cliente (busca por nombre ES y EN).
  useEffect(() => {
    let active = true;
    void (async () => {
      const { data } = await supabase.from('exercises').select('id, name, image_url, target_muscles, equipment, metadata').order('name').limit(1000);
      if (!active) return;
      setResults((data ?? []) as CatalogExercise[]);
      setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  const equipmentOpts = useMemo(
    () => Array.from(new Set(results.flatMap((e) => e.equipment ?? []))).sort(),
    [results],
  );
  const muscleOpts = useMemo(
    () => Array.from(new Set(results.map((e) => localizedExercise(e, language).muscle).filter((m) => m && m !== '—'))).sort(),
    [results, language],
  );
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return results
      .map((ex) => ({ ex, loc: localizedExercise(ex, language) }))
      .filter(({ ex, loc }) =>
        (!q || loc.name.toLowerCase().includes(q) || ex.name.toLowerCase().includes(q)) &&
        (!equipment || (ex.equipment ?? []).includes(equipment)) &&
        (!muscle || loc.muscle === muscle))
      .sort((a, b) => a.loc.name.localeCompare(b.loc.name));
  }, [results, query, language, equipment, muscle]);

  return (
    <div className="card summary-card">
      <div className="picker-head">
        <button type="button" className="link-blue" onClick={() => navigate('/exercises')}>
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
          filtered.map(({ ex, loc }) => (
            <div key={ex.id} className="picker-row" onClick={() => onDetail(ex.id)} onMouseDown={(e) => startPickerDrag(e, ex)}>
              <div
                className="ex-thumb ex-thumb-icon"
                aria-hidden
                style={ex.image_url ? { backgroundImage: `url(${ex.image_url})` } : undefined}
              >
                {ex.image_url ? null : <DumbbellIcon size={14} />}
              </div>
              <div className="ex-info">
                <span className="ex-name">{loc.name}</span>
                {loc.muscle && loc.muscle !== '—' ? <span className="muted ex-sub">{loc.muscle}</span> : null}
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
