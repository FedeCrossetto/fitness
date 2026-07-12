-- ════════════════════════════════════════════════════════════════
-- Al asignar un programa SIN FECHA (ilimitado) a un cliente que ya tiene
-- otro(s) programa(s) vigentes, esos programas se ARCHIVAN (no se borran)
-- para que pasen a "Programas anteriores" en vez de seguir compitiendo
-- por ser el "activo hoy". `resolve_active_program_key` ahora ignora los
-- archivados.
-- ════════════════════════════════════════════════════════════════

alter table public.programs add column if not exists archived_at timestamptz;

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
        and archived_at is null
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
        and archived_at is null
        and start_date is null
      order by created_at desc
      limit 1
    )
  );
$$;

drop trigger if exists trg_programs_refresh_assigned on public.programs;
create trigger trg_programs_refresh_assigned
after insert or delete or update of client_id, start_date, duration_weeks, archived_at
on public.programs
for each row
execute function public.trg_refresh_assigned_program();

update public.profiles p
   set assigned_program_key = public.resolve_active_program_key(p.id)
 where p.trainer_id is not null
   and p.assigned_program_key is distinct from public.resolve_active_program_key(p.id);
