-- ════════════════════════════════════════════════════════════════
-- Suscripciones recurrentes de MercadoPago (Preapproval), en vez de
-- pago único (Preferencias). Ver plan en C:\Users\sebas\.claude\plans\
-- eager-popping-kitten.md para el contexto completo.
--
--   `expires_at` se sigue usando como ventana de acceso (con gracia):
--   el webhook la extiende ~35 días en cada cobro recurrente exitoso,
--   así toda la lógica de acceso/expiración existente (mobile + web)
--   sigue funcionando sin tocarla.
-- ════════════════════════════════════════════════════════════════

alter table public.subscriptions
  add column if not exists mp_preapproval_id text;

alter table public.subscriptions
  drop constraint if exists subscriptions_status_check;
alter table public.subscriptions
  add constraint subscriptions_status_check
  check (status in ('pending', 'active', 'expired', 'cancelled', 'paused'));

-- Un registro por cada cobro mensual recurrente (éxito o falla), para
-- que "Historial de pagos" en /payments pueda mostrar cada cobro real
-- en vez de una sola fila por suscripción.
create table if not exists public.subscription_charges (
  id              uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  mp_payment_id   text,
  amount_ars      numeric,
  status          text,
  charged_at      timestamptz not null default now(),
  created_at      timestamptz not null default now()
);
create index if not exists idx_subscription_charges_subscription on public.subscription_charges(subscription_id);

alter table public.subscription_charges enable row level security;

-- El entrenador lee los cobros de sus alumnos (vía la suscripción → user_id).
drop policy if exists "subscription_charges: trainer reads clients" on public.subscription_charges;
create policy "subscription_charges: trainer reads clients" on public.subscription_charges for select
  using (
    exists (
      select 1 from public.subscriptions s
      where s.id = subscription_id and private.is_my_client(s.user_id)
    )
  );

-- Admin gestiona todo.
drop policy if exists "subscription_charges: admin all" on public.subscription_charges;
create policy "subscription_charges: admin all" on public.subscription_charges for all
  using (private.is_admin());
