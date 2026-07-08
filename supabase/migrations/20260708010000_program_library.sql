-- ════════════════════════════════════════════════════════════════
-- Librería de Programas — capa de metadata (nombre, nota, duración,
-- carpeta, asignación a cliente) sobre la jerarquía de entrenamiento que
-- YA existe (training_phases → training_days → workouts → workout_exercises).
-- No se toca esa jerarquía: cada `programs` row se identifica por su propio
-- `program_key` único, el mismo campo de texto que `training_phases.program_key`
-- ya usa y que mobile ya resuelve vía `profiles.assigned_program_key` /
-- `trainer_branding.default_program_key` (ver trainingStore.ts). Así, un
-- "Programa" de la librería sigue siendo, por debajo, un grupo de
-- training_phases con ese program_key — cero cambios en mobile.
-- ════════════════════════════════════════════════════════════════

create table if not exists public.program_folders (
  id          uuid        primary key default gen_random_uuid(),
  trainer_id  uuid        not null references public.profiles(id) on delete cascade,
  name        text        not null,
  created_at  timestamptz not null default now()
);

create table if not exists public.programs (
  id                 uuid        primary key default gen_random_uuid(),
  trainer_id         uuid        not null references public.profiles(id) on delete cascade,
  program_key        text        not null unique,
  name               text        not null default 'Untitled Program',
  note               text,
  duration_weeks     integer,
  start_date         date,
  -- null = plantilla compartida (librería); si tiene valor, es el clon
  -- "custom" de un cliente puntual (ver source_program_id).
  client_id          uuid        references public.profiles(id) on delete cascade,
  -- si este programa es un clon personalizado, apunta al programa
  -- plantilla del que se copió (para mostrarlo agrupado / trazabilidad).
  source_program_id  uuid        references public.programs(id) on delete set null,
  folder_id          uuid        references public.program_folders(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists idx_programs_trainer on public.programs(trainer_id);
create index if not exists idx_programs_client  on public.programs(client_id);
create index if not exists idx_program_folders_trainer on public.program_folders(trainer_id);

alter table public.programs enable row level security;
alter table public.program_folders enable row level security;

drop policy if exists "trainers_manage_own_programs" on public.programs;
create policy "trainers_manage_own_programs" on public.programs
  for all to authenticated
  using (trainer_id = auth.uid())
  with check (trainer_id = auth.uid());

drop policy if exists "trainers_manage_own_program_folders" on public.program_folders;
create policy "trainers_manage_own_program_folders" on public.program_folders
  for all to authenticated
  using (trainer_id = auth.uid())
  with check (trainer_id = auth.uid());

notify pgrst, 'reload schema';
