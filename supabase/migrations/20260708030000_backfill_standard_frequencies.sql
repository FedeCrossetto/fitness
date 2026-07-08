-- ════════════════════════════════════════════════════════════════
-- Backfill: a Base y Mentoría 1-1 (catálogo built-in) les faltaba la
-- frecuencia estándar de 12 meses (tenían 1-6, ver STANDARD_MONTHS en
-- ManagePlans.tsx = [1,3,6,12]). Se agrega inactiva (no visible en mobile)
-- con un precio de arranque = 2× el de 6 meses — el entrenador lo ajusta
-- desde /payments/planes antes de activarla, no es un precio final.
-- ════════════════════════════════════════════════════════════════

insert into public.plans (plan_type, name, description, price_ars, duration_days, active, trainer_id)
select
  p6.plan_type,
  replace(p6.name, '6', '12'),
  p6.description,
  p6.price_ars * 2,
  360,
  false,
  null
from public.plans p6
where p6.trainer_id is null
  and p6.plan_type in ('base', 'mentoria')
  and round(p6.duration_days / 30.0) = 6
  and not exists (
    select 1 from public.plans p12
    where p12.trainer_id is null
      and p12.plan_type = p6.plan_type
      and round(p12.duration_days / 30.0) = 12
  );

notify pgrst, 'reload schema';
