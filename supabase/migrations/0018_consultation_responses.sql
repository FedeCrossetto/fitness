-- ════════════════════════════════════════════════════════════════
-- 0018 — Respuestas del formulario de consulta
--   consultation_responses : respuestas del cliente al form del entrenador
-- Idempotente. Ejecutar en orden numérico.
-- ════════════════════════════════════════════════════════════════

create table if not exists public.consultation_responses (
  id           uuid        primary key default gen_random_uuid(),
  client_id    uuid        not null references public.profiles(id) on delete cascade,
  trainer_id   uuid        not null references public.profiles(id) on delete cascade,
  -- Array de objetos [{label, type, answer}] serializado como JSON
  responses    jsonb       not null default '[]',
  submitted_at timestamptz not null default now(),
  unique (client_id, trainer_id)
);

create index if not exists idx_consultation_resp_client  on public.consultation_responses(client_id);
create index if not exists idx_consultation_resp_trainer on public.consultation_responses(trainer_id);

alter table public.consultation_responses enable row level security;

-- El cliente puede insertar / actualizar / leer su propia respuesta
drop policy if exists "clients_own_consultation_response" on public.consultation_responses;
create policy "clients_own_consultation_response" on public.consultation_responses
  for all
  using  (client_id = auth.uid())
  with check (client_id = auth.uid());

-- El entrenador puede leer las respuestas de sus clientes
drop policy if exists "trainers_read_consultation_responses" on public.consultation_responses;
create policy "trainers_read_consultation_responses" on public.consultation_responses
  for select
  using (trainer_id = auth.uid());

-- Permitir que el cliente lea la config del formulario de su entrenador
drop policy if exists "clients_read_consultation_config" on public.consultation_form_configs;
create policy "clients_read_consultation_config" on public.consultation_form_configs
  for select
  using (
    trainer_id = (
      select trainer_id from public.profiles where id = auth.uid()
    )
  );
