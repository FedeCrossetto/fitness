-- ════════════════════════════════════════════════════════════════
-- Datos fake para Sebastian Riera: hidratación (últimos 45 días) y
-- comidas (últimos 14 días, 3-4 por día con macros). Idempotente y
-- guardado por existencia del usuario.
-- ════════════════════════════════════════════════════════════════

do $$
declare
  v_uid uuid := '5a82b8c5-dd5d-4889-a621-b839b5f73d12';
begin
  if not exists (select 1 from auth.users where id = v_uid) then
    return;
  end if;

  -- ── Hidratación ──────────────────────────────────────────────
  delete from public.hydration_logs where user_id = v_uid;

  insert into public.hydration_logs (user_id, date, total_ml, goal_ml)
  select
    v_uid,
    d::date,
    -- 1600–3100 ml, con variación día a día.
    1600 + ((n * 337) % 1500),
    3000
  from (
    select d, row_number() over (order by d) as n
    from generate_series(current_date - interval '44 days', current_date, interval '1 day') g(d)
  ) s;

  -- ── Comidas (últimos 14 días) ────────────────────────────────
  delete from public.meal_logs where user_id = v_uid and macro_source = 'manual' and product_display_name like 'Seed:%';

  insert into public.meal_logs (
    user_id, date, meal_type, title, product_display_name, macro_source,
    portion_grams, portion_unit, energy_kcal, protein_g, carbs_g, fat_g, is_included
  )
  select
    v_uid,
    d::date,
    meal.meal_type,
    meal.title,
    'Seed: ' || meal.title,
    'manual',
    meal.grams,
    'g',
    meal.kcal,
    meal.protein,
    meal.carbs,
    meal.fat,
    true
  from generate_series(current_date - interval '13 days', current_date, interval '1 day') g(d)
  cross join lateral (
    values
      ('DES'::text, 'Avena con banana y whey', 320, 420, 28, 55, 9),
      ('ALM', 'Pechuga de pollo, arroz y ensalada', 480, 610, 48, 65, 14),
      ('MER', 'Yogur griego con frutos secos', 220, 280, 18, 22, 12),
      ('CEN', 'Salmón, batata y brócoli', 450, 560, 42, 48, 18)
  ) as meal(meal_type, title, grams, kcal, protein, carbs, fat);
end $$;
