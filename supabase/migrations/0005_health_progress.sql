-- ════════════════════════════════════════════════════════════════
-- 0005 — Salud/Progreso: hidratación, medidas corporales, fotos
-- ════════════════════════════════════════════════════════════════

create table if not exists public.hydration_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  date       date not null default current_date,
  total_ml   int not null default 0 check (total_ml >= 0),
  goal_ml    int not null default 3000,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, date)
);

create table if not exists public.body_measurements (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  date         date not null default current_date,
  gender       text check (gender in ('male','female')),
  weight_kg    numeric(5,2),
  body_fat_pct numeric(4,1),
  chest_cm     numeric(5,1),
  waist_cm     numeric(5,1),
  hips_cm      numeric(5,1),
  arms_cm      numeric(5,1),
  legs_cm      numeric(5,1),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique(user_id, date)
);

create table if not exists public.progress_photos (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  position    text not null check (position in ('frente','perfil','espalda')),
  photo_url   text not null,
  week_number int not null,
  recorded_at date not null default current_date,
  created_at  timestamptz not null default now(),
  unique(user_id, position, recorded_at)
);

-- Triggers updated_at
drop trigger if exists on_hydration_logs_updated on public.hydration_logs;
create trigger on_hydration_logs_updated before update on public.hydration_logs
  for each row execute function public.handle_updated_at();
drop trigger if exists on_body_measurements_updated on public.body_measurements;
create trigger on_body_measurements_updated before update on public.body_measurements
  for each row execute function public.handle_updated_at();

-- RLS
alter table public.hydration_logs enable row level security;
alter table public.body_measurements enable row level security;
alter table public.progress_photos enable row level security;

do $$
declare t text;
begin
  foreach t in array array['hydration_logs','body_measurements','progress_photos'] loop
    execute format('drop policy if exists "%s: select own" on public.%I', t, t);
    execute format('create policy "%s: select own" on public.%I for select using (auth.uid() = user_id)', t, t);
    execute format('drop policy if exists "%s: insert own" on public.%I', t, t);
    execute format('create policy "%s: insert own" on public.%I for insert with check (auth.uid() = user_id)', t, t);
    execute format('drop policy if exists "%s: update own" on public.%I', t, t);
    execute format('create policy "%s: update own" on public.%I for update using (auth.uid() = user_id)', t, t);
    execute format('drop policy if exists "%s: delete own" on public.%I', t, t);
    execute format('create policy "%s: delete own" on public.%I for delete using (auth.uid() = user_id)', t, t);
  end loop;
end $$;
