-- ════════════════════════════════════════════════════════════════
-- 0057 — Pago manual con fecha de inicio elegida por el entrenador
-- ════════════════════════════════════════════════════════════════

create or replace function public.register_manual_payment(
  p_client_id  uuid,
  p_plan_id    text,
  p_started_at timestamptz default now()
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

  select duration_days into v_days
  from public.plans
  where id = p_plan_id and active;

  if v_days is null then
    raise exception 'plan_not_found';
  end if;

  v_start := coalesce(p_started_at, now());

  insert into public.subscriptions (user_id, plan_id, status, mp_status, started_at, expires_at)
  values (
    p_client_id,
    p_plan_id,
    'active',
    'manual',
    v_start,
    v_start + make_interval(days => v_days)
  )
  returning id into v_sub_id;

  update public.profiles set client_status = 'active' where id = p_client_id;

  return v_sub_id;
end;
$$;

grant execute on function public.register_manual_payment(uuid, text, timestamptz) to authenticated;
