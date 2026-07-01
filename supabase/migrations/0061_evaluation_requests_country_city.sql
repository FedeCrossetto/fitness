-- ════════════════════════════════════════════════════════════════
-- 0061 — evaluation_requests: país y ciudad por separado
--   El form ahora reusa el mismo selector de país/ciudad autocompletado
--   del onboarding (en vez de un campo libre "ciudad y país"), así que
--   el dato se guarda en dos columnas en vez de una sola.
-- ════════════════════════════════════════════════════════════════

alter table public.evaluation_requests
  add column if not exists country text,
  add column if not exists city    text;

update public.evaluation_requests
set country = coalesce(country, split_part(city_country, ',', 2)),
    city    = coalesce(city, split_part(city_country, ',', 1))
where city_country is not null;

alter table public.evaluation_requests
  alter column country set not null,
  alter column city set not null,
  drop column if exists city_country;

notify pgrst, 'reload schema';
