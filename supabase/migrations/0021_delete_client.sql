-- Entrenador elimina sus clientes; admin elimina cualquier cliente.
-- Borra auth.users → cascade en profiles y datos relacionados.

create or replace function public.delete_client_account(p_client_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_role text;
  v_client_role text;
  v_deleted int;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if p_client_id = auth.uid() then
    raise exception 'cannot_delete_self';
  end if;

  select role into v_client_role
  from public.profiles
  where id = p_client_id;

  if v_client_role is null then
    raise exception 'client_not_found';
  end if;

  if v_client_role <> 'client' then
    raise exception 'cannot_delete_non_client';
  end if;

  select role into v_caller_role
  from public.profiles
  where id = auth.uid();

  if v_caller_role = 'admin' then
    null;
  elsif v_caller_role = 'trainer' then
    if not exists (
      select 1 from public.profiles
      where id = p_client_id and trainer_id = auth.uid()
    ) then
      raise exception 'forbidden';
    end if;
  else
    raise exception 'forbidden';
  end if;

  delete from auth.users where id = p_client_id;
  get diagnostics v_deleted = row_count;

  if v_deleted = 0 then
    raise exception 'client_not_found';
  end if;
end;
$$;

grant execute on function public.delete_client_account(uuid) to authenticated;
revoke execute on function public.delete_client_account(uuid) from anon;
