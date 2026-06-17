-- ════════════════════════════════════════════════════════════════
-- 0016 — Estado del cliente: pending / active
-- Idempotente. Ejecutar en orden numérico.
-- ════════════════════════════════════════════════════════════════

alter table public.profiles
  add column if not exists client_status text default 'active'
  check (client_status in ('pending', 'active'));

create index if not exists idx_profiles_client_status on public.profiles(client_status);
