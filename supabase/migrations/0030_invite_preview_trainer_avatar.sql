-- Incluye avatar del entrenador en el preview de invitación (registro mobile/web).
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
    'trainer_avatar_url', p.avatar_url,
    'invite_code', b.invite_code
  )
  from public.trainer_branding b
  join public.profiles p on p.id = b.trainer_id
  where upper(trim(b.invite_code)) = upper(trim(p_invite_code));
$$;
