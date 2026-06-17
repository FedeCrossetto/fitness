-- ════════════════════════════════════════════════════════════════
-- 0019 — Invitación por link: preview público + vinculación segura
-- Idempotente. Ejecutar en orden numérico.
-- ════════════════════════════════════════════════════════════════

-- Avatar de Google OAuth (picture) además de avatar_url
create or replace function public.handle_new_user()
returns trigger as $$
declare v_trainer uuid;
begin
  select b.trainer_id into v_trainer
  from public.trainer_branding b
  where b.invite_code = new.raw_user_meta_data->>'trainer_code';

  insert into public.profiles (id, full_name, avatar_url, trainer_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture'),
    v_trainer
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

-- Preview del entrenador para la página /unirse (sin auth)
create or replace function public.get_invite_preview(p_invite_code text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'app_name', b.app_name,
    'logo_url', b.logo_url,
    'trainer_name', p.full_name,
    'invite_code', b.invite_code
  )
  from public.trainer_branding b
  join public.profiles p on p.id = b.trainer_id
  where upper(trim(b.invite_code)) = upper(trim(p_invite_code));
$$;

grant execute on function public.get_invite_preview(text) to anon, authenticated;

-- Vincular cliente autenticado a entrenador por código (OAuth / post-registro web)
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

  update public.profiles
  set
    trainer_id = v_trainer,
    role = 'client',
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

  return jsonb_build_object('trainer_id', v_trainer, 'linked', true);
end;
$$;

grant execute on function public.link_client_by_invite_code(text) to authenticated;
