-- ════════════════════════════════════════════════════════════════
-- El back_url de la API de Suscripciones (Preapproval) de MP rechaza con
-- invalid_field_content un query param que traiga un esquema custom (ej.
-- exp://…) codificado adentro. Guardamos el deep link real que la app
-- necesita para volver (distinto según Expo Go vs. build standalone) en la
-- fila de la suscripción, y el back_url solo lleva el id (uuid limpio) —
-- la página web /pago/:result lo resuelve vía get_subscription_return_url.
-- ════════════════════════════════════════════════════════════════

alter table public.subscriptions
  add column if not exists client_return_url text;

create or replace function public.get_subscription_return_url(p_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select client_return_url from public.subscriptions where id = p_id;
$$;

-- Página pública (sin sesión) — solo expone el deep link de retorno, nada sensible.
grant execute on function public.get_subscription_return_url(uuid) to anon, authenticated;
