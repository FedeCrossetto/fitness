-- ════════════════════════════════════════════════════════════════
-- 0036 — Registrar pago manual (efectivo/transferencia) desde la web
-- ════════════════════════════════════════════════════════════════
-- Hasta ahora las suscripciones solo se creaban vía MercadoPago (mobile).
-- Este RPC permite al ENTRENADOR registrar un pago manual de un alumno suyo:
-- crea la suscripción activa y deja al alumno activado.
--
-- SECURITY DEFINER porque inserta en subscriptions de otro usuario (el alumno),
-- algo que RLS no permite directamente. Valida que el alumno sea cliente del
-- entrenador autenticado con private.is_my_client().

create or replace function public.register_manual_payment(
  p_client_id uuid,
  p_plan_id   text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_days int;
  v_sub_id uuid;
begin
  -- Solo el entrenador del alumno puede registrar su pago.
  if not private.is_my_client(p_client_id) then
    raise exception 'not_your_client';
  end if;

  select duration_days into v_days
  from public.plans
  where id = p_plan_id and active;

  if v_days is null then
    raise exception 'plan_not_found';
  end if;

  insert into public.subscriptions (user_id, plan_id, status, mp_status, started_at, expires_at)
  values (
    p_client_id,
    p_plan_id,
    'active',
    'manual',
    now(),
    now() + make_interval(days => v_days)
  )
  returning id into v_sub_id;

  -- Pagar = activar acceso.
  update public.profiles set client_status = 'active' where id = p_client_id;

  return v_sub_id;
end;
$$;

grant execute on function public.register_manual_payment(uuid, text) to authenticated;
