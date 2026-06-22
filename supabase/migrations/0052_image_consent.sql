-- ════════════════════════════════════════════════════════════════
-- 0052 — Consentimiento de uso de imágenes (config + aceptaciones)
-- ════════════════════════════════════════════════════════════════

alter table public.waiver_configs
  add column if not exists image_consent_enabled boolean not null default true,
  add column if not exists image_consent_title text not null default 'Consentimiento de uso de imágenes',
  add column if not exists image_consent_body text not null default '';

-- Texto por defecto para coaches que ya tienen waiver_configs
update public.waiver_configs
set image_consent_body = $consent$
CONSENTIMIENTO PARA EL USO DE IMÁGENES

Autorizo expresamente a mi entrenador personal y a su equipo a capturar, almacenar y utilizar fotografías y/o videos de mi persona tomados durante las sesiones de entrenamiento, evaluaciones físicas o actividades relacionadas con el servicio contratado.

FINALIDAD DEL USO
Las imágenes podrán utilizarse exclusivamente con los siguientes fines:
• Seguimiento de mi progreso físico y evaluación de resultados.
• Material de referencia interna para la planificación de mi entrenamiento.
• Publicación en redes sociales, sitio web u otros medios de comunicación del entrenador, únicamente con fines promocionales o de testimonio (previo aviso cuando corresponda).

DURACIÓN Y REVOCACIÓN
Este consentimiento permanece vigente mientras mantenga una relación activa con el entrenador. Puedo revocarlo en cualquier momento contactando directamente a mi entrenador, sin que ello afecte la prestación del servicio de entrenamiento.

Al aceptar, declaro haber leído y comprendido el presente consentimiento y otorgo mi autorización de forma libre e informada.
$consent$
where coalesce(trim(image_consent_body), '') = '';

create table if not exists public.image_consent_acceptances (
  id                uuid        primary key default gen_random_uuid(),
  client_id         uuid        not null references public.profiles(id) on delete cascade,
  trainer_id        uuid        not null references public.profiles(id) on delete cascade,
  full_name         text        not null default '',
  document_snapshot text        not null default '',
  document_title    text        not null default '',
  accepted_at       timestamptz not null default now(),
  unique (client_id, trainer_id)
);

create index if not exists idx_image_consent_client  on public.image_consent_acceptances(client_id);
create index if not exists idx_image_consent_trainer on public.image_consent_acceptances(trainer_id);

alter table public.image_consent_acceptances enable row level security;

drop policy if exists "clients_select_image_consent" on public.image_consent_acceptances;
drop policy if exists "clients_insert_image_consent" on public.image_consent_acceptances;
drop policy if exists "clients_update_image_consent" on public.image_consent_acceptances;
drop policy if exists "trainers_read_image_consent" on public.image_consent_acceptances;

create policy "clients_select_image_consent" on public.image_consent_acceptances
  for select to authenticated
  using (client_id = auth.uid());

create policy "clients_insert_image_consent" on public.image_consent_acceptances
  for insert to authenticated
  with check (
    client_id = auth.uid()
    and trainer_id = (select trainer_id from public.profiles where id = auth.uid())
  );

create policy "clients_update_image_consent" on public.image_consent_acceptances
  for update to authenticated
  using (client_id = auth.uid())
  with check (
    client_id = auth.uid()
    and trainer_id = (select trainer_id from public.profiles where id = auth.uid())
  );

create policy "trainers_read_image_consent" on public.image_consent_acceptances
  for select to authenticated
  using (trainer_id = auth.uid());

-- Gate: ¿debe aceptar consentimiento de imágenes?
create or replace function public.get_client_image_consent_gate()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_trainer_id uuid;
  v_role text;
  v_cfg public.waiver_configs%rowtype;
  v_has_acceptance boolean;
begin
  if v_uid is null then
    return json_build_object('required', false);
  end if;

  select trainer_id, role
  into v_trainer_id, v_role
  from public.profiles
  where id = v_uid;

  if v_role in ('trainer', 'admin') or v_trainer_id is null then
    return json_build_object('required', false);
  end if;

  select * into v_cfg
  from public.waiver_configs
  where trainer_id = v_trainer_id;

  if not found
     or not v_cfg.image_consent_enabled
     or coalesce(trim(v_cfg.image_consent_body), '') = '' then
    return json_build_object('required', false);
  end if;

  select exists (
    select 1
    from public.image_consent_acceptances ica
    where ica.client_id = v_uid
      and ica.trainer_id = v_trainer_id
  ) into v_has_acceptance;

  if v_has_acceptance then
    return json_build_object('required', false);
  end if;

  return json_build_object(
    'required', true,
    'title', v_cfg.image_consent_title,
    'body', v_cfg.image_consent_body
  );
end;
$$;

grant execute on function public.get_client_image_consent_gate() to authenticated;

-- Guardar aceptación
create or replace function public.save_client_image_consent(
  p_trainer_id uuid,
  p_full_name text,
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
  v_accept_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if coalesce(trim(p_full_name), '') = '' then
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
    accepted_at
  )
  values (
    v_uid,
    v_profile_trainer_id,
    trim(p_full_name),
    coalesce(p_document_snapshot, ''),
    coalesce(nullif(trim(p_document_title), ''), 'Consentimiento de uso de imágenes'),
    now()
  )
  on conflict (client_id, trainer_id) do update set
    full_name = excluded.full_name,
    document_snapshot = excluded.document_snapshot,
    document_title = excluded.document_title,
    accepted_at = excluded.accepted_at
  returning id into v_accept_id;

  return v_accept_id;
end;
$$;

grant execute on function public.save_client_image_consent(uuid, text, text, text) to authenticated;

notify pgrst, 'reload schema';
