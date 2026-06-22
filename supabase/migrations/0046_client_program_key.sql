-- ════════════════════════════════════════════════════════════════
-- 0046 — Programa de entrenamiento asignado por alumno
-- ════════════════════════════════════════════════════════════════

alter table public.profiles
  add column if not exists assigned_program_key text;

comment on column public.profiles.assigned_program_key is
  'Clave de training_phases.program_key asignada al alumno; null = default del branding del entrenador';

create index if not exists idx_profiles_assigned_program
  on public.profiles(assigned_program_key)
  where assigned_program_key is not null;
