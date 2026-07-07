import { useEffect, useState } from 'react';
import type { RoutineRow, RoutineExerciseRow } from '@reset-fitness/shared/types/database';
import { supabase } from '@/lib/supabase';

type RoutineWithExercises = RoutineRow & { exercises: RoutineExerciseRow[] };

export function RoutineManager({ clientId }: { clientId: string }): React.JSX.Element {
  const [routines, setRoutines] = useState<RoutineWithExercises[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      const { data: rs } = await supabase
        .from('routines')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });
      const routineRows = (rs as RoutineRow[] | null) ?? [];
      let exerciseRows: RoutineExerciseRow[] = [];
      if (routineRows.length > 0) {
        const { data: ex } = await supabase
          .from('routine_exercises')
          .select('*')
          .in('routine_id', routineRows.map((r) => r.id))
          .order('order_index', { ascending: true });
        exerciseRows = (ex as RoutineExerciseRow[] | null) ?? [];
      }
      if (!active) return;
      setRoutines(routineRows.map((r) => ({ ...r, exercises: exerciseRows.filter((e) => e.routine_id === r.id) })));
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [clientId]);

  const createRoutine = async () => {
    const name = newName.trim();
    if (!name || creating) return;
    setCreating(true);
    const { data } = await supabase
      .from('routines')
      .insert({ client_id: clientId, name, days_per_week: 3, active: true })
      .select()
      .single();
    setCreating(false);
    if (data) {
      setRoutines((prev) => [{ ...(data as RoutineRow), exercises: [] }, ...prev]);
      setNewName('');
    }
  };

  const patchRoutine = (id: string, patch: Partial<RoutineRow>) => {
    setRoutines((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };
  const saveRoutine = async (id: string, patch: Partial<RoutineRow>) => {
    await supabase.from('routines').update(patch).eq('id', id);
  };
  const deleteRoutine = async (id: string) => {
    if (!confirm('¿Eliminar esta rutina y sus ejercicios?')) return;
    setRoutines((prev) => prev.filter((r) => r.id !== id));
    await supabase.from('routines').delete().eq('id', id);
  };

  const addExercise = async (routineId: string) => {
    const routine = routines.find((r) => r.id === routineId);
    const order = (routine?.exercises.reduce((m, e) => Math.max(m, e.order_index ?? 0), 0) ?? 0) + 1;
    const { data } = await supabase
      .from('routine_exercises')
      .insert({ routine_id: routineId, name: 'Nuevo ejercicio', sets: 3, reps: '10', order_index: order })
      .select()
      .single();
    if (data) {
      setRoutines((prev) =>
        prev.map((r) => (r.id === routineId ? { ...r, exercises: [...r.exercises, data as RoutineExerciseRow] } : r))
      );
    }
  };
  const patchExercise = (routineId: string, exId: string, patch: Partial<RoutineExerciseRow>) => {
    setRoutines((prev) =>
      prev.map((r) =>
        r.id === routineId
          ? { ...r, exercises: r.exercises.map((e) => (e.id === exId ? { ...e, ...patch } : e)) }
          : r
      )
    );
  };
  const saveExercise = async (exId: string, patch: Partial<RoutineExerciseRow>) => {
    await supabase.from('routine_exercises').update(patch).eq('id', exId);
  };
  const removeExercise = async (routineId: string, exId: string) => {
    setRoutines((prev) =>
      prev.map((r) => (r.id === routineId ? { ...r, exercises: r.exercises.filter((e) => e.id !== exId) } : r))
    );
    await supabase.from('routine_exercises').delete().eq('id', exId);
  };

  return (
    <div className="card">
      <h2 className="section-title" style={{ marginBottom: 14 }}>Rutinas asignadas</h2>

      <div className="composer" style={{ marginBottom: routines.length ? 18 : 0 }}>
        <input
          className="field-input"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void createRoutine();
            }
          }}
          placeholder="Nombre de la nueva rutina…"
        />
        <button className="btn" onClick={() => void createRoutine()} disabled={creating || !newName.trim()}>
          Crear
        </button>
      </div>

      {loading ? (
        <p className="muted" style={{ margin: 0 }}>Cargando…</p>
      ) : routines.length === 0 ? (
        <p className="muted" style={{ margin: 0 }}>Todavía no asignaste rutinas a este alumno.</p>
      ) : (
        <div className="routine-list">
          {routines.map((r) => (
            <div key={r.id} className="routine-block">
              <div className="routine-head">
                <input
                  className="inline-input phase-name-input"
                  style={{ fontSize: 16 }}
                  value={r.name}
                  onChange={(e) => patchRoutine(r.id, { name: e.target.value })}
                  onBlur={() => void saveRoutine(r.id, { name: r.name })}
                />
                <div className="routine-controls">
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={r.active ?? false}
                      onChange={(e) => {
                        patchRoutine(r.id, { active: e.target.checked });
                        void saveRoutine(r.id, { active: e.target.checked });
                      }}
                    />
                    Activa
                  </label>
                  <input
                    className="inline-input mini"
                    type="number"
                    min={1}
                    max={7}
                    value={r.days_per_week ?? 3}
                    onChange={(e) => patchRoutine(r.id, { days_per_week: Number(e.target.value) })}
                    onBlur={() => void saveRoutine(r.id, { days_per_week: r.days_per_week })}
                    aria-label="Días por semana"
                  />
                  <span className="ex-x">días/sem</span>
                  <button className="icon-btn" onClick={() => void deleteRoutine(r.id)}>Eliminar</button>
                </div>
              </div>

              <ul className="ex-list" style={{ marginTop: 12 }}>
                {r.exercises.map((e) => (
                  <li key={e.id} className="routine-ex">
                    <input
                      className="inline-input"
                      style={{ flex: 1, minWidth: 0 }}
                      value={e.name}
                      onChange={(ev) => patchExercise(r.id, e.id, { name: ev.target.value })}
                      onBlur={() => void saveExercise(e.id, { name: e.name })}
                    />
                    <div className="ex-fields">
                      <input
                        className="inline-input mini"
                        type="number"
                        min={1}
                        value={e.sets ?? ''}
                        onChange={(ev) => patchExercise(r.id, e.id, { sets: ev.target.value ? Number(ev.target.value) : null })}
                        onBlur={() => void saveExercise(e.id, { sets: e.sets })}
                        aria-label="Series"
                      />
                      <span className="ex-x">×</span>
                      <input
                        className="inline-input mini"
                        value={e.reps ?? ''}
                        onChange={(ev) => patchExercise(r.id, e.id, { reps: ev.target.value })}
                        onBlur={() => void saveExercise(e.id, { reps: e.reps })}
                        aria-label="Repeticiones"
                      />
                      <input
                        className="inline-input mini wide"
                        type="number"
                        min={0}
                        value={e.rest_secs ?? ''}
                        onChange={(ev) => patchExercise(r.id, e.id, { rest_secs: ev.target.value ? Number(ev.target.value) : null })}
                        onBlur={() => void saveExercise(e.id, { rest_secs: e.rest_secs })}
                        aria-label="Descanso (s)"
                        placeholder="seg"
                      />
                      <button className="icon-btn" onClick={() => void removeExercise(r.id, e.id)} aria-label="Quitar ejercicio">×</button>
                    </div>
                  </li>
                ))}
              </ul>

              <button className="add-ex" onClick={() => void addExercise(r.id)}>+ Agregar ejercicio</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
