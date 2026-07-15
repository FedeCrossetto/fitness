-- Soporte para rutinas de intervalos en workout_exercises.
--   kind='rest'      → fila de descanso entre ejercicios (sin exercise_id).
--   duration_seconds → duración del ejercicio (o del descanso) por tiempo.
--   circuit_group    → ejercicios adyacentes que forman un circuito.
--   circuit_rounds   → cantidad de rondas del circuito (repetido en cada miembro).
alter table public.workout_exercises
  alter column exercise_id drop not null,
  add column if not exists kind text not null default 'exercise'
    check (kind in ('exercise', 'rest')),
  add column if not exists duration_seconds int
    check (duration_seconds is null or duration_seconds >= 0),
  add column if not exists circuit_group uuid,
  add column if not exists circuit_rounds int
    check (circuit_rounds is null or circuit_rounds >= 1);

create index if not exists workout_exercises_circuit_group_idx
  on public.workout_exercises (circuit_group);
