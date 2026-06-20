-- ════════════════════════════════════════════════════════════════
-- 0038 — MercadoPago OAuth (marketplace) para cobro por entrenador
-- ════════════════════════════════════════════════════════════════
-- En lugar de pedirle el access token a mano al entrenador, usamos OAuth:
-- el entrenador toca "Conectar MercadoPago", autoriza nuestra app, y guardamos
-- su access_token + refresh_token (scoped, renovable). Más seguro y permite
-- comisión automática (marketplace_fee).

-- Campos OAuth en la cuenta del entrenador.
alter table public.trainer_mp_accounts
  add column if not exists refresh_token    text,
  add column if not exists public_key       text,
  add column if not exists token_expires_at timestamptz,
  add column if not exists scope            text;

-- Estados OAuth de un solo uso (anti-CSRF). El entrenador genera uno al tocar
-- "Conectar"; el callback lo valida y lo borra. Service-role only.
create table if not exists public.mp_oauth_states (
  state       text primary key,
  trainer_id  uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now()
);

alter table public.mp_oauth_states enable row level security;
-- Sin policies: solo el service_role (Edge Functions) accede.
