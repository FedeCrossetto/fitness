-- ════════════════════════════════════════════════════════════════
-- Aceptación de Términos y Condiciones — modelo implícito (sin checkbox):
-- crear la cuenta ES la aceptación, así que se registra en el momento en que
-- se crea la fila de `profiles` (mismo trigger que ya corre para email/password
-- y OAuth). Se guarda también la versión del documento aceptado, para poder
-- re-solicitar aceptación si el texto legal cambia materialmente más adelante.
-- ════════════════════════════════════════════════════════════════

alter table public.profiles
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists terms_version      text;

create or replace function public.handle_new_user()
returns trigger as $$
declare v_trainer uuid;
begin
  select b.trainer_id into v_trainer
  from public.trainer_branding b
  where upper(trim(b.invite_code)) = upper(trim(new.raw_user_meta_data->>'trainer_code'));

  insert into public.profiles (id, full_name, avatar_url, trainer_id, client_status, terms_accepted_at, terms_version)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture'),
    v_trainer,
    case when v_trainer is not null then 'pending' else 'active' end,
    now(),
    '2026-07-07'
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

notify pgrst, 'reload schema';
