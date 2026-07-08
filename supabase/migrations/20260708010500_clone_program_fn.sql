-- ════════════════════════════════════════════════════════════════
-- clone_program — copia atómica de un programa completo:
-- programs → training_phases → training_days → workouts → workout_exercises.
-- Usado por "Duplicar programa" (p_client_id = null) y por "Personalizar
-- para este cliente" (p_client_id = <cliente>), donde además el programa
-- clonado se marca con source_program_id apuntando al original.
-- ════════════════════════════════════════════════════════════════

create or replace function public.clone_program(
  p_program_id uuid,
  p_new_name   text,
  p_client_id  uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller       uuid := auth.uid();
  v_src          public.programs;
  v_new_id       uuid;
  v_new_key      text;
  v_phase        record;
  v_new_phase_id uuid;
  v_day          record;
  v_new_workout_id uuid;
begin
  select * into v_src from public.programs where id = p_program_id;
  if v_src is null then
    raise exception 'program_not_found';
  end if;
  if v_src.trainer_id <> v_caller then
    raise exception 'not_authorized';
  end if;

  v_new_key := 'program_' || replace(gen_random_uuid()::text, '-', '');

  insert into public.programs (trainer_id, program_key, name, note, duration_weeks, start_date, client_id, source_program_id, folder_id)
  values (v_src.trainer_id, v_new_key, coalesce(p_new_name, v_src.name), v_src.note, v_src.duration_weeks, v_src.start_date, p_client_id, p_program_id, v_src.folder_id)
  returning id into v_new_id;

  for v_phase in
    select * from public.training_phases where program_key = v_src.program_key order by sort_order
  loop
    insert into public.training_phases (program_key, trainer_id, phase_number, name, description, sort_order, is_active)
    values (v_new_key, v_src.trainer_id, v_phase.phase_number, v_phase.name, v_phase.description, v_phase.sort_order, v_phase.is_active)
    returning id into v_new_phase_id;

    for v_day in
      select * from public.training_days where phase_id = v_phase.id order by sort_order
    loop
      v_new_workout_id := null;
      if v_day.workout_id is not null then
        insert into public.workouts (trainer_id, client_id, title, workout_type, duration_min, blocks, calories_est, notes)
        select trainer_id, client_id, title, workout_type, duration_min, blocks, calories_est, notes
        from public.workouts where id = v_day.workout_id
        returning id into v_new_workout_id;

        insert into public.workout_exercises (workout_id, exercise_id, sort_order, sets, reps, weight_kg, tempo, rest_seconds)
        select v_new_workout_id, exercise_id, sort_order, sets, reps, weight_kg, tempo, rest_seconds
        from public.workout_exercises where workout_id = v_day.workout_id;
      end if;

      insert into public.training_days (phase_id, day_number, title, day_type, workout_id, sort_order)
      values (v_new_phase_id, v_day.day_number, v_day.title, v_day.day_type, v_new_workout_id, v_day.sort_order);
    end loop;
  end loop;

  return v_new_id;
end;
$$;

grant execute on function public.clone_program(uuid, text, uuid) to authenticated;

notify pgrst, 'reload schema';
