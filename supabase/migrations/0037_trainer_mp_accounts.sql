-- ════════════════════════════════════════════════════════════════
-- 0037 — Cuenta de MercadoPago por entrenador (cobro directo)
-- ════════════════════════════════════════════════════════════════
-- Cada entrenador conecta su propia cuenta de MercadoPago. La plata de sus
-- alumnos va directo a él. El access token es SENSIBLE (da acceso a cobrar en
-- su cuenta), así que esta tabla NO es legible por usuarios: solo el
-- service_role (las Edge Functions) la lee. El platform owner inserta el token
-- manualmente (Dashboard → SQL/Table editor) con lo que le pasa el entrenador.
--
-- ⚠️ Producción: idealmente guardar el token en Supabase Vault (pgsodium) en
-- vez de texto plano. Esta tabla service-role-only es el mínimo seguro.

create table if not exists public.trainer_mp_accounts (
  trainer_id    uuid primary key references public.profiles(id) on delete cascade,
  access_token  text not null,                 -- token de MP del entrenador (SENSIBLE)
  mp_user_id    text,                          -- collector/user id de MP (opcional)
  active        boolean not null default true,
  connected_at  timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- RLS activado SIN policies → ni authenticated ni anon pueden leer/escribir.
-- Solo el service_role (Edge Functions) accede. Nadie ve el token desde el cliente.
alter table public.trainer_mp_accounts enable row level security;

-- Para que el panel web pueda mostrar "MercadoPago conectado" sin exponer el token:
-- función que devuelve solo un booleano para el entrenador autenticado.
create or replace function public.trainer_mp_connected()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.trainer_mp_accounts
    where trainer_id = auth.uid() and active
  );
$$;

grant execute on function public.trainer_mp_connected() to authenticated;
