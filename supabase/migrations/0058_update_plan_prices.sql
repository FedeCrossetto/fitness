-- ════════════════════════════════════════════════════════════════
-- 0058 — Actualización de precios de planes (según web)
--   Mensual:    $44.999 (total)
--   Trimestral: $39.999/mes  → $119.997 total
--   Semestral:  $36.666/mes  → $219.996 total
-- ════════════════════════════════════════════════════════════════

update public.plans set price_ars = 44999  where id = 'monthly';
update public.plans set price_ars = 119997 where id = 'quarterly';
update public.plans set price_ars = 219996 where id = 'semiannual';
