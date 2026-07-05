-- ════════════════════════════════════════════════════════════════
-- EasyLoginScreen muestra una cuenta guardada localmente (SecureStore) SIN
-- sesión activa — si esa cuenta se borra desde la webapp, no hay JWT para
-- suscribirse a Realtime (el mecanismo que ya usa `subscribeProfileDeletion`
-- con sesión activa) ni forma de detectarlo hasta que el usuario intente
-- loguearse. Esta RPC pública mínima permite chequear "¿esta cuenta todavía
-- existe?" sin sesión, para que la app pueda limpiar el EasyLogin guardado
-- automáticamente (al abrir la pantalla o volver del background).
--
-- Solo devuelve un booleano — no expone ningún dato del perfil.
-- ════════════════════════════════════════════════════════════════

create or replace function public.account_exists(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from public.profiles where id = p_user_id);
$$;

grant execute on function public.account_exists(uuid) to anon, authenticated;
