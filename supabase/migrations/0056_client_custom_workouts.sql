-- ════════════════════════════════════════════════════════════════
-- 0056 — Rutinas personalizadas del alumno (distintas del plan del entrenador)
-- ════════════════════════════════════════════════════════════════
-- Plan del entrenador: workouts con trainer_id, vinculados a training_days.
-- Rutina personalizada: workouts con client_id = auth.uid(), sin trainer_id.
-- Solo las personalizadas pueden ser editadas por el alumno (agregar ejercicios).

alter table public.workouts
  add column if not exists client_id uuid references auth.users(id) on delete cascade;

create index if not exists idx_workouts_client on public.workouts(client_id)
  where client_id is not null;

alter table public.workouts
  drop constraint if exists workouts_owner_check;

alter table public.workouts
  add constraint workouts_owner_check
  check (not (client_id is not null and trainer_id is not null));

-- El alumno gestiona sus rutinas personalizadas (requiere suscripción activa).
drop policy if exists "workouts: client manages custom" on public.workouts;
create policy "workouts: client manages custom" on public.workouts for all
  using (client_id = auth.uid())
  with check (
    client_id = auth.uid()
    and trainer_id is null
    and private.is_active_client()
  );

drop policy if exists "workout_exercises: client manages custom" on public.workout_exercises;
create policy "workout_exercises: client manages custom" on public.workout_exercises for all
  using (exists (
    select 1 from public.workouts w
    where w.id = workout_id and w.client_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.workouts w
    where w.id = workout_id and w.client_id = auth.uid()
  ));
