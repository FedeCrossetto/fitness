-- ════════════════════════════════════════════════════════════════
-- 0008 — Funciones de metas (RPC, idempotentes)
-- ════════════════════════════════════════════════════════════════

-- Actualiza progreso de metas auto-trackeables y reporta transiciones de completitud
create or replace function public.update_goal_progress(
  p_user_id uuid, p_date date, p_goal_type text, p_current_value numeric)
returns table(goal_id uuid, was_completed boolean, is_now_completed boolean) as $$
begin
  -- Solo el propio usuario puede actualizar su progreso vía RPC
  if auth.uid() is distinct from p_user_id then
    raise exception 'No autorizado';
  end if;

  return query
  update public.daily_goals
  set current_value = p_current_value,
      completed = (p_current_value >= target_value),
      updated_at = now()
  where user_id = p_user_id and date = p_date and goal_type = p_goal_type and auto_track = true
  returning id, completed, (p_current_value >= target_value);
end;
$$ language plpgsql security definer set search_path = '';

-- Genera daily_goals del día desde asignaciones del admin; fallback a templates activos
create or replace function public.assign_goals_for_date(p_user_id uuid, p_date date)
returns void as $$
declare v_inserted int;
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'No autorizado';
  end if;

  insert into public.daily_goals (user_id,date,text,goal_type,target_value,target_unit,auto_track,sort_order,template_id)
  select p_user_id, p_date, a.title, a.goal_type, a.target_value, a.target_unit,
         a.goal_type <> 'custom', row_number() over (order by a.created_at), a.template_id
  from public.goal_assignments a
  where a.user_id = p_user_id and a.is_active and a.start_date <= p_date and a.end_date >= p_date
  on conflict (user_id,date,text) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    insert into public.daily_goals (user_id,date,text,goal_type,target_value,target_unit,auto_track,sort_order,template_id)
    select p_user_id, p_date, t.title, t.goal_type, t.target_value, t.target_unit,
           t.goal_type <> 'custom', t.sort_order, t.id
    from public.goal_templates t where t.is_active
    on conflict (user_id,date,text) do nothing;
  end if;
end;
$$ language plpgsql security definer set search_path = '';

grant execute on function public.update_goal_progress(uuid, date, text, numeric) to authenticated;
grant execute on function public.assign_goals_for_date(uuid, date) to authenticated;
