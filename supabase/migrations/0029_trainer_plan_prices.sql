-- ════════════════════════════════════════════════════════════════
-- 0029 — Precios de planes por entrenador + lectura de suscripciones
-- ════════════════════════════════════════════════════════════════

create table if not exists public.trainer_plan_prices (
  trainer_id  uuid not null references auth.users(id) on delete cascade,
  plan_id     text not null references public.plans(id) on delete cascade,
  price_ars   numeric(10,2) not null check (price_ars > 0),
  active      boolean not null default true,
  updated_at  timestamptz not null default now(),
  primary key (trainer_id, plan_id)
);

drop trigger if exists on_trainer_plan_prices_updated on public.trainer_plan_prices;
create trigger on_trainer_plan_prices_updated before update on public.trainer_plan_prices
  for each row execute function public.handle_updated_at();

alter table public.trainer_plan_prices enable row level security;

-- El entrenador gestiona sus precios.
drop policy if exists "trainer_plan_prices: trainer manages own" on public.trainer_plan_prices;
create policy "trainer_plan_prices: trainer manages own" on public.trainer_plan_prices for all
  using (trainer_id = auth.uid()) with check (trainer_id = auth.uid());

-- Admin gestiona todas.
drop policy if exists "trainer_plan_prices: admin all" on public.trainer_plan_prices;
create policy "trainer_plan_prices: admin all" on public.trainer_plan_prices for all
  using (private.is_admin());

-- Los clientes leen los precios de SU entrenador (checkout en la app).
drop policy if exists "trainer_plan_prices: client reads trainer" on public.trainer_plan_prices;
create policy "trainer_plan_prices: client reads trainer" on public.trainer_plan_prices for select
  using (trainer_id = private.my_trainer_id());
