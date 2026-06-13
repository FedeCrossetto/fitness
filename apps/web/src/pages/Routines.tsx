import { useCallback, useEffect, useState } from 'react';
import type {
  ExerciseRow,
  TrainingDayRow,
  TrainingPhaseRow,
  WorkoutExerciseRow,
  WorkoutRow,
  WorkoutType,
} from '@habito/shared/types/database';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

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
            '*, workout:workouts(*, exercises:workout_exercises(*, exercise:exercises(id, name, image_url, target_muscles)))'
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
    } as never);
    await load();
  };

  const renamePhase = async (id: string, name: string) => {
    await supabase.from('training_phases').update({ name } as never).eq('id', id);
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
      .insert({ trainer_id: trainerId, title: `Día ${nextNumber}`, workout_type: 'fuerza', blocks: 1 } as never)
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
    } as never);
    await load();
  };

  const saveDay = async (id: string, patch: Partial<Pick<TrainingDayRow, 'title' | 'day_type'>>) => {
    await supabase.from('training_days').update(patch as never).eq('id', id);
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
    } as never);
    await load();
  };

  const saveWorkoutExercise = async (
    id: string,
    patch: Partial<Pick<WorkoutExerciseRow, 'sets' | 'reps' | 'rest_seconds'>>
  ) => {
    await supabase.from('workout_exercises').update(patch as never).eq('id', id);
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
        <div className="card muted">Cargando programa…</div>
      ) : error ? (
        <div className="card muted">{error}</div>
      ) : phases.length === 0 ? (
        <div className="card muted">Todavía no hay etapas. Creá la primera con “Nueva etapa”.</div>
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
    patch: Partial<Pick<WorkoutExerciseRow, 'sets' | 'reps' | 'rest_seconds'>>
  ) => Promise<void>;
  onRemoveExercise: (id: string) => Promise<void>;
}): React.JSX.Element {
  const [name, setName] = useState(phase.name);

  return (
    <section className="phase">
      <div className="phase-head row-between">
        <div className="phase-head-left">
          <span className="phase-num">Etapa {phase.phase_number}</span>
          <input
            className="inline-input phase-name-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => name !== phase.name && void onRename(phase.id, name)}
          />
        </div>
        <button className="icon-btn" title="Eliminar etapa" onClick={() => void onDelete(phase.id)}>
          Eliminar
        </button>
      </div>

      <div className="day-grid">
        {phase.days.map((day) => (
          <DayEditor
            key={day.id}
            day={day}
            onSaveDay={onSaveDay}
            onDeleteDay={onDeleteDay}
            onOpenPicker={onOpenPicker}
            onSaveExercise={onSaveExercise}
            onRemoveExercise={onRemoveExercise}
          />
        ))}
        <button className="add-day" onClick={() => void onAddDay(phase)}>
          + Agregar día
        </button>
      </div>
    </section>
  );
}

function DayEditor({
  day,
  onSaveDay,
  onDeleteDay,
  onOpenPicker,
  onSaveExercise,
  onRemoveExercise,
}: {
  day: DayWithWorkout;
  onSaveDay: (id: string, patch: Partial<Pick<TrainingDayRow, 'title' | 'day_type'>>) => Promise<void>;
  onDeleteDay: (day: DayWithWorkout) => Promise<void>;
  onOpenPicker: (day: DayWithWorkout) => void;
  onSaveExercise: (
    id: string,
    patch: Partial<Pick<WorkoutExerciseRow, 'sets' | 'reps' | 'rest_seconds'>>
  ) => Promise<void>;
  onRemoveExercise: (id: string) => Promise<void>;
}): React.JSX.Element {
  const [title, setTitle] = useState(day.title);
  const exercises = [...(day.workout?.exercises ?? [])].sort((a, b) => a.sort_order - b.sort_order);
  const isRest = day.day_type === 'descanso';

  return (
    <div className="day-card">
      <div className="day-card-head">
        <span className="day-num">Día {day.day_number}</span>
        <input
          className="inline-input day-title-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title !== day.title && void onSaveDay(day.id, { title })}
        />
        <div className="day-controls">
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
          <button className="icon-btn" title="Eliminar día" onClick={() => void onDeleteDay(day)}>
            ✕
          </button>
        </div>
      </div>

      {!isRest && (
        <>
          <ul className="ex-list">
            {exercises.map((we) => (
              <li key={we.id} className="ex-row">
                <div
                  className="ex-thumb"
                  style={we.exercise?.image_url ? { backgroundImage: `url(${we.exercise.image_url})` } : undefined}
                />
                <div className="ex-info">
                  <span className="ex-name">{we.exercise?.name ?? 'Ejercicio'}</span>
                  <div className="ex-fields">
                    <input
                      className="inline-input mini"
                      type="number"
                      min={1}
                      defaultValue={we.sets}
                      onBlur={(e) => void onSaveExercise(we.id, { sets: Number(e.target.value) })}
                    />
                    <span className="ex-x">×</span>
                    <input
                      className="inline-input mini wide"
                      defaultValue={we.reps}
                      onBlur={(e) => void onSaveExercise(we.id, { reps: e.target.value })}
                    />
                    <input
                      className="inline-input mini"
                      type="number"
                      min={0}
                      placeholder="seg"
                      defaultValue={we.rest_seconds ?? ''}
                      onBlur={(e) =>
                        void onSaveExercise(we.id, {
                          rest_seconds: e.target.value === '' ? null : Number(e.target.value),
                        })
                      }
                    />
                  </div>
                </div>
                <button className="icon-btn" title="Quitar" onClick={() => void onRemoveExercise(we.id)}>
                  ✕
                </button>
              </li>
            ))}
          </ul>
          <button className="add-ex" onClick={() => onOpenPicker(day)}>
            + Agregar ejercicio
          </button>
        </>
      )}
    </div>
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
                <div
                  className="ex-thumb"
                  style={ex.image_url ? { backgroundImage: `url(${ex.image_url})` } : undefined}
                />
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
