-- Agrupación de ejercicios en superserie dentro de una rutina.
-- Los workout_exercises que comparten el mismo `superset_group` (y son
-- adyacentes por sort_order) se ejecutan alternando series, estilo Hevy.
-- Columna nullable → los ejercicios sueltos quedan con superset_group = null.
alter table public.workout_exercises
  add column if not exists superset_group uuid;

-- Filtramos/agrupamos por este valor al renderizar la rutina.
create index if not exists workout_exercises_superset_group_idx
  on public.workout_exercises (superset_group);
