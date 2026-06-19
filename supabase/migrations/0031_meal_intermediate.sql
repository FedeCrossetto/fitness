-- ════════════════════════════════════════════════════════════════
-- 0031 — Comida intermedia (colación) en el registro diario
-- ════════════════════════════════════════════════════════════════
-- Hasta ahora meal_type solo permitía DES/ALM/MER/CEN. Agregamos 'COL'
-- (colación / comida intermedia) para que el alumno pueda registrar una
-- comida extra entre las principales.

alter table public.meal_logs
  drop constraint if exists meal_logs_meal_type_check;

alter table public.meal_logs
  add constraint meal_logs_meal_type_check
  check (meal_type in ('DES', 'ALM', 'MER', 'CEN', 'COL'));
