-- Icono bundled seleccionado al crear un alimento (key → assets/food-icons).

alter table public.foods
  add column if not exists icon_key text;

alter table public.meal_logs
  add column if not exists icon_key text;

create index if not exists idx_foods_icon_key on public.foods(icon_key)
  where icon_key is not null;
