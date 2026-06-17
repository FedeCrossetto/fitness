-- Al vincular por código, siempre quedar pending salvo que ya estuviera activo con el mismo entrenador.

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
  v_prev_trainer uuid;
  v_prev_status text;
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

  select trainer_id, client_status
  into v_prev_trainer, v_prev_status
  from public.profiles where id = v_uid;

  v_was_linked := v_prev_trainer is not null;

  update public.profiles
  set
    trainer_id = v_trainer,
    role = 'client',
    client_status = case
      when v_prev_trainer = v_trainer and v_prev_status = 'active' then 'active'
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
