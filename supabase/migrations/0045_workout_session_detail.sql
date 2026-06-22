-- ════════════════════════════════════════════════════════════════
-- 0045 — Detalle de sesión (series, volumen) en workout_logs
-- ════════════════════════════════════════════════════════════════

alter table public.workout_logs
  add column if not exists workout_id uuid references public.workouts(id) on delete set null,
  add column if not exists session_detail jsonb,
  add column if not exists total_volume_kg numeric(12, 2),
  add column if not exists completed_sets int not null default 0;

create index if not exists idx_workout_logs_user_created
  on public.workout_logs(user_id, created_at desc);
