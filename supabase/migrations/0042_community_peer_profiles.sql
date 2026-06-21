-- ════════════════════════════════════════════════════════════════
-- 0042 — Perfiles visibles entre miembros del mismo grupo
-- En chat grupal el alumno necesita ver nombre/avatar de otros miembros.
-- ════════════════════════════════════════════════════════════════

create or replace function private.shares_community_with(p_other uuid)
returns boolean as $$
  select exists (
    select 1
    from public.community_members me
    join public.community_members them
      on them.community_id = me.community_id
     and them.user_id = p_other
    where me.user_id = auth.uid()
  );
$$ language sql security definer stable set search_path = '';

grant execute on function private.shares_community_with(uuid) to authenticated;

drop policy if exists "profiles: community peer read" on public.profiles;
create policy "profiles: community peer read" on public.profiles
  for select to authenticated
  using (private.shares_community_with(id));
