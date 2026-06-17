-- ════════════════════════════════════════════════════════════════
-- 0014 — Mensajes automáticos configurables por entrenador
-- Idempotente. Ejecutar en orden numérico.
-- ════════════════════════════════════════════════════════════════

create table if not exists public.auto_message_configs (
  id          uuid        primary key default gen_random_uuid(),
  trainer_id  uuid        not null references public.profiles(id) on delete cascade,
  trigger_key text        not null,
  schedule    text        not null default 'instant',
  message     text        not null default '',
  enabled     boolean     not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (trainer_id, trigger_key)
);

create index if not exists idx_auto_msg_trainer on public.auto_message_configs(trainer_id);

-- updated_at automático (reutiliza la función del migration 0001)
drop trigger if exists auto_message_configs_updated_at on public.auto_message_configs;
create trigger auto_message_configs_updated_at
  before update on public.auto_message_configs
  for each row execute function public.handle_updated_at();

-- ── RLS ──
alter table public.auto_message_configs enable row level security;

drop policy if exists "trainers_own_auto_msg"  on public.auto_message_configs;
create policy "trainers_own_auto_msg" on public.auto_message_configs
  for all using  (trainer_id = auth.uid())
  with check     (trainer_id = auth.uid());
