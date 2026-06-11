-- ════════════════════════════════════════════════════════════════
-- 0002 — Metas: templates, asignaciones del coach y metas diarias
-- ════════════════════════════════════════════════════════════════

create table if not exists public.goal_templates (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  goal_type    text not null check (goal_type in ('hydration','steps','training','meals','custom')),
  target_value numeric not null default 1,
  target_unit  text not null default 'boolean' check (target_unit in ('ml','steps','minutes','meals','boolean')),
  icon         text default 'target',
  color        text default '#BEFC50',
  is_active    boolean default true,
  sort_order   int default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.goal_assignments (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  assigned_by  uuid references auth.users(id) on delete set null,
  template_id  uuid references public.goal_templates(id) on delete set null,
  title        text not null,
  goal_type    text not null default 'custom' check (goal_type in ('hydration','steps','training','meals','custom')),
  target_value numeric not null default 1,
  target_unit  text not null default 'boolean' check (target_unit in ('ml','steps','minutes','meals','boolean')),
  icon         text default 'star',
  color        text default '#BEFC50',
  start_date   date not null,
  end_date     date not null,
  is_active    boolean default true,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check (end_date >= start_date)
);
create index if not exists idx_goal_assignments_active on public.goal_assignments(user_id, is_active, start_date, end_date);

create table if not exists public.daily_goals (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  date          date not null default current_date,
  text          text not null,
  goal_type     text default 'custom' check (goal_type in ('hydration','steps','training','meals','custom')),
  target_value  numeric default 1,
  current_value numeric default 0,
  target_unit   text default 'boolean' check (target_unit in ('ml','steps','minutes','meals','boolean')),
  auto_track    boolean default false,
  template_id   uuid references public.goal_templates(id) on delete set null,
  completed     boolean not null default false,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique(user_id, date, text)
);
create index if not exists idx_daily_goals_user_date on public.daily_goals(user_id, date);
create index if not exists idx_daily_goals_type on public.daily_goals(user_id, date, goal_type);

-- Triggers updated_at
drop trigger if exists on_goal_templates_updated on public.goal_templates;
create trigger on_goal_templates_updated before update on public.goal_templates
  for each row execute function public.handle_updated_at();
drop trigger if exists on_goal_assignments_updated on public.goal_assignments;
create trigger on_goal_assignments_updated before update on public.goal_assignments
  for each row execute function public.handle_updated_at();
drop trigger if exists on_daily_goals_updated on public.daily_goals;
create trigger on_daily_goals_updated before update on public.daily_goals
  for each row execute function public.handle_updated_at();

-- RLS
alter table public.goal_templates enable row level security;
alter table public.goal_assignments enable row level security;
alter table public.daily_goals enable row level security;

-- Catálogo: lectura authenticated, escritura admin
drop policy if exists "goal_templates: read" on public.goal_templates;
create policy "goal_templates: read" on public.goal_templates for select to authenticated using (true);
drop policy if exists "goal_templates: admin all" on public.goal_templates;
create policy "goal_templates: admin all" on public.goal_templates for all using (private.is_admin());

-- Asignaciones: el usuario ve las suyas; admin gestiona todas
drop policy if exists "goal_assignments: select own" on public.goal_assignments;
create policy "goal_assignments: select own" on public.goal_assignments for select using (auth.uid() = user_id);
drop policy if exists "goal_assignments: admin all" on public.goal_assignments;
create policy "goal_assignments: admin all" on public.goal_assignments for all using (private.is_admin());

-- Metas diarias: CRUD propio
drop policy if exists "daily_goals: select own" on public.daily_goals;
create policy "daily_goals: select own" on public.daily_goals for select using (auth.uid() = user_id);
drop policy if exists "daily_goals: insert own" on public.daily_goals;
create policy "daily_goals: insert own" on public.daily_goals for insert with check (auth.uid() = user_id);
drop policy if exists "daily_goals: update own" on public.daily_goals;
create policy "daily_goals: update own" on public.daily_goals for update using (auth.uid() = user_id);
drop policy if exists "daily_goals: delete own" on public.daily_goals;
create policy "daily_goals: delete own" on public.daily_goals for delete using (auth.uid() = user_id);
