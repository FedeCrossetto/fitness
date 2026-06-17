-- ════════════════════════════════════════════════════════════════
-- 0017 — Deslinde de responsabilidad digital
--   waiver_configs    : texto del deslinde por entrenador
--   waiver_signatures : firma del cliente (imagen base64 + metadata)
-- Idempotente. Ejecutar en orden numérico.
-- ════════════════════════════════════════════════════════════════

-- Texto configurable del deslinde (uno por entrenador)
create table if not exists public.waiver_configs (
  id              uuid        primary key default gen_random_uuid(),
  trainer_id      uuid        not null references public.profiles(id) on delete cascade,
  title           text        not null default 'Deslinde de Responsabilidad',
  body            text        not null default '',
  require_before_start boolean not null default true,
  updated_at      timestamptz not null default now(),
  unique (trainer_id)
);

drop trigger if exists waiver_configs_updated_at on public.waiver_configs;
create trigger waiver_configs_updated_at
  before update on public.waiver_configs
  for each row execute function public.handle_updated_at();

alter table public.waiver_configs enable row level security;
drop policy if exists "trainers_own_waiver_cfg" on public.waiver_configs;
create policy "trainers_own_waiver_cfg" on public.waiver_configs
  for all using (trainer_id = auth.uid()) with check (trainer_id = auth.uid());

-- También permitir que el cliente lea la config de su entrenador
drop policy if exists "clients_read_waiver_cfg" on public.waiver_configs;
create policy "clients_read_waiver_cfg" on public.waiver_configs
  for select using (
    trainer_id = (
      select trainer_id from public.profiles where id = auth.uid()
    )
  );

-- ── Firmas ──
create table if not exists public.waiver_signatures (
  id                uuid        primary key default gen_random_uuid(),
  client_id         uuid        not null references public.profiles(id) on delete cascade,
  trainer_id        uuid        not null references public.profiles(id) on delete cascade,
  waiver_config_id  uuid        references public.waiver_configs(id) on delete set null,
  signature_data    text        not null,          -- JSON de strokes [[x,y],...]
  full_name         text        not null default '',
  document_snapshot text        not null default '', -- texto completo del deslinde al momento de firma
  document_title    text        not null default '',
  signed_at         timestamptz not null default now(),
  unique (client_id, trainer_id)
);

create index if not exists idx_waiver_sig_client  on public.waiver_signatures(client_id);
create index if not exists idx_waiver_sig_trainer on public.waiver_signatures(trainer_id);

alter table public.waiver_signatures enable row level security;

drop policy if exists "clients_own_signature"    on public.waiver_signatures;
drop policy if exists "trainers_read_signatures" on public.waiver_signatures;

-- El cliente puede insertar/ver su propia firma
create policy "clients_own_signature" on public.waiver_signatures
  for all using (client_id = auth.uid()) with check (client_id = auth.uid());

-- El entrenador puede ver las firmas de sus clientes
create policy "trainers_read_signatures" on public.waiver_signatures
  for select using (trainer_id = auth.uid());
