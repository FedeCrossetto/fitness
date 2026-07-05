-- ════════════════════════════════════════════════════════════════
-- Supabase pide plan Pro para Custom SMTP en este proyecto, así que el reset
-- de contraseña y el código de verificación de mail se mandan por FUERA del
-- sistema de Auth de Supabase — vía Resend, desde nuestras propias Edge
-- Functions, con nuestra propia tabla de tokens/códigos. Supabase Auth sigue
-- siendo la fuente de verdad de la sesión y la contraseña en sí (se actualiza
-- vía Admin API con el service role), pero el ENVÍO del mail y la
-- verificación del código/token son 100% nuestros.
-- ════════════════════════════════════════════════════════════════

create table if not exists public.password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  token_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists password_reset_tokens_email_idx on public.password_reset_tokens(email);
create index if not exists password_reset_tokens_token_hash_idx on public.password_reset_tokens(token_hash);

-- Sin RLS abierto: solo las Edge Functions (service role) tocan esta tabla.
alter table public.password_reset_tokens enable row level security;

create table if not exists public.email_verification_codes (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  code_hash text not null,
  attempts int not null default 0,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists email_verification_codes_email_idx on public.email_verification_codes(email);

alter table public.email_verification_codes enable row level security;
