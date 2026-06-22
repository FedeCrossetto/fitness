-- ════════════════════════════════════════════════════════════════
-- 0050 — Guardar firma de deslinde vía RPC (evita fallos de RLS/upsert)
-- ════════════════════════════════════════════════════════════════

-- Políticas explícitas (upsert requiere INSERT + UPDATE + SELECT propios)
drop policy if exists "clients_own_signature" on public.waiver_signatures;
drop policy if exists "clients_insert_signature" on public.waiver_signatures;
drop policy if exists "clients_update_signature" on public.waiver_signatures;
drop policy if exists "clients_select_signature" on public.waiver_signatures;

create policy "clients_select_signature" on public.waiver_signatures
  for select to authenticated
  using (client_id = auth.uid());

create policy "clients_insert_signature" on public.waiver_signatures
  for insert to authenticated
  with check (
    client_id = auth.uid()
    and trainer_id = (select trainer_id from public.profiles where id = auth.uid())
  );

create policy "clients_update_signature" on public.waiver_signatures
  for update to authenticated
  using (client_id = auth.uid())
  with check (
    client_id = auth.uid()
    and trainer_id = (select trainer_id from public.profiles where id = auth.uid())
  );

create or replace function public.save_client_waiver_signature(
  p_trainer_id uuid,
  p_full_name text,
  p_signature_data text,
  p_document_snapshot text,
  p_document_title text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_profile_trainer_id uuid;
  v_config_id uuid;
  v_sig_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if coalesce(trim(p_full_name), '') = '' or coalesce(trim(p_signature_data), '') = '' then
    raise exception 'invalid_payload';
  end if;

  select trainer_id into v_profile_trainer_id
  from public.profiles
  where id = v_uid;

  if v_profile_trainer_id is null or v_profile_trainer_id <> p_trainer_id then
    raise exception 'invalid_trainer';
  end if;

  select id into v_config_id
  from public.waiver_configs
  where trainer_id = p_trainer_id;

  insert into public.waiver_signatures (
    client_id,
    trainer_id,
    waiver_config_id,
    signature_data,
    full_name,
    document_snapshot,
    document_title,
    signed_at
  )
  values (
    v_uid,
    p_trainer_id,
    v_config_id,
    p_signature_data,
    trim(p_full_name),
    coalesce(p_document_snapshot, ''),
    coalesce(nullif(trim(p_document_title), ''), 'Deslinde de Responsabilidad'),
    now()
  )
  on conflict (client_id, trainer_id) do update set
    waiver_config_id = excluded.waiver_config_id,
    signature_data = excluded.signature_data,
    full_name = excluded.full_name,
    document_snapshot = excluded.document_snapshot,
    document_title = excluded.document_title,
    signed_at = excluded.signed_at
  returning id into v_sig_id;

  return v_sig_id;
end;
$$;

grant execute on function public.save_client_waiver_signature(uuid, text, text, text, text) to authenticated;
