-- ════════════════════════════════════════════════════════════════
-- 0059 — Consentimiento de imágenes: firma digital + respuesta persistida
--   - Agrega signature_data (mismo estándar que waiver_signatures) y status,
--     para que "Ahora no" quede guardado y no se vuelva a pedir en cada login.
--   - El gate ya no distingue estado: cualquier fila (accepted o declined)
--     alcanza para no volver a bloquear login.
-- ════════════════════════════════════════════════════════════════

alter table public.image_consent_acceptances
  add column if not exists signature_data text,
  add column if not exists status text not null default 'accepted';

alter table public.image_consent_acceptances
  drop constraint if exists image_consent_acceptances_status_check;
alter table public.image_consent_acceptances
  add constraint image_consent_acceptances_status_check check (status in ('accepted', 'declined'));

-- Recrear con signature_data + status (cambia el n° de parámetros: hay que dropear la versión vieja)
drop function if exists public.save_client_image_consent(uuid, text, text, text);

create or replace function public.save_client_image_consent(
  p_trainer_id uuid,
  p_full_name text,
  p_document_snapshot text,
  p_document_title text,
  p_signature_data text default null,
  p_status text default 'accepted'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_profile_trainer_id uuid;
  v_accept_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if p_status not in ('accepted', 'declined') then
    raise exception 'invalid_status';
  end if;

  if p_status = 'accepted' and coalesce(trim(p_full_name), '') = '' then
    raise exception 'invalid_payload';
  end if;

  select trainer_id into v_profile_trainer_id
  from public.profiles
  where id = v_uid;

  if v_profile_trainer_id is null then
    raise exception 'no_trainer_linked';
  end if;

  if p_trainer_id is distinct from v_profile_trainer_id then
    raise exception 'invalid_trainer';
  end if;

  insert into public.image_consent_acceptances (
    client_id,
    trainer_id,
    full_name,
    document_snapshot,
    document_title,
    signature_data,
    status,
    accepted_at
  )
  values (
    v_uid,
    v_profile_trainer_id,
    trim(coalesce(p_full_name, '')),
    coalesce(p_document_snapshot, ''),
    coalesce(nullif(trim(p_document_title), ''), 'Consentimiento de uso de imágenes'),
    p_signature_data,
    p_status,
    now()
  )
  on conflict (client_id, trainer_id) do update set
    full_name = excluded.full_name,
    document_snapshot = excluded.document_snapshot,
    document_title = excluded.document_title,
    signature_data = excluded.signature_data,
    status = excluded.status,
    accepted_at = excluded.accepted_at
  returning id into v_accept_id;

  return v_accept_id;
end;
$$;

grant execute on function public.save_client_image_consent(uuid, text, text, text, text, text) to authenticated;

-- Estado completo para la pantalla de Perfil (a diferencia del gate, no exige "required")
create or replace function public.get_client_image_consent_status()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_trainer_id uuid;
  v_cfg public.waiver_configs%rowtype;
  v_row public.image_consent_acceptances%rowtype;
  v_found boolean;
begin
  if v_uid is null then
    return json_build_object('enabled', false);
  end if;

  select trainer_id into v_trainer_id
  from public.profiles
  where id = v_uid;

  if v_trainer_id is null then
    return json_build_object('enabled', false);
  end if;

  select * into v_cfg
  from public.waiver_configs
  where trainer_id = v_trainer_id;

  if not found or not v_cfg.image_consent_enabled or coalesce(trim(v_cfg.image_consent_body), '') = '' then
    return json_build_object('enabled', false);
  end if;

  select * into v_row
  from public.image_consent_acceptances
  where client_id = v_uid and trainer_id = v_trainer_id;
  v_found := found;

  return json_build_object(
    'enabled', true,
    'title', v_cfg.image_consent_title,
    'body', v_cfg.image_consent_body,
    'status', case when v_found then v_row.status else null end,
    'full_name', case when v_found then v_row.full_name else null end,
    'responded_at', case when v_found then v_row.accepted_at else null end
  );
end;
$$;

grant execute on function public.get_client_image_consent_status() to authenticated;

notify pgrst, 'reload schema';
