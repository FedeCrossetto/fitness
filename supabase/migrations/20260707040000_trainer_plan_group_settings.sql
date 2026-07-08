-- ════════════════════════════════════════════════════════════════
-- Configuración por-entrenador a nivel de GRUPO de plan (Base / Mentoría
-- 1 a 1), no por frecuencia individual: nombre mostrado, visibilidad y
-- soft-delete del grupo completo. Editable desde /payments/planes.
-- ════════════════════════════════════════════════════════════════

create table if not exists public.trainer_plan_group_settings (
  trainer_id    uuid        not null references public.profiles(id) on delete cascade,
  plan_type     text        not null check (plan_type in ('base', 'mentoria')),
  display_name  text,
  active        boolean     not null default true,
  deleted_at    timestamptz,
  updated_at    timestamptz not null default now(),
  primary key (trainer_id, plan_type)
);

alter table public.trainer_plan_group_settings enable row level security;

drop policy if exists "trainers_manage_own_plan_group_settings" on public.trainer_plan_group_settings;

create policy "trainers_manage_own_plan_group_settings" on public.trainer_plan_group_settings
  for all to authenticated
  using (trainer_id = auth.uid())
  with check (trainer_id = auth.uid());

notify pgrst, 'reload schema';
