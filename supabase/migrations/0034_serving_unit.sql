-- Unidad de porción: gramos, mililitros o unidades.

alter table public.foods
  add column if not exists serving_unit text not null default 'g'
    check (serving_unit in ('g', 'ml', 'unit'));

alter table public.trainer_foods
  add column if not exists serving_unit text not null default 'g'
    check (serving_unit in ('g', 'ml', 'unit'));

alter table public.food_submissions
  add column if not exists serving_unit text not null default 'g'
    check (serving_unit in ('g', 'ml', 'unit'));

alter table public.meal_logs
  add column if not exists portion_unit text not null default 'g'
    check (portion_unit in ('g', 'ml', 'unit'));
