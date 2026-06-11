-- ════════════════════════════════════════════════════════════════
-- 0001 — Helpers compartidos + identidad (profiles / user_profiles)
-- Idempotente. Ejecutar en orden numérico.
-- ════════════════════════════════════════════════════════════════

-- Helper: updated_at automático
create or replace function public.handle_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

-- Schema privado (no expuesto por la Data API) para funciones security definer
create schema if not exists private;
grant usage on schema private to authenticated;

-- ── profiles ──
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  avatar_url  text,
  phone       text,
  goal        text,
  role        text default 'client' check (role in ('client','admin')),
  locale      text default 'es',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_profiles_role on public.profiles(role);

-- Helper de autorización admin (security definer, fuera del schema expuesto).
-- Definido después de public.profiles: una función `language sql` valida su
-- cuerpo al crearse, así que la tabla debe existir primero.
create or replace function private.is_admin()
returns boolean as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$ language sql security definer stable set search_path = '';
grant execute on function private.is_admin() to authenticated;

-- ── user_profiles (datos fitness) ──
create table if not exists public.user_profiles (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null unique references auth.users(id) on delete cascade,
  full_name           text,
  avatar_url          text,
  level               text not null default 'Principiante',
  plan_name           text,
  plan_duration_weeks int,
  plan_current_week   int not null default 1,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists idx_user_profiles_user_id on public.user_profiles(user_id);

-- Crear perfiles automáticamente al registrarse
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;
  insert into public.user_profiles (user_id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)))
  on conflict (user_id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = '';

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

-- Triggers updated_at
drop trigger if exists on_profiles_updated on public.profiles;
create trigger on_profiles_updated before update on public.profiles
  for each row execute function public.handle_updated_at();

drop trigger if exists on_user_profiles_updated on public.user_profiles;
create trigger on_user_profiles_updated before update on public.user_profiles
  for each row execute function public.handle_updated_at();

-- RLS
alter table public.profiles enable row level security;
alter table public.user_profiles enable row level security;

drop policy if exists "profiles: select own" on public.profiles;
create policy "profiles: select own" on public.profiles for select using (auth.uid() = id);
drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles for update using (auth.uid() = id);
drop policy if exists "profiles: admin select all" on public.profiles;
create policy "profiles: admin select all" on public.profiles for select using (private.is_admin());
drop policy if exists "profiles: admin update all" on public.profiles;
create policy "profiles: admin update all" on public.profiles for update using (private.is_admin());

drop policy if exists "user_profiles: select own" on public.user_profiles;
create policy "user_profiles: select own" on public.user_profiles for select using (auth.uid() = user_id);
drop policy if exists "user_profiles: update own" on public.user_profiles;
create policy "user_profiles: update own" on public.user_profiles for update using (auth.uid() = user_id);
drop policy if exists "user_profiles: admin select all" on public.user_profiles;
create policy "user_profiles: admin select all" on public.user_profiles for select using (private.is_admin());
drop policy if exists "user_profiles: admin update all" on public.user_profiles;
create policy "user_profiles: admin update all" on public.user_profiles for update using (private.is_admin());
