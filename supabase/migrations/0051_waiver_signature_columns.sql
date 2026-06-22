-- ════════════════════════════════════════════════════════════════
-- 0051 — Columnas faltantes en waiver_signatures (DB creada antes de 0017 final)
-- ════════════════════════════════════════════════════════════════

alter table public.waiver_signatures
  add column if not exists document_snapshot text not null default '',
  add column if not exists document_title text not null default '';

-- Limpiar política duplicada de 0017 si 0050 ya corrió
drop policy if exists "clients_own_signature" on public.waiver_signatures;

-- Recrear RPC con search_path explícito + reload de schema cache
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
set search_path = public
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

  if v_profile_trainer_id is null then
    raise exception 'no_trainer_linked';
  end if;

  -- Usar siempre el trainer del perfil (más seguro que confiar en el cliente)
  if p_trainer_id is distinct from v_profile_trainer_id then
    raise exception 'invalid_trainer';
  end if;

  select id into v_config_id
  from public.waiver_configs
  where trainer_id = v_profile_trainer_id;

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
    v_profile_trainer_id,
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

notify pgrst, 'reload schema';
