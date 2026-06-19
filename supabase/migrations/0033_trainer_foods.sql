-- Catálogo de alimentos del entrenador + cola de aprobación de alumnos.

create table if not exists public.trainer_foods (
  id                    uuid primary key default gen_random_uuid(),
  trainer_id            uuid not null references auth.users(id) on delete cascade,
  name                  text not null,
  brand                 text,
  barcode               text,
  kcal_100g             numeric(12,2),
  protein_g_100g        numeric(12,3),
  carbs_g_100g          numeric(12,3),
  fat_g_100g            numeric(12,3),
  default_serving_grams numeric(12,3) default 100,
  icon_key              text,
  openfoodfacts_code    text,
  active                boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists idx_trainer_foods_trainer on public.trainer_foods(trainer_id);
create index if not exists idx_trainer_foods_trainer_name on public.trainer_foods(trainer_id, lower(name));

create table if not exists public.food_submissions (
  id                    uuid primary key default gen_random_uuid(),
  trainer_id            uuid not null references auth.users(id) on delete cascade,
  submitted_by          uuid not null references auth.users(id) on delete cascade,
  personal_food_id      uuid references public.foods(id) on delete set null,
  trainer_food_id       uuid references public.trainer_foods(id) on delete set null,
  status                text not null default 'pending'
                          check (status in ('pending','approved','rejected')),
  name                  text not null,
  brand                 text,
  barcode               text,
  kcal_100g             numeric(12,2),
  protein_g_100g        numeric(12,3),
  carbs_g_100g          numeric(12,3),
  fat_g_100g            numeric(12,3),
  default_serving_grams numeric(12,3),
  icon_key              text,
  rejection_note        text,
  reviewed_by           uuid references auth.users(id),
  reviewed_at           timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists idx_food_submissions_trainer_status
  on public.food_submissions(trainer_id, status);
create index if not exists idx_food_submissions_submitted_by
  on public.food_submissions(submitted_by);

alter table public.foods
  add column if not exists trainer_food_id uuid references public.trainer_foods(id) on delete set null;

alter table public.meal_logs
  add column if not exists trainer_food_id uuid references public.trainer_foods(id) on delete set null;

drop trigger if exists on_trainer_foods_updated on public.trainer_foods;
create trigger on_trainer_foods_updated before update on public.trainer_foods
  for each row execute function public.handle_updated_at();

drop trigger if exists on_food_submissions_updated on public.food_submissions;
create trigger on_food_submissions_updated before update on public.food_submissions
  for each row execute function public.handle_updated_at();

alter table public.trainer_foods enable row level security;
alter table public.food_submissions enable row level security;

drop policy if exists "trainer_foods: trainer manages own" on public.trainer_foods;
create policy "trainer_foods: trainer manages own" on public.trainer_foods for all
  using (trainer_id = auth.uid()) with check (trainer_id = auth.uid());

drop policy if exists "trainer_foods: client reads catalog" on public.trainer_foods;
create policy "trainer_foods: client reads catalog" on public.trainer_foods for select
  using (trainer_id = private.my_trainer_id() and active = true);

drop policy if exists "trainer_foods: admin all" on public.trainer_foods;
create policy "trainer_foods: admin all" on public.trainer_foods for all
  using (private.is_admin());

drop policy if exists "food_submissions: user insert own" on public.food_submissions;
create policy "food_submissions: user insert own" on public.food_submissions for insert
  with check (
    submitted_by = auth.uid()
    and trainer_id = private.my_trainer_id()
    and private.my_trainer_id() is not null
  );

drop policy if exists "food_submissions: user read own" on public.food_submissions;
create policy "food_submissions: user read own" on public.food_submissions for select
  using (submitted_by = auth.uid());

drop policy if exists "food_submissions: trainer read" on public.food_submissions;
create policy "food_submissions: trainer read" on public.food_submissions for select
  using (trainer_id = auth.uid());

drop policy if exists "food_submissions: trainer update" on public.food_submissions;
create policy "food_submissions: trainer update" on public.food_submissions for update
  using (trainer_id = auth.uid()) with check (trainer_id = auth.uid());

drop policy if exists "food_submissions: admin all" on public.food_submissions;
create policy "food_submissions: admin all" on public.food_submissions for all
  using (private.is_admin());
