import { useEffect, useState } from 'react';
import type {
  ExerciseRow,
  TrainingDayRow,
  TrainingPhaseRow,
  WorkoutExerciseRow,
  WorkoutRow,
} from '@habito/shared/types/database';
import { supabase } from '@/lib/supabase';

type WorkoutExerciseWithExercise = WorkoutExerciseRow & {
  exercise: Pick<ExerciseRow, 'id' | 'name' | 'image_url' | 'target_muscles'> | null;
};
type DayWithWorkout = TrainingDayRow & {
  workout: (WorkoutRow & { exercises: WorkoutExerciseWithExercise[] }) | null;
};
type PhaseWithDays = TrainingPhaseRow & { days: DayWithWorkout[] };

const sortByOrder = (a: WorkoutExerciseRow, b: WorkoutExerciseRow): number => a.sort_order - b.sort_order;

export function RoutinesPage(): React.JSX.Element {
  const [phases, setPhases] = useState<PhaseWithDays[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const { data: branding } = await supabase
          .from('trainer_branding')
          .select('default_program_key')
          .maybeSingle();
        const programKey = branding?.default_program_key ?? 'default';

        const { data: phaseRows, error: phasesError } = await supabase
          .from('training_phases')
          .select('*')
          .eq('program_key', programKey)
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

        if (!active) return;
        setPhases(
          phaseList.map((phase) => ({
            ...phase,
            days: days.filter((d) => d.phase_id === phase.id),
          }))
        );
        setLoading(false);
      } catch {
        if (!active) return;
        setError('No pudimos cargar el programa.');
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div>
      <h1 className="page-title">Rutinas</h1>
      <p className="page-sub">El programa de entrenamiento que ven tus alumnos en la app.</p>

      {loading ? (
        <div className="card muted">Cargando programa…</div>
      ) : error ? (
        <div className="card muted">{error}</div>
      ) : phases.length === 0 ? (
        <div className="card muted">
          Todavía no hay fases en tu programa. El editor para crearlas llega en la próxima fase.
        </div>
      ) : (
        phases.map((phase) => (
          <section key={phase.id} className="phase">
            <div className="phase-head">
              <span className="phase-num">Etapa {phase.phase_number}</span>
              <h2 className="phase-name">{phase.name}</h2>
              {phase.description ? <p className="muted phase-desc">{phase.description}</p> : null}
            </div>
            <div className="day-grid">
              {phase.days.length === 0 ? (
                <div className="muted" style={{ padding: 8 }}>
                  Sin días cargados.
                </div>
              ) : (
                phase.days.map((day) => <DayCard key={day.id} day={day} />)
              )}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

function DayCard({ day }: { day: DayWithWorkout }): React.JSX.Element {
  const exercises = [...(day.workout?.exercises ?? [])].sort(sortByOrder);
  const isRest = day.day_type === 'descanso' || exercises.length === 0;

  return (
    <div className="day-card">
      <div className="day-card-head">
        <span className="day-num">Día {day.day_number}</span>
        <h3 className="day-title">{day.title}</h3>
        <span className="muted day-meta">
          {isRest ? 'Descanso' : `${exercises.length} ejercicios`}
          {day.workout?.duration_min ? ` · ${day.workout.duration_min} min` : ''}
        </span>
      </div>
      {!isRest && (
        <ul className="ex-list">
          {exercises.map((we) => (
            <li key={we.id} className="ex-row">
              <div
                className="ex-thumb"
                style={we.exercise?.image_url ? { backgroundImage: `url(${we.exercise.image_url})` } : undefined}
              />
              <div className="ex-info">
                <span className="ex-name">{we.exercise?.name ?? 'Ejercicio'}</span>
                <span className="muted ex-sub">
                  {we.sets} × {we.reps}
                  {we.rest_seconds ? ` · ${we.rest_seconds}s` : ''}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
