-- ════════════════════════════════════════════════════════════════
-- 0065 — Frecuencias de facturación custom por entrenador
--   Hasta ahora `plans` era un catálogo 100% global (sembrado por
--   migración, solo el admin podía escribir). Esto agrega una columna
--   `trainer_id` (null = plan built-in, visible para todos) que permite
--   a cada entrenador crear sus propias frecuencias (ej. "7 meses") sin
--   tocar el catálogo de los demás. Se mantiene la FK
--   subscriptions.plan_id → plans.id intacta (mismo mecanismo de
--   siempre para registrar pagos manuales).
-- ════════════════════════════════════════════════════════════════

alter table public.plans
  add column if not exists trainer_id uuid references auth.users(id) on delete cascade;
create index if not exists idx_plans_trainer on public.plans(trainer_id);

-- `id` ya no lo arma siempre el seed: cuando un entrenador crea una
-- frecuencia nueva desde la webapp, se genera automáticamente.
alter table public.plans
  alter column id set default gen_random_uuid()::text;

-- ── RLS ──

-- Lectura: planes built-in (trainer_id null) para cualquier autenticado,
-- + los custom del propio entrenador, + los custom del entrenador de un
-- cliente (para que el cliente vea el plan en su suscripción activa).
drop policy if exists "plans: read" on public.plans;
create policy "plans: read" on public.plans for select to authenticated
  using (trainer_id is null or trainer_id = private.my_trainer_id());

-- El entrenador crea/edita/borra SOLO sus propias frecuencias custom.
-- Los planes built-in (trainer_id null) siguen protegidos —no matchean
-- trainer_id = auth.uid()— y solo los toca el admin (policy ya existente
-- "plans: admin all").
drop policy if exists "plans: trainer manages own custom" on public.plans;
create policy "plans: trainer manages own custom" on public.plans for insert
  with check (
    trainer_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'trainer')
  );

drop policy if exists "plans: trainer updates own custom" on public.plans;
create policy "plans: trainer updates own custom" on public.plans for update
  using (trainer_id = auth.uid()) with check (trainer_id = auth.uid());

drop policy if exists "plans: trainer deletes own custom" on public.plans;
create policy "plans: trainer deletes own custom" on public.plans for delete
  using (trainer_id = auth.uid());
