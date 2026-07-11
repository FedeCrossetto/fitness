-- Nota fijada por ejercicio en la rutina (editor estilo Hevy: campo "Note").
alter table public.workout_exercises
  add column if not exists notes text;
