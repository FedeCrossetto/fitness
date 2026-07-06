-- ════════════════════════════════════════════════════════════════
-- 0067 — Realtime en plans + trainer_plan_prices
--   Para que la pantalla de planes de mobile refleje al instante los
--   cambios del entrenador (precio, visibilidad, alta/soft-delete de una
--   frecuencia) sin tener que backgroundear/reabrir la app. La visibilidad
--   de un plan built-in se guarda en trainer_plan_prices.active y la de un
--   custom en plans.active, así que se publican las dos tablas.
-- ════════════════════════════════════════════════════════════════

do $$
begin
  alter publication supabase_realtime add table public.plans;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.trainer_plan_prices;
exception when duplicate_object then null;
end $$;
