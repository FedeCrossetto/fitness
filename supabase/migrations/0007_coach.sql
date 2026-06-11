-- ════════════════════════════════════════════════════════════════
-- 0007 — Coach: rutinas asignadas + mensajería cliente-coach
-- ════════════════════════════════════════════════════════════════

create table if not exists public.routines (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references auth.users(id) on delete cascade,
  name          text not null,
  description   text,
  days_per_week int default 3,
  active        boolean default true,
  created_at    timestamptz not null default now()
);

create table if not exists public.routine_exercises (
  id          uuid primary key default gen_random_uuid(),
  routine_id  uuid not null references public.routines(id) on delete cascade,
  name        text not null,
  sets        int,
  reps        text,
  rest_secs   int,
  notes       text,
  order_index int default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.messages (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references auth.users(id) on delete cascade,
  content     text not null,
  sender_role text not null check (sender_role in ('client','trainer')),
  read        boolean default false,
  created_at  timestamptz not null default now()
);
create index if not exists idx_messages_client on public.messages(client_id, read);

-- RLS
alter table public.routines enable row level security;
alter table public.routine_exercises enable row level security;
alter table public.messages enable row level security;

-- routines: el cliente ve las suyas; admin gestiona todas
drop policy if exists "routines: select own" on public.routines;
create policy "routines: select own" on public.routines for select using (auth.uid() = client_id);
drop policy if exists "routines: admin all" on public.routines;
create policy "routines: admin all" on public.routines for all using (private.is_admin());

drop policy if exists "routine_exercises: select own" on public.routine_exercises;
create policy "routine_exercises: select own" on public.routine_exercises for select
  using (exists (select 1 from public.routines r where r.id = routine_id and r.client_id = auth.uid()));
drop policy if exists "routine_exercises: admin all" on public.routine_exercises;
create policy "routine_exercises: admin all" on public.routine_exercises for all using (private.is_admin());

-- messages: el cliente ve/inserta/actualiza (marcar leído) las suyas; admin todas
drop policy if exists "messages: select own" on public.messages;
create policy "messages: select own" on public.messages for select using (auth.uid() = client_id);
drop policy if exists "messages: insert own" on public.messages;
create policy "messages: insert own" on public.messages for insert
  with check (auth.uid() = client_id and sender_role = 'client');
drop policy if exists "messages: update own" on public.messages;
create policy "messages: update own" on public.messages for update using (auth.uid() = client_id);
drop policy if exists "messages: admin select all" on public.messages;
create policy "messages: admin select all" on public.messages for select using (private.is_admin());
drop policy if exists "messages: admin insert" on public.messages;
create policy "messages: admin insert" on public.messages for insert
  with check (private.is_admin() and sender_role = 'trainer');
drop policy if exists "messages: admin update all" on public.messages;
create policy "messages: admin update all" on public.messages for update using (private.is_admin());

-- Realtime para el chat
do $$
begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null;
end $$;
