-- ════════════════════════════════════════════════════════════════
-- 0003 — Entrenamiento: logs + catálogo global (ejercicios, fases, rutinas)
-- ════════════════════════════════════════════════════════════════

-- Logs de sesión (fuerza/cardio + sesión activa persistente)
create table if not exists public.workout_logs (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  date                date not null default current_date,
  workout_name        text not null default '',
  workout_type        text,
  duration_min        int check (duration_min >= 0),
  rpe                 int check (rpe between 1 and 10),
  comments            text,
  completed           boolean not null default true,
  elapsed_seconds     int default 0,
  completed_exercises text[],
  cardio_activity     text,
  distance            numeric(12,4),
  distance_unit       text,
  duration_seconds    int,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists idx_workout_logs_user_date on public.workout_logs(user_id, date desc);

-- Catálogo de ejercicios (id TEXT para soportar uuid/slug/ids externos tipo ExerciseDB)
create table if not exists public.exercises (
  id                text primary key default (gen_random_uuid())::text,
  external_source   text,
  external_id       text,
  slug              text unique,
  name              text not null,
  body_part         text,
  body_parts        text[],
  target_muscles    text[],
  secondary_muscles text[],
  equipment         text[],
  exercise_type     text,
  image_url         text,
  video_url         text,
  instructions      text[],
  metadata          jsonb not null default '{}',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create unique index if not exists exercises_external_unique on public.exercises(external_source, external_id)
  where external_source is not null and external_id is not null;

create table if not exists public.training_phases (
  id           uuid primary key default gen_random_uuid(),
  program_key  text default 'default',
  phase_number int not null default 1,
  name         text not null,
  description  text,
  sort_order   int not null default 0,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.workouts (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  workout_type text not null default 'fuerza'
    check (workout_type in ('fuerza','cardio','descanso','movilidad','tecnica')),
  duration_min int check (duration_min is null or duration_min >= 0),
  blocks       int not null default 1 check (blocks >= 1),
  calories_est int check (calories_est is null or calories_est >= 0),
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.workout_exercises (
  id           uuid primary key default gen_random_uuid(),
  workout_id   uuid not null references public.workouts(id) on delete cascade,
  exercise_id  text not null references public.exercises(id) on delete restrict,
  sort_order   int not null default 0,
  sets         int not null default 3 check (sets >= 1),
  reps         text not null default '10',
  weight_kg    numeric(6,2),
  tempo        text,
  rest_seconds int check (rest_seconds is null or rest_seconds >= 0),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique(workout_id, sort_order)
);

create table if not exists public.training_days (
  id         uuid primary key default gen_random_uuid(),
  phase_id   uuid not null references public.training_phases(id) on delete cascade,
  day_number int not null check (day_number between 1 and 14),
  title      text not null,
  day_type   text not null default 'fuerza'
    check (day_type in ('fuerza','cardio','descanso','tecnica','movilidad')),
  workout_id uuid references public.workouts(id) on delete set null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(phase_id, day_number)
);

-- Triggers updated_at
drop trigger if exists on_workout_logs_updated on public.workout_logs;
create trigger on_workout_logs_updated before update on public.workout_logs
  for each row execute function public.handle_updated_at();
drop trigger if exists on_exercises_updated on public.exercises;
create trigger on_exercises_updated before update on public.exercises
  for each row execute function public.handle_updated_at();
drop trigger if exists on_training_phases_updated on public.training_phases;
create trigger on_training_phases_updated before update on public.training_phases
  for each row execute function public.handle_updated_at();
drop trigger if exists on_workouts_updated on public.workouts;
create trigger on_workouts_updated before update on public.workouts
  for each row execute function public.handle_updated_at();
drop trigger if exists on_workout_exercises_updated on public.workout_exercises;
create trigger on_workout_exercises_updated before update on public.workout_exercises
  for each row execute function public.handle_updated_at();
drop trigger if exists on_training_days_updated on public.training_days;
create trigger on_training_days_updated before update on public.training_days
  for each row execute function public.handle_updated_at();

-- RLS
alter table public.workout_logs enable row level security;
alter table public.exercises enable row level security;
alter table public.training_phases enable row level security;
alter table public.workouts enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.training_days enable row level security;

-- workout_logs: CRUD propio
drop policy if exists "workout_logs: select own" on public.workout_logs;
create policy "workout_logs: select own" on public.workout_logs for select using (auth.uid() = user_id);
drop policy if exists "workout_logs: insert own" on public.workout_logs;
create policy "workout_logs: insert own" on public.workout_logs for insert with check (auth.uid() = user_id);
drop policy if exists "workout_logs: update own" on public.workout_logs;
create policy "workout_logs: update own" on public.workout_logs for update using (auth.uid() = user_id);
drop policy if exists "workout_logs: delete own" on public.workout_logs;
create policy "workout_logs: delete own" on public.workout_logs for delete using (auth.uid() = user_id);

-- Catálogo: lectura authenticated, escritura admin
do $$
declare t text;
begin
  foreach t in array array['exercises','training_phases','workouts','workout_exercises','training_days'] loop
    execute format('drop policy if exists "%s: read" on public.%I', t, t);
    execute format('create policy "%s: read" on public.%I for select to authenticated using (true)', t, t);
    execute format('drop policy if exists "%s: admin all" on public.%I', t, t);
    execute format('create policy "%s: admin all" on public.%I for all using (private.is_admin())', t, t);
  end loop;
end $$;
