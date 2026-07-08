-- ════════════════════════════════════════════════════════════════
-- Permite crear planes con un plan_type propio (más allá de 'base' y
-- 'mentoria' fijos) — pedido: "Agregar plan" en /payments/planes con
-- detalles mínimos, en vez de solo poder borrar los dos tipos built-in.
-- No se toca consultation_form_configs (sigue limitado a base/mentoria a
-- propósito: un plan_type nuevo usa el formulario de consulta "Base" por
-- default hasta que se sume selector ahí — fuera de alcance de este cambio).
-- ════════════════════════════════════════════════════════════════

alter table public.plans
  drop constraint if exists plans_plan_type_check;

alter table public.trainer_plan_group_settings
  drop constraint if exists trainer_plan_group_settings_plan_type_check;

notify pgrst, 'reload schema';
