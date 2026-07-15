-- Formato de la rutina: define el editor (web) y el player (mobile).
--   'gym'      → series/reps/peso clásico (default, comportamiento actual).
--   'interval' → por tiempo: HIIT, TABATA, funcional (segundos + descansos + circuitos).
--   'cardio'   → sesión de cardio.
alter table public.workouts
  add column if not exists format text not null default 'gym'
    check (format in ('gym', 'interval', 'cardio'));
