-- ════════════════════════════════════════════════════════════════
-- 0068 — Soft-delete por-entrenador de frecuencias built-in
--   Un plan built-in (trainer_id null) es un catálogo global que la RLS
--   no deja que el entrenador borre (solo el admin). Pero el entrenador
--   sí puede querer sacar una frecuencia no-estándar (ej. 2 meses) de SU
--   oferta. Reusamos trainer_plan_prices —la tabla de overrides por
--   entrenador— con un deleted_at: si tiene valor, esa frecuencia no se
--   ofrece para ese entrenador (ni en gestión ni en checkout), sin afectar
--   a los demás ni tocar el catálogo global.
--   Las frecuencias custom propias siguen usando plans.deleted_at (0066).
-- ════════════════════════════════════════════════════════════════

alter table public.trainer_plan_prices
  add column if not exists deleted_at timestamptz;
