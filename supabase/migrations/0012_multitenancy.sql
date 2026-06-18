-- ════════════════════════════════════════════════════════════════
-- 0012 — Multi-tenancy: cada entrenador ("trainer") es dueño de sus
-- alumnos, su branding y sus rutinas. Modelo runtime, un solo app.
-- Idempotente. Ejecutar en orden numérico.
--
-- Modelo:
--   profiles.role        : 'client' | 'trainer' | 'admin'
--   profiles.trainer_id  : el entrenador dueño de este cliente
--   trainer_branding     : marca + módulos + invite_code por entrenador
--   un cliente se linkea a su entrenador en el signup vía invite_code
-- ════════════════════════════════════════════════════════════════

-- ── 1. profiles: rol 'trainer' + columna trainer_id ──
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('client','trainer','admin'));

alter table public.profiles
  add column if not exists trainer_id uuid references auth.users(id) on delete set null;
create index if not exists idx_profiles_trainer on public.profiles(trainer_id);

-- ── 2. Helpers de tenencia (security definer, fuera del schema expuesto) ──

-- El entrenador del usuario que llama. Si el llamante ES entrenador, devuelve su propio id.
create or replace function private.my_trainer_id()
returns uuid as $$
  select case
    when p.role = 'trainer' then p.id
    else p.trainer_id
  end
  from public.profiles p
  where p.id = auth.uid();
$$ language sql security definer stable set search_path = '';
grant execute on function private.my_trainer_id() to authenticated;

-- ¿El usuario que llama es entrenador del cliente p_client?
create or replace function private.is_my_client(p_client uuid)
returns boolean as $$
  select exists (
    select 1
    from public.profiles caller, public.profiles client
    where caller.id = auth.uid()
      and caller.role = 'trainer'
      and client.id = p_client
      and client.trainer_id = caller.id
  );
$$ language sql security definer stable set search_path = '';
grant execute on function private.is_my_client(uuid) to authenticated;

-- ── 3. trainer_branding: espeja ClientConfig + invite_code ──
create table if not exists public.trainer_branding (
  trainer_id        uuid primary key references auth.users(id) on delete cascade,
  app_name          text not null default 'Reset Fit',
  invite_code       text not null unique,
  -- Colores (overrides del tema; null = usar default del core)
  color_primary     text,
  color_accent      text,
  color_background  text,
  logo_url          text,
  splash_url        text,
  -- Overrides completos de tokens de tema (opcional, jsonb libre)
  theme             jsonb,
  -- Módulos activos (espeja ClientModules)
  modules           jsonb not null default jsonb_build_object(
    'training', true, 'nutrition', true, 'progress', true, 'goals', true,
    'community', true, 'subscriptions', true, 'coachChat', true,
    'achievements', true, 'healthKit', true
  ),
  -- Copy configurable
  welcome_title     text,
  welcome_subtitle  text,
  onboarding_cta    text,
  default_program_key text not null default 'default',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

drop trigger if exists on_trainer_branding_updated on public.trainer_branding;
create trigger on_trainer_branding_updated before update on public.trainer_branding
  for each row execute function public.handle_updated_at();

-- ── 4. Linkeo cliente→entrenador en el signup vía invite_code ──
-- Extiende handle_new_user: si el metadata trae 'trainer_code', resuelve el
-- trainer_id. Si no, queda null (cliente sin entrenador / self-serve).
create or replace function public.handle_new_user()
returns trigger as $$
declare v_trainer uuid;
begin
  select b.trainer_id into v_trainer
  from public.trainer_branding b
  where b.invite_code = new.raw_user_meta_data->>'trainer_code';

  insert into public.profiles (id, full_name, avatar_url, trainer_id)
  values (new.id, new.raw_user_meta_data->>'full_name',
          new.raw_user_meta_data->>'avatar_url', v_trainer)
  on conflict (id) do nothing;

  insert into public.user_profiles (user_id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)))
  on conflict (user_id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = '';

-- El entrenador lista los profiles de SUS alumnos (columna de la misma fila,
-- sin helper para evitar recursión).
drop policy if exists "profiles: trainer reads clients" on public.profiles;
create policy "profiles: trainer reads clients" on public.profiles for select
  using (trainer_id = auth.uid());

-- ── 5. RLS: trainer_branding ──
alter table public.trainer_branding enable row level security;

-- El cliente lee la marca de SU entrenador (para tematizar la app).
drop policy if exists "branding: client reads own trainer" on public.trainer_branding;
create policy "branding: client reads own trainer" on public.trainer_branding for select
  using (trainer_id = private.my_trainer_id());

-- El entrenador lee/gestiona su propia marca.
drop policy if exists "branding: trainer manages own" on public.trainer_branding;
create policy "branding: trainer manages own" on public.trainer_branding for all
  using (trainer_id = auth.uid()) with check (trainer_id = auth.uid());

-- Admin gestiona todas.
drop policy if exists "branding: admin all" on public.trainer_branding;
create policy "branding: admin all" on public.trainer_branding for all using (private.is_admin());

-- ── 6. RLS: entrenador ve/gestiona los datos de SUS alumnos ──
-- Tablas con columna dueño = user_id. El entrenador obtiene SELECT (lectura
-- de progreso/logs). No insertamos en nombre del cliente excepto donde el
-- producto lo requiere (rutinas/metas/mensajes, abajo).
do $$
declare t text;
begin
  foreach t in array array[
    'user_profiles','goal_assignments','daily_goals','foods','meal_logs',
    'hydration_logs','body_measurements','progress_photos',
    'workout_logs','subscriptions'
  ] loop
    execute format(
      'drop policy if exists "%s: trainer reads clients" on public.%I', t, t);
    execute format(
      'create policy "%s: trainer reads clients" on public.%I for select using (private.is_my_client(user_id))',
      t, t);
  end loop;
end $$;

-- goal_assignments: el entrenador asigna/gestiona metas de sus alumnos.
drop policy if exists "goal_assignments: trainer manages clients" on public.goal_assignments;
create policy "goal_assignments: trainer manages clients" on public.goal_assignments for all
  using (private.is_my_client(user_id)) with check (private.is_my_client(user_id));

-- ── 7. RLS: routines / routine_exercises / messages (dueño = client_id) ──

-- routines: el entrenador gestiona las de sus alumnos.
drop policy if exists "routines: trainer manages clients" on public.routines;
create policy "routines: trainer manages clients" on public.routines for all
  using (private.is_my_client(client_id)) with check (private.is_my_client(client_id));

-- routine_exercises: idem, vía la rutina padre.
drop policy if exists "routine_exercises: trainer manages clients" on public.routine_exercises;
create policy "routine_exercises: trainer manages clients" on public.routine_exercises for all
  using (exists (select 1 from public.routines r
                 where r.id = routine_id and private.is_my_client(r.client_id)))
  with check (exists (select 1 from public.routines r
                      where r.id = routine_id and private.is_my_client(r.client_id)));

-- messages: el entrenador lee los de sus alumnos e inserta como 'trainer'.
drop policy if exists "messages: trainer reads clients" on public.messages;
create policy "messages: trainer reads clients" on public.messages for select
  using (private.is_my_client(client_id));
drop policy if exists "messages: trainer inserts" on public.messages;
create policy "messages: trainer inserts" on public.messages for insert
  with check (private.is_my_client(client_id) and sender_role = 'trainer');
drop policy if exists "messages: trainer updates clients" on public.messages;
create policy "messages: trainer updates clients" on public.messages for update
  using (private.is_my_client(client_id));
