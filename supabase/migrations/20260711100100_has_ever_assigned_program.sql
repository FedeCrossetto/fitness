-- Distingue, para el mobile del cliente:
--   a) nunca tuvo ningún programa asignado (cliente nuevo) → sigue mostrando
--      el programa demo/branding.default_program_key, como antes.
--   b) tiene programas asignados pero ninguno activo hoy → no mostrar nada
--      (decisión explícita: "no tiene plan asignado para esas fechas").
-- get_my_active_program_key() ya resuelve (a) y (b) igual (null); esta RPC
-- adicional deja que el cliente los distinga.
create or replace function public.has_ever_assigned_program(p_client_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from public.programs where client_id = p_client_id);
$$;

create or replace function public.i_have_ever_had_a_program()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_ever_assigned_program(auth.uid());
$$;

grant execute on function public.i_have_ever_had_a_program() to authenticated;
