-- ════════════════════════════════════════════════════════════════
-- 0060 — Solicitudes de evaluación (Mentoría 1 a 1)
--   Lead capture: un cliente pending/interesado en Mentoría llena un
--   formulario corto (igual al de alegerezcoach.com/es/evaluacion) antes
--   de agendar la llamada 1-1 por Calendly.
-- ════════════════════════════════════════════════════════════════

create table if not exists public.evaluation_requests (
  id                uuid        primary key default gen_random_uuid(),
  client_id         uuid        not null references public.profiles(id) on delete cascade,
  trainer_id        uuid        not null references public.profiles(id) on delete cascade,
  full_name         text        not null,
  email             text        not null,
  phone_code        text        not null,
  phone             text        not null,
  city_country      text        not null,
  gender            text        not null check (gender in ('male', 'female', 'other')),
  weight_kg         numeric,
  height_cm         numeric,
  share_body_later  boolean     not null default false,
  main_goal         text        not null,
  situation         text        not null,
  accepted_terms    boolean     not null default false,
  status            text        not null default 'pending' check (status in ('pending', 'contacted', 'scheduled', 'completed', 'dismissed')),
  created_at        timestamptz not null default now()
);

create index if not exists idx_evaluation_requests_client  on public.evaluation_requests(client_id);
create index if not exists idx_evaluation_requests_trainer on public.evaluation_requests(trainer_id);

alter table public.evaluation_requests enable row level security;

drop policy if exists "clients_insert_evaluation_request" on public.evaluation_requests;
drop policy if exists "clients_select_own_evaluation_requests" on public.evaluation_requests;
drop policy if exists "trainers_read_evaluation_requests" on public.evaluation_requests;

create policy "clients_insert_evaluation_request" on public.evaluation_requests
  for insert to authenticated
  with check (
    client_id = auth.uid()
    and trainer_id = (select trainer_id from public.profiles where id = auth.uid())
  );

create policy "clients_select_own_evaluation_requests" on public.evaluation_requests
  for select to authenticated
  using (client_id = auth.uid());

create policy "trainers_read_evaluation_requests" on public.evaluation_requests
  for select to authenticated
  using (trainer_id = auth.uid());

notify pgrst, 'reload schema';
