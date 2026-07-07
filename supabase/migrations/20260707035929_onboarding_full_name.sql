-- ════════════════════════════════════════════════════════════════
-- 0073 — Onboarding: guardar full_name (Nombre + Apellido) del paso 1
--   El onboarding ahora pide Nombre/Apellido como campos propios (antes
--   solo venían de signup/OAuth y no se podían corregir). Se agrega un
--   parámetro opcional al final del RPC existente (compatible con
--   llamadas viejas que no lo manden) para persistir el full_name
--   corregido en profiles y user_profiles.
-- ════════════════════════════════════════════════════════════════

create or replace function public.save_client_onboarding_intake(
  p_phone text,
  p_goal text,
  p_level text,
  p_gender text,
  p_weight_kg numeric,
  p_responses jsonb,
  p_full_name text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_trainer_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select trainer_id into v_trainer_id
  from public.profiles
  where id = v_uid;

  update public.profiles
  set
    phone = nullif(trim(p_phone), ''),
    goal = nullif(trim(p_goal), ''),
    full_name = coalesce(nullif(trim(p_full_name), ''), full_name)
  where id = v_uid;

  update public.user_profiles
  set
    level = coalesce(nullif(trim(p_level), ''), 'Principiante'),
    full_name = coalesce(nullif(trim(p_full_name), ''), full_name)
  where user_id = v_uid;

  if p_gender in ('male', 'female')
     and p_weight_kg is not null
     and p_weight_kg > 0 then
    insert into public.body_measurements (user_id, date, gender, weight_kg)
    values (v_uid, current_date, p_gender, p_weight_kg)
    on conflict (user_id, date) do update
      set gender = excluded.gender,
          weight_kg = excluded.weight_kg,
          updated_at = now();
  end if;

  if v_trainer_id is not null and p_responses is not null then
    insert into public.consultation_responses (client_id, trainer_id, responses, submitted_at)
    values (v_uid, v_trainer_id, p_responses, now())
    on conflict (client_id, trainer_id) do update
      set responses = excluded.responses,
          submitted_at = excluded.submitted_at;
  end if;
end;
$$;

revoke all on function public.save_client_onboarding_intake(text, text, text, text, numeric, jsonb, text) from public;
grant execute on function public.save_client_onboarding_intake(text, text, text, text, numeric, jsonb, text) to authenticated;
