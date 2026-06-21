-- ════════════════════════════════════════════════════════════════
-- 0039 — Comunidades: grupos del coach, miembros y chat grupal
-- Idempotente. Ejecutar en orden numérico.
-- ════════════════════════════════════════════════════════════════

-- ── Tablas ──

create table if not exists public.communities (
  id          uuid primary key default gen_random_uuid(),
  trainer_id  uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  description text,
  avatar_url  text,
  is_active   boolean not null default true,
  trainer_last_read_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_communities_trainer on public.communities(trainer_id);

alter table public.communities
  add column if not exists trainer_last_read_at timestamptz;

create table if not exists public.community_members (
  id            uuid primary key default gen_random_uuid(),
  community_id  uuid not null references public.communities(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  role          text not null default 'member' check (role in ('member')),
  last_read_at  timestamptz,
  joined_at     timestamptz not null default now(),
  unique (community_id, user_id)
);

create index if not exists idx_community_members_user on public.community_members(user_id);
create index if not exists idx_community_members_community on public.community_members(community_id);

create table if not exists public.community_messages (
  id            uuid primary key default gen_random_uuid(),
  community_id  uuid not null references public.communities(id) on delete cascade,
  sender_id     uuid references auth.users(id) on delete set null,
  content       text not null,
  kind          text not null default 'user' check (kind in ('user', 'system', 'auto')),
  created_at    timestamptz not null default now()
);

create index if not exists idx_community_messages_community on public.community_messages(community_id, created_at desc);

-- ── updated_at ──

drop trigger if exists communities_updated_at on public.communities;
create trigger communities_updated_at
  before update on public.communities
  for each row execute function public.handle_updated_at();

-- ── Helpers RLS ──

create or replace function private.is_community_trainer(p_community uuid)
returns boolean as $$
  select exists (
    select 1
    from public.communities c
    where c.id = p_community
      and c.trainer_id = auth.uid()
  );
$$ language sql security definer stable set search_path = '';
grant execute on function private.is_community_trainer(uuid) to authenticated;

create or replace function private.is_community_member(p_community uuid)
returns boolean as $$
  select private.is_community_trainer(p_community)
      or exists (
        select 1
        from public.community_members cm
        where cm.community_id = p_community
          and cm.user_id = auth.uid()
      );
$$ language sql security definer stable set search_path = '';
grant execute on function private.is_community_member(uuid) to authenticated;

-- ── RLS ──

alter table public.communities enable row level security;
alter table public.community_members enable row level security;
alter table public.community_messages enable row level security;

-- communities
drop policy if exists "communities: trainer all" on public.communities;
create policy "communities: trainer all" on public.communities
  for all using (trainer_id = auth.uid())
  with check (trainer_id = auth.uid());

drop policy if exists "communities: member select" on public.communities;
create policy "communities: member select" on public.communities
  for select using (private.is_community_member(id));

-- community_members
drop policy if exists "community_members: trainer all" on public.community_members;
create policy "community_members: trainer all" on public.community_members
  for all using (private.is_community_trainer(community_id))
  with check (private.is_community_trainer(community_id));

drop policy if exists "community_members: member select" on public.community_members;
create policy "community_members: member select" on public.community_members
  for select using (private.is_community_member(community_id));

drop policy if exists "community_members: member update own read" on public.community_members;
create policy "community_members: member update own read" on public.community_members
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- community_messages
drop policy if exists "community_messages: member select" on public.community_messages;
create policy "community_messages: member select" on public.community_messages
  for select using (private.is_community_member(community_id));

drop policy if exists "community_messages: member insert" on public.community_messages;
drop policy if exists "community_messages: member insert user" on public.community_messages;
create policy "community_messages: member insert user" on public.community_messages
  for insert with check (
    private.is_community_member(community_id)
    and kind = 'user'
    and sender_id = auth.uid()
    and (
      private.is_community_trainer(community_id)
      or private.is_active_client()
    )
  );

drop policy if exists "community_messages: trainer insert system" on public.community_messages;
create policy "community_messages: trainer insert system" on public.community_messages
  for insert with check (
    private.is_community_trainer(community_id)
    and sender_id = auth.uid()
    and kind in ('system', 'auto')
  );

-- ── Realtime ──

do $$
begin
  alter publication supabase_realtime add table public.community_messages;
exception when duplicate_object then null;
end $$;

-- ── Mensajes automáticos 1:1 (motor básico) ──

create or replace function public.try_send_auto_message(
  p_client_id uuid,
  p_trigger_key text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trainer_id uuid;
  v_message text;
  v_enabled boolean;
begin
  select trainer_id into v_trainer_id
  from public.profiles
  where id = p_client_id;

  if v_trainer_id is null then
    return false;
  end if;

  select message, enabled into v_message, v_enabled
  from public.auto_message_configs
  where trainer_id = v_trainer_id
    and trigger_key = p_trigger_key;

  if not found or not v_enabled or coalesce(trim(v_message), '') = '' then
    return false;
  end if;

  insert into public.messages (client_id, content, sender_role, read)
  values (p_client_id, v_message, 'trainer', false);

  return true;
exception when others then
  return false;
end;
$$;

grant execute on function public.try_send_auto_message(uuid, text) to authenticated, service_role;

-- Primer entreno completado → mensaje automático (si el coach lo tiene activo)
create or replace function public.trigger_auto_message_first_workout()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  select count(*)::int into v_count
  from public.workout_logs
  where user_id = new.user_id;

  if v_count = 1 then
    perform public.try_send_auto_message(new.user_id, 'first_workout');
  end if;

  return new;
end;
$$;

drop trigger if exists on_first_workout_auto_message on public.workout_logs;
create trigger on_first_workout_auto_message
  after insert on public.workout_logs
  for each row
  execute function public.trigger_auto_message_first_workout();
