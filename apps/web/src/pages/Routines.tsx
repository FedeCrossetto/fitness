import { useCallback, useEffect, useState } from 'react';
import type {
  ExerciseRow,
  TrainingDayRow,
  TrainingPhaseRow,
  WorkoutExerciseRow,
  WorkoutRow,
  WorkoutType,
} from '@reset-fitness/shared/types/database';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { ErrorState, LoadingRows, EmptyState } from '@/components/ui';
import { DumbbellIcon } from '@/components/icons';

type CatalogExercise = Pick<ExerciseRow, 'id' | 'name' | 'image_url' | 'target_muscles'>;
type WorkoutExerciseWithExercise = WorkoutExerciseRow & { exercise: CatalogExercise | null };
type DayWithWorkout = TrainingDayRow & {
  workout: (WorkoutRow & { exercises: WorkoutExerciseWithExercise[] }) | null;
};
type PhaseWithDays = TrainingPhaseRow & { days: DayWithWorkout[] };

const DAY_TYPES: { value: WorkoutType; label: string }[] = [
  { value: 'fuerza', label: 'Fuerza' },
  { value: 'cardio', label: 'Cardio' },
  { value: 'movilidad', label: 'Movilidad' },
  { value: 'tecnica', label: 'Técnica' },
  { value: 'descanso', label: 'Descanso' },
];

export function RoutinesPage(): React.JSX.Element {
  const { session } = useAuth();
  const trainerId = session?.user.id ?? null;
  const [programKey, setProgramKey] = useState<string>('default');
  const [phases, setPhases] = useState<PhaseWithDays[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pickerDay, setPickerDay] = useState<DayWithWorkout | null>(null);

  const load = useCallback(async () => {
    try {
      const { data: branding } = await supabase
        .from('trainer_branding')
        .select('default_program_key')
        .maybeSingle();
      const key = branding?.default_program_key ?? 'default';
      setProgramKey(key);

      const { data: phaseRows, error: phasesError } = await supabase
        .from('training_phases')
        .select('*')
        .eq('program_key', key)
        .order('sort_order');
      if (phasesError) throw phasesError;

      const phaseList = (phaseRows ?? []) as TrainingPhaseRow[];
      const phaseIds = phaseList.map((p) => p.id);

      let days: DayWithWorkout[] = [];
      if (phaseIds.length > 0) {
        const { data: dayRows, error: daysError } = await supabase
          .from('training_days')
          .select(
            '*, workout:workouts(*, exercises:workout_exercises(sort_order, *, exercise:exercises(id, name, image_url, target_muscles)))'
          )
          .in('phase_id', phaseIds)
          .order('day_number');
        if (daysError) throw daysError;
        days = (dayRows ?? []) as unknown as DayWithWorkout[];
      }

      setPhases(
        phaseList.map((phase) => ({
          ...phase,
          days: days.filter((d) => d.phase_id === phase.id),
        }))
      );
      setError(null);
      setLoading(false);
    } catch {
      setError('No pudimos cargar el programa.');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // ── Mutaciones ──

  const addPhase = async () => {
    if (!trainerId) return;
    const nextNumber = phases.reduce((m, p) => Math.max(m, p.phase_number), 0) + 1;
    await supabase.from('training_phases').insert({
      program_key: programKey,
      trainer_id: trainerId,
      phase_number: nextNumber,
      name: `Etapa ${nextNumber}`,
      sort_order: phases.length,
      is_active: true,
    });
    await load();
  };

  const renamePhase = async (id: string, name: string) => {
    await supabase.from('training_phases').update({ name }).eq('id', id);
  };

  const deletePhase = async (id: string) => {
    if (!confirm('¿Eliminar la etapa y todos sus días?')) return;
    await supabase.from('training_phases').delete().eq('id', id);
    await load();
  };

  const addDay = async (phase: PhaseWithDays) => {
    if (!trainerId) return;
    const nextNumber = phase.days.reduce((m, d) => Math.max(m, d.day_number), 0) + 1;
    const { data: workout, error: wErr } = await supabase
      .from('workouts')
      .insert({ trainer_id: trainerId, title: `Día ${nextNumber}`, workout_type: 'fuerza', blocks: 1 })
      .select('id')
      .single();
    if (wErr || !workout) return;
    await supabase.from('training_days').insert({
      phase_id: phase.id,
      day_number: nextNumber,
      title: `Día ${nextNumber}`,
      day_type: 'fuerza',
      workout_id: (workout as { id: string }).id,
      sort_order: phase.days.length,
    });
    await load();
  };

  const saveDay = async (id: string, patch: Partial<Pick<TrainingDayRow, 'title' | 'day_type'>>) => {
    await supabase.from('training_days').update(patch).eq('id', id);
  };

  const deleteDay = async (day: DayWithWorkout) => {
    if (!confirm('¿Eliminar este día?')) return;
    if (day.workout) {
      await supabase.from('workout_exercises').delete().eq('workout_id', day.workout.id);
    }
    await supabase.from('training_days').delete().eq('id', day.id);
    if (day.workout) await supabase.from('workouts').delete().eq('id', day.workout.id);
    await load();
  };

  const addExercise = async (day: DayWithWorkout, exercise: CatalogExercise) => {
    if (!day.workout) return;
    const nextOrder = (day.workout.exercises?.length ?? 0);
    await supabase.from('workout_exercises').insert({
      workout_id: day.workout.id,
      exercise_id: exercise.id,
      sort_order: nextOrder,
      sets: 3,
      reps: '10',
    });
    await load();
  };

  const saveWorkoutExercise = async (
    id: string,
    patch: Partial<Pick<WorkoutExerciseRow, 'sets' | 'reps' | 'rest_seconds' | 'weight_kg'>>
  ) => {
    await supabase.from('workout_exercises').update(patch).eq('id', id);
  };

  const reorderWorkoutExercises = async (orderedIds: string[]) => {
    await Promise.all(
      orderedIds.map((id, sort_order) =>
        supabase.from('workout_exercises').update({ sort_order }).eq('id', id)
      )
    );
    await load();
  };

  const reorderTrainingDays = async (orderedIds: string[]) => {
    await Promise.all(
      orderedIds.map((id, index) =>
        supabase
          .from('training_days')
          .update({ sort_order: index, day_number: index + 1 })
          .eq('id', id)
      )
    );
    await load();
  };

  const removeWorkoutExercise = async (id: string) => {
    await supabase.from('workout_exercises').delete().eq('id', id);
    await load();
  };

  return (
    <div>
      <div className="row-between">
        <div>
          <h1 className="page-title">Rutinas</h1>
          <p className="page-sub">El programa de entrenamiento que ven tus alumnos en la app.</p>
        </div>
        <button className="btn" onClick={() => void addPhase()} disabled={!trainerId}>
          + Nueva etapa
        </button>
      </div>

      {loading ? (
        <div className="card" style={{ padding: 16 }}><LoadingRows rows={3} /></div>
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : phases.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<DumbbellIcon size={22} />}
            title="Todavía no hay etapas"
            sub="Creá la primera etapa para empezar a armar el plan de entrenamiento."
            action={trainerId ? { label: '+ Nueva etapa', onClick: () => void addPhase() } : undefined}
          />
        </div>
      ) : (
        phases.map((phase) => (
          <PhaseEditor
            key={phase.id}
            phase={phase}
            onRename={renamePhase}
            onDelete={deletePhase}
            onAddDay={addDay}
            onSaveDay={saveDay}
            onDeleteDay={deleteDay}
            onOpenPicker={setPickerDay}
            onSaveExercise={saveWorkoutExercise}
            onRemoveExercise={removeWorkoutExercise}
            onReorderExercises={reorderWorkoutExercises}
            onReorderDays={reorderTrainingDays}
          />
        ))
      )}

      {pickerDay ? (
        <ExercisePicker
          onClose={() => setPickerDay(null)}
          onPick={async (ex) => {
            await addExercise(pickerDay, ex);
            setPickerDay(null);
          }}
        />
      ) : null}
    </div>
  );
}

function PhaseEditor({
  phase,
  onRename,
  onDelete,
  onAddDay,
  onSaveDay,
  onDeleteDay,
  onOpenPicker,
  onSaveExercise,
  onRemoveExercise,
  onReorderExercises,
  onReorderDays,
}: {
  phase: PhaseWithDays;
  onRename: (id: string, name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onAddDay: (phase: PhaseWithDays) => Promise<void>;
  onSaveDay: (id: string, patch: Partial<Pick<TrainingDayRow, 'title' | 'day_type'>>) => Promise<void>;
  onDeleteDay: (day: DayWithWorkout) => Promise<void>;
  onOpenPicker: (day: DayWithWorkout) => void;
  onSaveExercise: (
    id: string,
    patch: Partial<Pick<WorkoutExerciseRow, 'sets' | 'reps' | 'rest_seconds' | 'weight_kg'>>
  ) => Promise<void>;
  onRemoveExercise: (id: string) => Promise<void>;
  onReorderExercises: (orderedIds: string[]) => Promise<void>;
  onReorderDays: (orderedIds: string[]) => Promise<void>;
}): React.JSX.Element {
  const [name, setName] = useState(phase.name);

  const [openDay, setOpenDay] = useState<string | null>(null);
  const sortedDays = [...phase.days].sort((a, b) => a.day_number - b.day_number);

  return (
    <section className="card phase-card" style={{ padding: 0 }}>
      <div className="phase-bar">
        <div className="phase-bar-left">
          <span className="phase-num">Etapa {phase.phase_number}</span>
          <input
            className="inline-input phase-name-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => name !== phase.name && void onRename(phase.id, name)}
          />
        </div>
        <div className="phase-bar-actions">
          <button className="btn secondary sm" onClick={() => void onAddDay(phase)}>
            + Día
          </button>
          <button className="icon-btn" title="Eliminar etapa" onClick={() => void onDelete(phase.id)}>
            Eliminar
          </button>
        </div>
      </div>

      {phase.days.length === 0 ? (
        <p className="muted" style={{ padding: '16px 18px', margin: 0 }}>
          Esta etapa no tiene días. Agregá el primero con “+ Día”.
        </p>
      ) : (
        <DayListEditor
          days={sortedDays}
          openDay={openDay}
          onToggleDay={(id) => setOpenDay((cur) => (cur === id ? null : id))}
          onSaveDay={onSaveDay}
          onDeleteDay={onDeleteDay}
          onOpenPicker={onOpenPicker}
          onSaveExercise={onSaveExercise}
          onRemoveExercise={onRemoveExercise}
          onReorderExercises={onReorderExercises}
          onReorderDays={onReorderDays}
        />
      )}
    </section>
  );
}

const TYPE_BADGE: Record<WorkoutType, string> = {
  fuerza: 'green',
  cardio: 'amber',
  movilidad: 'violet',
  tecnica: 'gray',
  descanso: 'gray',
};

function DayListEditor({
  days,
  openDay,
  onToggleDay,
  onSaveDay,
  onDeleteDay,
  onOpenPicker,
  onSaveExercise,
  onRemoveExercise,
  onReorderExercises,
  onReorderDays,
}: {
  days: DayWithWorkout[];
  openDay: string | null;
  onToggleDay: (id: string) => void;
  onSaveDay: (id: string, patch: Partial<Pick<TrainingDayRow, 'title' | 'day_type'>>) => Promise<void>;
  onDeleteDay: (day: DayWithWorkout) => Promise<void>;
  onOpenPicker: (day: DayWithWorkout) => void;
  onSaveExercise: (
    id: string,
    patch: Partial<Pick<WorkoutExerciseRow, 'sets' | 'reps' | 'rest_seconds' | 'weight_kg'>>
  ) => Promise<void>;
  onRemoveExercise: (id: string) => Promise<void>;
  onReorderExercises: (orderedIds: string[]) => Promise<void>;
  onReorderDays: (orderedIds: string[]) => Promise<void>;
}): React.JSX.Element {
  const [items, setItems] = useState(days);
  const [dragId, setDragId] = useState<string | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);

  useEffect(() => {
    setItems(days);
  }, [days]);

  const moveDay = async (from: number, to: number) => {
    if (from === to || to < 0 || to >= items.length) return;
    const next = [...items];
    const [removed] = next.splice(from, 1);
    next.splice(to, 0, removed);
    setItems(next);
    setSavingOrder(true);
    try {
      await onReorderDays(next.map((day) => day.id));
    } finally {
      setSavingOrder(false);
    }
  };

  return (
    <table className={savingOrder ? 'day-table saving' : 'day-table'}>
      <thead>
        <tr>
          <th className="day-col-order" />
          <th>Día</th>
          <th>Tipo</th>
          <th>Ejercicios</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {items.map((day, index) => (
          <DayRow
            key={day.id}
            day={day}
            dayIndex={index}
            dayCount={items.length}
            expanded={openDay === day.id}
            dragging={dragId === day.id}
            reorderDisabled={savingOrder}
            onToggle={() => onToggleDay(day.id)}
            onMoveUp={() => void moveDay(index, index - 1)}
            onMoveDown={() => void moveDay(index, index + 1)}
            onDragStart={() => setDragId(day.id)}
            onDragEnd={() => setDragId(null)}
            onDropOn={() => {
              if (!dragId || dragId === day.id) return;
              const from = items.findIndex((item) => item.id === dragId);
              void moveDay(from, index);
              setDragId(null);
            }}
            onSaveDay={onSaveDay}
            onDeleteDay={onDeleteDay}
            onOpenPicker={onOpenPicker}
            onSaveExercise={onSaveExercise}
            onRemoveExercise={onRemoveExercise}
            onReorderExercises={onReorderExercises}
          />
        ))}
      </tbody>
    </table>
  );
}

function DayRow({
  day,
  dayIndex,
  dayCount,
  expanded,
  dragging,
  reorderDisabled,
  onToggle,
  onMoveUp,
  onMoveDown,
  onDragStart,
  onDragEnd,
  onDropOn,
  onSaveDay,
  onDeleteDay,
  onOpenPicker,
  onSaveExercise,
  onRemoveExercise,
  onReorderExercises,
}: {
  day: DayWithWorkout;
  dayIndex: number;
  dayCount: number;
  expanded: boolean;
  dragging: boolean;
  reorderDisabled: boolean;
  onToggle: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDropOn: () => void;
  onSaveDay: (id: string, patch: Partial<Pick<TrainingDayRow, 'title' | 'day_type'>>) => Promise<void>;
  onDeleteDay: (day: DayWithWorkout) => Promise<void>;
  onOpenPicker: (day: DayWithWorkout) => void;
  onSaveExercise: (
    id: string,
    patch: Partial<Pick<WorkoutExerciseRow, 'sets' | 'reps' | 'rest_seconds' | 'weight_kg'>>
  ) => Promise<void>;
  onRemoveExercise: (id: string) => Promise<void>;
  onReorderExercises: (orderedIds: string[]) => Promise<void>;
}): React.JSX.Element {
  const [title, setTitle] = useState(day.title);
  const exercises = [...(day.workout?.exercises ?? [])].sort((a, b) => a.sort_order - b.sort_order);
  const isRest = day.day_type === 'descanso';
  const typeLabel = DAY_TYPES.find((t) => t.value === day.day_type)?.label ?? day.day_type;

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <>
      <tr
        className={`row-clickable${dragging ? ' dragging' : ''}`}
        draggable={!reorderDisabled}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDropOn}
        onClick={onToggle}
      >
        <td className="day-col-order" onClick={stop}>
          <button type="button" className="ex-drag" title="Arrastrar día" aria-label="Arrastrar día">
            ⠿
          </button>
        </td>
        <td>
          <div className="cell-user">
            <span className="day-pill">Día {day.day_number}</span>
            <input
              className="inline-input"
              value={title}
              onClick={stop}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => title !== day.title && void onSaveDay(day.id, { title })}
            />
          </div>
        </td>
        <td>
          <span className={`badge solid ${TYPE_BADGE[day.day_type]}`}>{typeLabel}</span>
        </td>
        <td className="muted">{isRest ? '—' : `${exercises.length} ejercicio${exercises.length === 1 ? '' : 's'}`}</td>
        <td style={{ textAlign: 'right' }} onClick={stop}>
          <div className="ex-move">
            <button
              type="button"
              className="icon-btn sm"
              title="Subir día"
              disabled={dayIndex === 0 || reorderDisabled}
              onClick={onMoveUp}
            >
              ↑
            </button>
            <button
              type="button"
              className="icon-btn sm"
              title="Bajar día"
              disabled={dayIndex >= dayCount - 1 || reorderDisabled}
              onClick={onMoveDown}
            >
              ↓
            </button>
            <button className="icon-btn sm" title="Eliminar día" onClick={() => void onDeleteDay(day)}>
              ✕
            </button>
          </div>
        </td>
      </tr>
      {expanded ? (
        <tr className="expand-row">
          <td colSpan={5}>
            <div className="day-edit">
              <div className="field day-type-field">
                <label>Tipo de día</label>
                <select
                  className="inline-select"
                  value={day.day_type}
                  onChange={(e) => void onSaveDay(day.id, { day_type: e.target.value as WorkoutType })}
                >
                  {DAY_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              {isRest ? (
                <p className="muted" style={{ margin: 0 }}>Día de descanso — sin ejercicios.</p>
              ) : (
                <>
                  <p className="muted ex-list-hint">Arrastrá o usá las flechas para reordenar. Los cambios en series y reps se guardan al salir del campo.</p>
                  <ExerciseListEditor
                    exercises={exercises}
                    onSave={onSaveExercise}
                    onRemove={onRemoveExercise}
                    onReorder={onReorderExercises}
                  />
                  <button className="add-ex" onClick={() => onOpenPicker(day)}>
                    + Agregar ejercicio
                  </button>
                </>
              )}
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

function ExerciseListEditor({
  exercises,
  onSave,
  onRemove,
  onReorder,
}: {
  exercises: WorkoutExerciseWithExercise[];
  onSave: (
    id: string,
    patch: Partial<Pick<WorkoutExerciseRow, 'sets' | 'reps' | 'rest_seconds' | 'weight_kg'>>
  ) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onReorder: (orderedIds: string[]) => Promise<void>;
}): React.JSX.Element {
  const [items, setItems] = useState(exercises);
  const [dragId, setDragId] = useState<string | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);

  useEffect(() => {
    setItems(exercises);
  }, [exercises]);

  const move = async (from: number, to: number) => {
    if (from === to || to < 0 || to >= items.length) return;
    const next = [...items];
    const [removed] = next.splice(from, 1);
    next.splice(to, 0, removed);
    setItems(next);
    setSavingOrder(true);
    try {
      await onReorder(next.map((item) => item.id));
    } finally {
      setSavingOrder(false);
    }
  };

  return (
    <ul className={`ex-list${savingOrder ? ' saving' : ''}`}>
      {items.map((we, index) => (
        <li
          key={we.id}
          className={`ex-row${dragId === we.id ? ' dragging' : ''}`}
          draggable
          onDragStart={() => setDragId(we.id)}
          onDragEnd={() => setDragId(null)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => {
            if (!dragId || dragId === we.id) return;
            const from = items.findIndex((item) => item.id === dragId);
            void move(from, index);
            setDragId(null);
          }}
        >
          <button type="button" className="ex-drag" title="Arrastrar" aria-label="Arrastrar">
            ⠿
          </button>
          <div className="ex-thumb ex-thumb-icon" aria-hidden>
            <DumbbellIcon size={14} />
          </div>
          <span className="ex-name">{we.exercise?.name ?? 'Ejercicio'}</span>
          <div className="ex-fields">
            <input
              className="inline-input mini"
              type="number"
              min={1}
              title="Series"
              defaultValue={we.sets}
              onBlur={(e) => void onSave(we.id, { sets: Number(e.target.value) })}
            />
            <span className="ex-x">×</span>
            <input
              className="inline-input mini wide"
              title="Repeticiones"
              defaultValue={we.reps}
              onBlur={(e) => void onSave(we.id, { reps: e.target.value })}
            />
            <input
              className="inline-input mini"
              type="number"
              min={0}
              step="0.5"
              title="Peso (kg)"
              placeholder="kg"
              defaultValue={we.weight_kg ?? ''}
              onBlur={(e) =>
                void onSave(we.id, {
                  weight_kg: e.target.value === '' ? null : Number(e.target.value),
                })
              }
            />
            <input
              className="inline-input mini"
              type="number"
              min={0}
              title="Descanso (seg)"
              placeholder="seg"
              defaultValue={we.rest_seconds ?? ''}
              onBlur={(e) =>
                void onSave(we.id, {
                  rest_seconds: e.target.value === '' ? null : Number(e.target.value),
                })
              }
            />
          </div>
          <div className="ex-move">
            <button
              type="button"
              className="icon-btn sm"
              title="Subir"
              disabled={index === 0 || savingOrder}
              onClick={() => void move(index, index - 1)}
            >
              ↑
            </button>
            <button
              type="button"
              className="icon-btn sm"
              title="Bajar"
              disabled={index === items.length - 1 || savingOrder}
              onClick={() => void move(index, index + 1)}
            >
              ↓
            </button>
            <button type="button" className="icon-btn sm" title="Quitar" onClick={() => void onRemove(we.id)}>
              ✕
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

function ExercisePicker({
  onClose,
  onPick,
}: {
  onClose: () => void;
  onPick: (ex: CatalogExercise) => Promise<void>;
}): React.JSX.Element {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CatalogExercise[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const t = setTimeout(() => {
      void (async () => {
        let q = supabase.from('exercises').select('id, name, image_url, target_muscles').order('name').limit(40);
        if (query.trim()) q = q.ilike('name', `%${query.trim()}%`);
        const { data } = await q;
        if (!active) return;
        setResults((data ?? []) as CatalogExercise[]);
        setLoading(false);
      })();
    }, 200);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [query]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="row-between" style={{ marginBottom: 16 }}>
          <h2 className="page-title" style={{ fontSize: 18, margin: 0 }}>
            Agregar ejercicio
          </h2>
          <button className="icon-btn" onClick={onClose}>
            ✕
          </button>
        </div>
        <input
          className="field-input"
          placeholder="Buscar ejercicio…"
          value={query}
          autoFocus
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="picker-list">
          {loading ? (
            <div className="muted" style={{ padding: 12 }}>
              Buscando…
            </div>
          ) : results.length === 0 ? (
            <div className="muted" style={{ padding: 12 }}>
              Sin resultados.
            </div>
          ) : (
            results.map((ex) => (
              <button key={ex.id} className="picker-row" onClick={() => void onPick(ex)}>
                <div className="ex-thumb ex-thumb-icon" aria-hidden>
                  <DumbbellIcon size={14} />
                </div>
                <div className="ex-info">
                  <span className="ex-name">{ex.name}</span>
                  {ex.target_muscles?.length ? (
                    <span className="muted ex-sub">{ex.target_muscles.join(', ')}</span>
                  ) : null}
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
