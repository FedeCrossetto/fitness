-- ════════════════════════════════════════════════════════════════
-- 0006 — Push tokens + Planes y Suscripciones (Mercado Pago)
-- ════════════════════════════════════════════════════════════════

create table if not exists public.push_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  expo_token text not null,
  device_id  text,
  platform   text,
  is_active  boolean default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, expo_token)
);

create table if not exists public.plans (
  id            text primary key,
  name          text not null,
  description   text,
  price_ars     numeric(10,2) not null,
  duration_days int not null,
  active        boolean default true,
  created_at    timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  plan_id          text not null references public.plans(id),
  status           text default 'pending' check (status in ('pending','active','expired','cancelled')),
  mp_payment_id    text,
  mp_preference_id text,
  mp_status        text,
  started_at       timestamptz,
  expires_at       timestamptz,
  locale           text default 'es',
  created_at       timestamptz not null default now()
);
create index if not exists idx_subscriptions_user on public.subscriptions(user_id);
create index if not exists idx_subscriptions_status on public.subscriptions(status);

-- Triggers updated_at
drop trigger if exists on_push_tokens_updated on public.push_tokens;
create trigger on_push_tokens_updated before update on public.push_tokens
  for each row execute function public.handle_updated_at();

-- RLS
alter table public.push_tokens enable row level security;
alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;

-- push_tokens: CRUD propio
drop policy if exists "push_tokens: select own" on public.push_tokens;
create policy "push_tokens: select own" on public.push_tokens for select using (auth.uid() = user_id);
drop policy if exists "push_tokens: insert own" on public.push_tokens;
create policy "push_tokens: insert own" on public.push_tokens for insert with check (auth.uid() = user_id);
drop policy if exists "push_tokens: update own" on public.push_tokens;
create policy "push_tokens: update own" on public.push_tokens for update using (auth.uid() = user_id);
drop policy if exists "push_tokens: delete own" on public.push_tokens;
create policy "push_tokens: delete own" on public.push_tokens for delete using (auth.uid() = user_id);

-- plans: catálogo (lectura authenticated, escritura admin)
drop policy if exists "plans: read" on public.plans;
create policy "plans: read" on public.plans for select to authenticated using (true);
drop policy if exists "plans: admin all" on public.plans;
create policy "plans: admin all" on public.plans for all using (private.is_admin());

-- subscriptions: select/insert/update propio + admin gestiona todas
-- (la activación real la hace el webhook con service_role, que bypassea RLS)
drop policy if exists "subscriptions: select own" on public.subscriptions;
create policy "subscriptions: select own" on public.subscriptions for select using (auth.uid() = user_id);
drop policy if exists "subscriptions: insert own" on public.subscriptions;
create policy "subscriptions: insert own" on public.subscriptions for insert with check (auth.uid() = user_id);
drop policy if exists "subscriptions: update own" on public.subscriptions;
create policy "subscriptions: update own" on public.subscriptions for update using (auth.uid() = user_id);
drop policy if exists "subscriptions: admin select all" on public.subscriptions;
create policy "subscriptions: admin select all" on public.subscriptions for select using (private.is_admin());
drop policy if exists "subscriptions: admin update all" on public.subscriptions;
create policy "subscriptions: admin update all" on public.subscriptions for update using (private.is_admin());
