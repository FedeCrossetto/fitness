-- ════════════════════════════════════════════════════════════════
-- Interacción social sobre los entrenamientos registrados (workout_logs):
-- likes y comentarios, estilo feed de Hevy Coach. Tanto el cliente (dueño
-- del log) como su entrenador pueden ver y crear likes/comentarios; cada uno
-- solo puede borrar los propios.
-- ════════════════════════════════════════════════════════════════

-- ¿El que llama puede VER este workout_log? (es su dueño, o es su entrenador)
create or replace function private.can_see_workout_log(p_log uuid)
returns boolean as $$
  select exists (
    select 1 from public.workout_logs wl
    where wl.id = p_log
      and (wl.user_id = auth.uid() or private.is_my_client(wl.user_id))
  );
$$ language sql security definer stable set search_path = '';
grant execute on function private.can_see_workout_log(uuid) to authenticated;

-- ── Likes ────────────────────────────────────────────────────────
create table if not exists public.workout_likes (
  id             uuid primary key default gen_random_uuid(),
  workout_log_id uuid not null references public.workout_logs(id) on delete cascade,
  author_id      uuid not null references auth.users(id) on delete cascade,
  created_at     timestamptz not null default now(),
  unique (workout_log_id, author_id)
);
create index if not exists idx_workout_likes_log on public.workout_likes(workout_log_id);

alter table public.workout_likes enable row level security;

drop policy if exists "workout_likes: see" on public.workout_likes;
create policy "workout_likes: see" on public.workout_likes
  for select using (private.can_see_workout_log(workout_log_id));

drop policy if exists "workout_likes: insert own" on public.workout_likes;
create policy "workout_likes: insert own" on public.workout_likes
  for insert with check (author_id = auth.uid() and private.can_see_workout_log(workout_log_id));

drop policy if exists "workout_likes: delete own" on public.workout_likes;
create policy "workout_likes: delete own" on public.workout_likes
  for delete using (author_id = auth.uid());

-- ── Comentarios ──────────────────────────────────────────────────
create table if not exists public.workout_comments (
  id             uuid primary key default gen_random_uuid(),
  workout_log_id uuid not null references public.workout_logs(id) on delete cascade,
  author_id      uuid not null references auth.users(id) on delete cascade,
  body           text not null check (char_length(body) between 1 and 2000),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_workout_comments_log on public.workout_comments(workout_log_id, created_at);

alter table public.workout_comments enable row level security;

drop policy if exists "workout_comments: see" on public.workout_comments;
create policy "workout_comments: see" on public.workout_comments
  for select using (private.can_see_workout_log(workout_log_id));

drop policy if exists "workout_comments: insert own" on public.workout_comments;
create policy "workout_comments: insert own" on public.workout_comments
  for insert with check (author_id = auth.uid() and private.can_see_workout_log(workout_log_id));

drop policy if exists "workout_comments: update own" on public.workout_comments;
create policy "workout_comments: update own" on public.workout_comments
  for update using (author_id = auth.uid());

drop policy if exists "workout_comments: delete own" on public.workout_comments;
create policy "workout_comments: delete own" on public.workout_comments
  for delete using (author_id = auth.uid());
