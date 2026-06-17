-- ════════════════════════════════════════════════════════════════
-- 0015 — Formulario de consulta configurable por entrenador
-- Idempotente. Ejecutar en orden numérico.
-- ════════════════════════════════════════════════════════════════

create table if not exists public.consultation_form_configs (
  id          uuid        primary key default gen_random_uuid(),
  trainer_id  uuid        not null references public.profiles(id) on delete cascade,
  form_code   text        not null default '',
  updated_at  timestamptz not null default now(),
  unique (trainer_id)
);

drop trigger if exists consultation_form_updated_at on public.consultation_form_configs;
create trigger consultation_form_updated_at
  before update on public.consultation_form_configs
  for each row execute function public.handle_updated_at();

alter table public.consultation_form_configs enable row level security;

drop policy if exists "trainers_own_consultation" on public.consultation_form_configs;
create policy "trainers_own_consultation" on public.consultation_form_configs
  for all using  (trainer_id = auth.uid())
  with check     (trainer_id = auth.uid());
