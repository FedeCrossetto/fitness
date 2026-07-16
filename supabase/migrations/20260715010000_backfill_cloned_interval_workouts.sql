-- Repara los clones hechos ANTES de 20260715000000_clone_program_fn_intervals:
-- clone_program no copiaba workouts.format ni las columnas de intervalos de
-- workout_exercises, así que cualquier rutina de intervalos ya asignada a un
-- cliente (o duplicada) quedó como una rutina de gimnasio rota (con "Ejercicio"
-- fantasma donde debía haber un descanso). Repara todos los programas clonados
-- (source_program_id no nulo) emparejando cada rutina clonada con la original
-- por day_number, y cada ejercicio clonado con el original por sort_order.
-- Idempotente: sólo actualiza filas cuyo valor difiere del original.

update public.workouts w
set format = src.format
from public.training_days td_clone
join public.training_phases tp_clone on tp_clone.id = td_clone.phase_id
join public.programs p_clone on p_clone.program_key = tp_clone.program_key
join public.programs p_src on p_src.id = p_clone.source_program_id
join public.training_phases tp_src on tp_src.program_key = p_src.program_key
join public.training_days td_src on td_src.phase_id = tp_src.id and td_src.day_number = td_clone.day_number
join public.workouts src on src.id = td_src.workout_id
where td_clone.workout_id = w.id
  and w.format <> src.format;

update public.workout_exercises we
set kind = src.kind,
    duration_seconds = src.duration_seconds,
    circuit_group = src.circuit_group,
    circuit_rounds = src.circuit_rounds,
    superset_group = src.superset_group,
    sets_detail = src.sets_detail,
    notes = src.notes
from public.training_days td_clone
join public.training_phases tp_clone on tp_clone.id = td_clone.phase_id
join public.programs p_clone on p_clone.program_key = tp_clone.program_key
join public.programs p_src on p_src.id = p_clone.source_program_id
join public.training_phases tp_src on tp_src.program_key = p_src.program_key
join public.training_days td_src on td_src.phase_id = tp_src.id and td_src.day_number = td_clone.day_number
join public.workout_exercises src on src.workout_id = td_src.workout_id
where we.workout_id = td_clone.workout_id
  and we.sort_order = src.sort_order
  and (we.kind, we.duration_seconds, we.circuit_group, we.circuit_rounds) is distinct from
      (src.kind, src.duration_seconds, src.circuit_group, src.circuit_rounds);
