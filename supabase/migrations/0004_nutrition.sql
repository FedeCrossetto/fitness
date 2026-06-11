-- ════════════════════════════════════════════════════════════════
-- 0004 — Nutrición: librería de alimentos + diario de comidas
-- ════════════════════════════════════════════════════════════════

create table if not exists public.foods (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  name                  text not null,
  brand                 text,
  barcode               text,
  kcal_100g             numeric(12,2),
  protein_g_100g        numeric(12,3),
  carbs_g_100g          numeric(12,3),
  fat_g_100g            numeric(12,3),
  default_serving_grams numeric(12,3),
  source                text not null check (source in ('manual','voice','barcode','openfoodfacts','import')),
  openfoodfacts_code    text,                            -- ODbL: atribuir "Open Food Facts" en la UI
  voice_transcript      text,
  is_favorite           boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create unique index if not exists foods_user_barcode_unique on public.foods(user_id, barcode) where barcode is not null;
create index if not exists idx_foods_user_name on public.foods(user_id, lower(name));

create table if not exists public.meal_logs (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users(id) on delete cascade,
  date                 date not null default current_date,
  meal_type            text not null check (meal_type in ('DES','ALM','MER','CEN')),
  title                text,
  photo_url            text,
  food_id              uuid references public.foods(id) on delete set null,
  openfoodfacts_code   text,
  product_display_name text,
  macro_source         text check (macro_source is null or macro_source in
                         ('openfoodfacts','manual','user_food','catalog','voice','barcode')),
  portion_grams        numeric(12,3),
  energy_kcal          numeric(12,2),
  protein_g            numeric(12,3),
  carbs_g              numeric(12,3),
  fat_g                numeric(12,3),
  is_included          boolean not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index if not exists idx_meal_logs_user_date on public.meal_logs(user_id, date desc);

create table if not exists public.food_images (
  id         uuid primary key default gen_random_uuid(),
  key        text unique not null,
  name       text,
  image_url  text not null,
  created_at timestamptz not null default now()
);

-- Triggers updated_at
drop trigger if exists on_foods_updated on public.foods;
create trigger on_foods_updated before update on public.foods
  for each row execute function public.handle_updated_at();
drop trigger if exists on_meal_logs_updated on public.meal_logs;
create trigger on_meal_logs_updated before update on public.meal_logs
  for each row execute function public.handle_updated_at();

-- RLS
alter table public.foods enable row level security;
alter table public.meal_logs enable row level security;
alter table public.food_images enable row level security;

do $$
declare t text;
begin
  foreach t in array array['foods','meal_logs'] loop
    execute format('drop policy if exists "%s: select own" on public.%I', t, t);
    execute format('create policy "%s: select own" on public.%I for select using (auth.uid() = user_id)', t, t);
    execute format('drop policy if exists "%s: insert own" on public.%I', t, t);
    execute format('create policy "%s: insert own" on public.%I for insert with check (auth.uid() = user_id)', t, t);
    execute format('drop policy if exists "%s: update own" on public.%I', t, t);
    execute format('create policy "%s: update own" on public.%I for update using (auth.uid() = user_id)', t, t);
    execute format('drop policy if exists "%s: delete own" on public.%I', t, t);
    execute format('create policy "%s: delete own" on public.%I for delete using (auth.uid() = user_id)', t, t);
  end loop;
end $$;

drop policy if exists "food_images: read" on public.food_images;
create policy "food_images: read" on public.food_images for select to authenticated using (true);
drop policy if exists "food_images: admin all" on public.food_images;
create policy "food_images: admin all" on public.food_images for all using (private.is_admin());
