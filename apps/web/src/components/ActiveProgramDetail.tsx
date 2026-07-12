import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type {
  ExerciseRow,
  ProgramRow,
  TrainingDayRow,
  WorkoutExerciseRow,
  WorkoutRow,
} from '@reset-fitness/shared/types/database';
import { supabase } from '@/lib/supabase';
import { useTranslation } from '@/hooks/useTranslation';
import { localizedExercise } from '@/lib/exerciseI18n';
import { parseIsoDateLocal, resolveActiveProgramKey } from '@/lib/activeProgram';

type CatalogExercise = Pick<ExerciseRow, 'id' | 'name' | 'target_muscles' | 'metadata'>;
type WorkoutExerciseWithExercise = WorkoutExerciseRow & { exercise: CatalogExercise | null };
type DayWithWorkout = TrainingDayRow & {
  workout: (WorkoutRow & { exercises: WorkoutExerciseWithExercise[] }) | null;
};

/** Panel "Active Program" (estilo Hevy): programa activo hoy del cliente,
 * con el detalle día por día de rutinas y ejercicios. Solo lectura — la
 * gestión (asignar/reemplazar/quitar/agendar) vive en ProgramAssignment,
 * debajo de este panel en el tab Entrenamiento. */
export function ActiveProgramDetail({ clientId }: { clientId: string }): React.JSX.Element {
  const navigate = useNavigate();
  const { language } = useTranslation();
  const [program, setProgram] = useState<ProgramRow | null>(null);
  const [days, setDays] = useState<DayWithWorkout[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    void (async () => {
      const { data: programRows } = await supabase.from('programs').select('*').eq('client_id', clientId);
      const programs = (programRows as ProgramRow[] | null) ?? [];
      const activeKey = resolveActiveProgramKey(programs);
      const active = programs.find((p) => p.program_key === activeKey) ?? null;
      setProgram(active);

      if (!active) { setDays([]); setLoading(false); return; }

      const { data: phaseRows } = await supabase
        .from('training_phases')
        .select('id')
        .eq('program_key', active.program_key)
        .order('sort_order')
        .limit(1);
      const phaseId = ((phaseRows as { id: string }[] | null) ?? [])[0]?.id;
      if (!phaseId) { setDays([]); setLoading(false); return; }

      const { data: dayRows } = await supabase
        .from('training_days')
        .select('*, workout:workouts(*, exercises:workout_exercises(sort_order, *, exercise:exercises(id, name, target_muscles, metadata)))')
        .eq('phase_id', phaseId)
        .order('day_number');
      setDays(((dayRows ?? []) as unknown as DayWithWorkout[]).map((d) => ({
        ...d,
        workout: d.workout ? { ...d.workout, exercises: [...d.workout.exercises].sort((a, b) => a.sort_order - b.sort_order) } : null,
      })));
      setLoading(false);
    })();
  }, [clientId]);

  const weekInfo = (() => {
    if (!program?.start_date || !program.duration_weeks) return null;
    const start = parseIsoDateLocal(program.start_date);
    const diffDays = Math.floor((Date.now() - start.getTime()) / 86400000);
    const week = Math.min(program.duration_weeks, Math.max(1, Math.floor(diffDays / 7) + 1));
    return `Semana ${week} de ${program.duration_weeks}`;
  })();

  if (loading) return <div className="card"><p className="muted" style={{ margin: 0 }}>Cargando programa…</p></div>;

  if (!program) {
    return (
      <div className="card">
        <div className="section-title" style={{ marginBottom: 4 }}>Programa activo</div>
        <p className="muted" style={{ margin: 0 }}>Este cliente no tiene un programa activo para hoy.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <div
        role="button"
        tabIndex={0}
        onClick={() => navigate(`/programs/${program.id}`)}
        onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/programs/${program.id}`); }}
        style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, cursor: 'pointer' }}
      >
        <div className="section-title" style={{ margin: 0 }}>{program.name}</div>
        {weekInfo && <span className="muted" style={{ fontSize: 12.5, whiteSpace: 'nowrap' }}>{weekInfo}</span>}
      </div>

      {days.length === 0 ? (
        <p className="muted" style={{ margin: '10px 0 0' }}>Este programa todavía no tiene rutinas.</p>
      ) : (
        <div style={{ marginTop: 12, maxHeight: 420, overflowY: 'auto' }}>
          {days.map((d) => (
            <div key={d.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 650, fontSize: 13.5, marginBottom: 4 }}>
                Día {d.day_number}{d.title ? ` - ${d.title}` : ''}
              </div>
              {d.workout && d.workout.exercises.length > 0 ? (
                <p className="muted" style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6 }}>
                  {d.workout.exercises.map((we) => {
                    const name = we.exercise ? localizedExercise(we.exercise, language).name : 'Ejercicio';
                    return `${we.sets ?? 1} × ${name}`;
                  }).join(', ')}
                </p>
              ) : (
                <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>Descanso</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
