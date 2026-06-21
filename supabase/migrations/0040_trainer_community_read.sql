-- ════════════════════════════════════════════════════════════════
-- 0040 — Lectura del entrenador en chats grupales (badge inbox unificado)
-- ════════════════════════════════════════════════════════════════

alter table public.communities
  add column if not exists trainer_last_read_at timestamptz;
