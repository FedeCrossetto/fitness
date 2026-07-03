-- ════════════════════════════════════════════════════════════════
-- 0063 — Plan (Base/Mentoría) × Frecuencia de facturación (1-6 meses)
--   Separa dos dimensiones que hoy estaban mezcladas en un solo catálogo
--   de 3 filas (todas implícitamente "Base"): el TIPO de plan y la
--   frecuencia de facturación. Agrega el catálogo de Mentoría (que hasta
--   ahora no existía como suscripción, solo como evaluation_request) y
--   completa las frecuencias 2/4/5 meses que faltaban para Base.
--
--   Precios de Mentoría (reales, dados por el entrenador): 1 mes $150.000,
--   3 meses $375.000, 6 meses $600.000. Los de 2/4/5 meses son una
--   interpolación lineal del precio por mes entre esos tres puntos — el
--   entrenador puede ajustarlos después directo acá.
--   Mismo criterio para completar Base 2/4/5 meses a partir de los precios
--   reales existentes (1/3/6 meses, migración 0058).
--
--   Las 9 filas nuevas quedan `active = false`: no cambian el checkout
--   self-service de mobile ni la grilla "Planes y precios" de /payments
--   (ambos filtran por active=true), pero sí las puede usar el entrenador
--   al registrar un pago manual — para eso se saca el chequeo de `active`
--   del RPC más abajo.
-- ════════════════════════════════════════════════════════════════

alter table public.plans
  add column if not exists plan_type text not null default 'base' check (plan_type in ('base', 'mentoria'));

insert into public.plans (id, name, description, price_ars, duration_days, plan_type, active) values
  ('base_2mo',      'Base — 2 meses',       'Acceso completo por 2 meses', 85000,  60,  'base',     false),
  ('base_4mo',      'Base — 4 meses',       'Acceso completo por 4 meses', 155000, 120, 'base',     false),
  ('base_5mo',      'Base — 5 meses',       'Acceso completo por 5 meses', 189000, 150, 'base',     false),
  ('mentoria_1mo',  'Mentoría 1 a 1 — 1 mes',      'Mentoría 1 a 1 por 1 mes',   150000, 30,  'mentoria', false),
  ('mentoria_2mo',  'Mentoría 1 a 1 — 2 meses',    'Mentoría 1 a 1 por 2 meses', 275000, 60,  'mentoria', false),
  ('mentoria_3mo',  'Mentoría 1 a 1 — 3 meses',    'Mentoría 1 a 1 por 3 meses', 375000, 90,  'mentoria', false),
  ('mentoria_4mo',  'Mentoría 1 a 1 — 4 meses',    'Mentoría 1 a 1 por 4 meses', 467000, 120, 'mentoria', false),
  ('mentoria_5mo',  'Mentoría 1 a 1 — 5 meses',    'Mentoría 1 a 1 por 5 meses', 542000, 150, 'mentoria', false),
  ('mentoria_6mo',  'Mentoría 1 a 1 — 6 meses',    'Mentoría 1 a 1 por 6 meses', 600000, 180, 'mentoria', false)
on conflict (id) do nothing;

alter table public.subscriptions
  add column if not exists amount_ars numeric;

comment on column public.subscriptions.amount_ars is
  'Monto realmente facturado (puede diferir de plans.price_ars por un override manual). Filas viejas quedan en null.';

-- ── register_manual_payment: agrega p_amount_ars y deja de exigir active=true ──
drop function if exists public.register_manual_payment(uuid, text, timestamptz);

create or replace function public.register_manual_payment(
  p_client_id   uuid,
  p_plan_id     text,
  p_started_at  timestamptz default now(),
  p_amount_ars  numeric default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_days int;
  v_sub_id uuid;
  v_start timestamptz;
begin
  if not private.is_my_client(p_client_id) then
    raise exception 'not_your_client';
  end if;

  -- Ya no se exige active=true: registrar un pago manual es una acción
  -- administrativa explícita del entrenador, no un checkout self-service.
  select duration_days into v_days
  from public.plans
  where id = p_plan_id;

  if v_days is null then
    raise exception 'plan_not_found';
  end if;

  v_start := coalesce(p_started_at, now());

  insert into public.subscriptions (user_id, plan_id, status, mp_status, started_at, expires_at, amount_ars)
  values (
    p_client_id,
    p_plan_id,
    'active',
    'manual',
    v_start,
    v_start + make_interval(days => v_days),
    p_amount_ars
  )
  returning id into v_sub_id;

  update public.profiles set client_status = 'active' where id = p_client_id;

  return v_sub_id;
end;
$$;

grant execute on function public.register_manual_payment(uuid, text, timestamptz, numeric) to authenticated;

notify pgrst, 'reload schema';
