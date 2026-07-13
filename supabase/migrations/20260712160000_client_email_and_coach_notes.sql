-- ════════════════════════════════════════════════════════════════
-- 1) get_client_email: el entrenador puede ver el email (auth.users) de sus
--    clientes para el link mailto del perfil.
-- 2) client_coach_notes: notas privadas del coach por cliente (no visibles
--    para el alumno).
-- ════════════════════════════════════════════════════════════════

create or replace function public.get_client_email(p_client uuid)
returns text
language sql
security definer
stable
set search_path = public
as $$
  select case
    when private.is_my_client(p_client)
      then (select u.email from auth.users u where u.id = p_client)
    else null
  end;
$$;
grant execute on function public.get_client_email(uuid) to authenticated;

create table if not exists public.client_coach_notes (
  client_id  uuid primary key references auth.users(id) on delete cascade,
  trainer_id uuid not null references auth.users(id) on delete cascade,
  notes      text,
  updated_at timestamptz not null default now()
);

alter table public.client_coach_notes enable row level security;

drop policy if exists "client_coach_notes: trainer manages" on public.client_coach_notes;
create policy "client_coach_notes: trainer manages" on public.client_coach_notes
  for all
  using (private.is_my_client(client_id))
  with check (private.is_my_client(client_id));
