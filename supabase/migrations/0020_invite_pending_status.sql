-- ════════════════════════════════════════════════════════════════
-- 0020 — Clientes por invitación quedan en estado "pending"
-- Idempotente. Ejecutar en orden numérico.
-- ════════════════════════════════════════════════════════════════

-- Registro nuevo con código en metadata (email signup)
create or replace function public.handle_new_user()
returns trigger as $$
declare v_trainer uuid;
begin
  select b.trainer_id into v_trainer
  from public.trainer_branding b
  where upper(trim(b.invite_code)) = upper(trim(new.raw_user_meta_data->>'trainer_code'));

  insert into public.profiles (id, full_name, avatar_url, trainer_id, client_status)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture'),
    v_trainer,
    case when v_trainer is not null then 'pending' else 'active' end
  )
  on conflict (id) do nothing;

  insert into public.user_profiles (user_id, full_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    )
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = '';

-- Vinculación post-OAuth (Google) o refuerzo post-registro web
create or replace function public.link_client_by_invite_code(p_invite_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trainer uuid;
  v_uid uuid := auth.uid();
  v_meta jsonb;
  v_avatar text;
  v_name text;
  v_email text;
  v_was_linked boolean;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select b.trainer_id into v_trainer
  from public.trainer_branding b
  where upper(trim(b.invite_code)) = upper(trim(p_invite_code));

  if v_trainer is null then
    raise exception 'invalid_invite_code';
  end if;

  if exists (
    select 1 from public.profiles p
    where p.id = v_uid and p.role in ('trainer', 'admin')
  ) then
    raise exception 'trainer_cannot_be_client';
  end if;

  select u.raw_user_meta_data, u.email
  into v_meta, v_email
  from auth.users u
  where u.id = v_uid;

  v_avatar := coalesce(v_meta->>'avatar_url', v_meta->>'picture');
  v_name := coalesce(v_meta->>'full_name', v_meta->>'name');

  select (trainer_id is not null) into v_was_linked
  from public.profiles where id = v_uid;

  update public.profiles
  set
    trainer_id = v_trainer,
    role = 'client',
    client_status = case
      when client_status = 'active' then 'active'
      else 'pending'
    end,
    avatar_url = coalesce(nullif(trim(avatar_url), ''), v_avatar),
    full_name = coalesce(nullif(trim(full_name), ''), v_name)
  where id = v_uid
    and (trainer_id is null or trainer_id = v_trainer);

  update public.user_profiles
  set full_name = coalesce(
    nullif(trim(full_name), ''),
    v_name,
    split_part(v_email, '@', 1)
  )
  where user_id = v_uid;

  return jsonb_build_object(
    'trainer_id', v_trainer,
    'linked', true,
    'was_already_linked', coalesce(v_was_linked, false)
  );
end;
$$;
