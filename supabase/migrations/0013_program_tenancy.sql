-- ════════════════════════════════════════════════════════════════
-- 0013 — Tenencia del sistema de programas de entrenamiento.
-- Hasta ahora training_phases/training_days/workouts/workout_exercises
-- eran de solo lectura (escritura solo admin) y compartían un único
-- program_key. Esto da a cada entrenador la propiedad de su programa
-- para poder crearlo/editarlo desde el panel web.
--
-- Modelo:
--   training_phases.trainer_id  : dueño de la fase (y su program_key)
--   workouts.trainer_id         : dueño del workout
--   training_days               : se scopea vía la fase padre
--   workout_exercises           : se scopea vía el workout padre
--   exercises                   : catálogo COMPARTIDO de solo lectura
-- Idempotente.
-- ════════════════════════════════════════════════════════════════

-- ── 1. Columnas de propiedad ──
alter table public.training_phases
  add column if not exists trainer_id uuid references auth.users(id) on delete cascade;
create index if not exists idx_training_phases_trainer on public.training_phases(trainer_id);

alter table public.workouts
  add column if not exists trainer_id uuid references auth.users(id) on delete cascade;
create index if not exists idx_workouts_trainer on public.workouts(trainer_id);

-- ── 2. Backfill del contenido existente al entrenador dueño del program_key ──
update public.training_phases p
  set trainer_id = b.trainer_id
  from public.trainer_branding b
  where b.default_program_key = p.program_key
    and p.trainer_id is null;

update public.workouts w
  set trainer_id = p.trainer_id
  from public.training_days d
  join public.training_phases p on p.id = d.phase_id
  where d.workout_id = w.id
    and p.trainer_id is not null
    and w.trainer_id is null;

-- ── 3. RLS: el entrenador gestiona su propio programa ──
-- (se conservan las policies de SELECT "...: read" que usa la app mobile)

drop policy if exists "training_phases: trainer manages own" on public.training_phases;
create policy "training_phases: trainer manages own" on public.training_phases for all
  using (trainer_id = auth.uid()) with check (trainer_id = auth.uid());

drop policy if exists "training_days: trainer manages own" on public.training_days;
create policy "training_days: trainer manages own" on public.training_days for all
  using (exists (select 1 from public.training_phases p
                 where p.id = phase_id and p.trainer_id = auth.uid()))
  with check (exists (select 1 from public.training_phases p
                      where p.id = phase_id and p.trainer_id = auth.uid()));

drop policy if exists "workouts: trainer manages own" on public.workouts;
create policy "workouts: trainer manages own" on public.workouts for all
  using (trainer_id = auth.uid()) with check (trainer_id = auth.uid());

drop policy if exists "workout_exercises: trainer manages own" on public.workout_exercises;
create policy "workout_exercises: trainer manages own" on public.workout_exercises for all
  using (exists (select 1 from public.workouts w
                 where w.id = workout_id and w.trainer_id = auth.uid()))
  with check (exists (select 1 from public.workouts w
                      where w.id = workout_id and w.trainer_id = auth.uid()));
