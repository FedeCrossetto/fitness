-- ════════════════════════════════════════════════════════════════
-- Multi-programa por cliente: un cliente puede tener varios `programs`
-- (client_id = X) agendados con distintos rangos de fecha, o uno sin agenda
-- ("ilimitado"). `profiles.assigned_program_key` deja de significar "el
-- último que asignaste" y pasa a significar "el programa activo hoy":
--   1) el programa agendado (start_date/duration_weeks) cuyo rango incluye
--      la fecha de hoy — si hubiera más de uno (no debería: se bloquea al
--      asignar si se superponen), gana el de start_date más reciente.
--   2) si ninguno matchea, el programa "ilimitado" (sin start_date) más
--      reciente de ese cliente.
--   3) si no hay nada de lo anterior, null (sin programa asignado).
--
-- Sin cron: el mobile del cliente resuelve esto EN VIVO vía la RPC
-- get_my_active_program_key() en cada carga, así el cambio de día (un
-- programa agendado que arranca) siempre es correcto sin que nadie edite
-- nada. Además, un trigger en `programs` mantiene profiles.assigned_program_key
-- al día para el panel del coach (web) apenas se crea/edita/borra una
-- asignación — sin depender de ningún proceso corriendo en background.
-- ════════════════════════════════════════════════════════════════

create or replace function public.resolve_active_program_key(p_client_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select program_key from public.programs
      where client_id = p_client_id
        and start_date is not null
        and duration_weeks is not null
        and current_date >= start_date
        and current_date < (start_date + (duration_weeks * 7))
      order by start_date desc
      limit 1
    ),
    (
      select program_key from public.programs
      where client_id = p_client_id
        and start_date is null
      order by created_at desc
      limit 1
    )
  );
$$;

-- RPC para el mobile del cliente: solo puede resolver SU PROPIO programa
-- activo (usa auth.uid(), no recibe un client_id arbitrario).
create or replace function public.get_my_active_program_key()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select public.resolve_active_program_key(auth.uid());
$$;

grant execute on function public.get_my_active_program_key() to authenticated;

-- Mantiene profiles.assigned_program_key al día para el panel del coach
-- (web) apenas cambia algo en `programs` — sin cron, disparado por escritura.
create or replace function public.trg_refresh_assigned_program()
returns trigger
language plpgsql
as $$
declare
  v_client_id uuid;
begin
  v_client_id := coalesce(new.client_id, old.client_id);
  if v_client_id is not null then
    update public.profiles
       set assigned_program_key = public.resolve_active_program_key(v_client_id)
     where id = v_client_id;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_programs_refresh_assigned on public.programs;
create trigger trg_programs_refresh_assigned
after insert or delete or update of client_id, start_date, duration_weeks
on public.programs
for each row
execute function public.trg_refresh_assigned_program();

-- Backfill inmediato con la lógica nueva (una sola vez, al aplicar esta migración).
update public.profiles p
   set assigned_program_key = public.resolve_active_program_key(p.id)
 where p.trainer_id is not null
   and p.assigned_program_key is distinct from public.resolve_active_program_key(p.id);
