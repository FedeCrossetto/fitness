-- ════════════════════════════════════════════════════════════════
-- 1) Ampliar body_measurements con todos los tipos de medida de Hevy.
-- 2) Sembrar datos fake para Sebastian Riera (mediciones semanales +
--    entrenamientos con volumen/sets/duración) de los últimos ~4 meses,
--    para poblar los gráficos del perfil. Idempotente y guardado por
--    existencia del usuario (no rompe en otros entornos).
-- ════════════════════════════════════════════════════════════════

alter table public.body_measurements
  add column if not exists abdomen_cm         numeric(5,1),
  add column if not exists neck_cm            numeric(5,1),
  add column if not exists shoulder_cm        numeric(5,1),
  add column if not exists left_bicep_cm      numeric(5,1),
  add column if not exists right_bicep_cm     numeric(5,1),
  add column if not exists left_forearm_cm    numeric(5,1),
  add column if not exists right_forearm_cm   numeric(5,1),
  add column if not exists left_thigh_cm      numeric(5,1),
  add column if not exists right_thigh_cm     numeric(5,1),
  add column if not exists left_calf_cm       numeric(5,1),
  add column if not exists right_calf_cm      numeric(5,1),
  add column if not exists lean_body_mass_kg  numeric(5,2);

do $$
declare
  v_uid uuid := '5a82b8c5-dd5d-4889-a621-b839b5f73d12';
begin
  if not exists (select 1 from auth.users where id = v_uid) then
    return;
  end if;

  -- ── Entrenamientos (fake) ──────────────────────────────────────
  -- Limpiamos sólo los seeds previos (marcados) para poder re-correr.
  delete from public.workout_logs where user_id = v_uid and comments = '[seed]';

  insert into public.workout_logs (
    user_id, date, workout_name, workout_type, duration_min,
    total_volume_kg, completed_sets, rpe, completed, comments
  )
  select
    v_uid,
    d::date,
    (array['Día 1 - Espalda & Bíceps', 'Día 2 - Pecho, Hombros & Tríceps', 'Día 3 - Pierna & Core'])[1 + (n % 3)],
    'fuerza',
    48 + (n * 7 % 34),                              -- 48–82 min
    round((5200 + (n * 613 % 10800))::numeric, 0),  -- ~5.2k–16k kg
    26 + (n * 5 % 16),                              -- 26–42 sets
    7 + (n % 3),                                    -- RPE 7–9
    true,
    '[seed]'
  from (
    select d, row_number() over (order by d) as n
    from generate_series(current_date - interval '120 days', current_date - interval '1 day', interval '2 days') g(d)
    where extract(dow from d) <> 0            -- sin domingos
  ) s;

  -- ── Mediciones corporales (fake), semanales ────────────────────
  insert into public.body_measurements (
    user_id, date, weight_kg, body_fat_pct, lean_body_mass_kg,
    chest_cm, waist_cm, abdomen_cm, hips_cm, neck_cm, shoulder_cm,
    left_bicep_cm, right_bicep_cm, left_forearm_cm, right_forearm_cm,
    left_thigh_cm, right_thigh_cm, left_calf_cm, right_calf_cm
  )
  select
    v_uid,
    d::date,
    round((72.6 - i * 0.11)::numeric, 1),                       -- peso 72.6 → ~70.8
    round((18.6 - i * 0.13)::numeric, 1),                       -- %grasa 18.6 → ~16.5
    round(((72.6 - i * 0.11) * (1 - (18.6 - i * 0.13) / 100))::numeric, 2),
    round((99.5 + i * 0.06)::numeric, 1),                       -- pecho
    round((84.5 - i * 0.16)::numeric, 1),                       -- cintura
    round((86.5 - i * 0.16)::numeric, 1),                       -- abdomen
    round((98.0 + i * 0.04)::numeric, 1),                       -- cadera
    round((38.4 + i * 0.01)::numeric, 1),                       -- cuello
    round((118.0 + i * 0.05)::numeric, 1),                      -- hombro
    round((34.6 + i * 0.05)::numeric, 1),                       -- bicep izq
    round((35.0 + i * 0.05)::numeric, 1),                       -- bicep der
    round((27.8 + i * 0.02)::numeric, 1),                       -- antebrazo izq
    round((28.1 + i * 0.02)::numeric, 1),                       -- antebrazo der
    round((57.5 + i * 0.03)::numeric, 1),                       -- muslo izq
    round((57.9 + i * 0.03)::numeric, 1),                       -- muslo der
    round((37.8 + i * 0.02)::numeric, 1),                       -- gemelo izq
    round((38.0 + i * 0.02)::numeric, 1)                        -- gemelo der
  from (
    select d, row_number() over (order by d) - 1 as i
    from generate_series(current_date - interval '119 days', current_date, interval '7 days') g(d)
  ) s
  on conflict (user_id, date) do update set
    weight_kg = excluded.weight_kg,
    body_fat_pct = excluded.body_fat_pct,
    lean_body_mass_kg = excluded.lean_body_mass_kg,
    chest_cm = excluded.chest_cm,
    waist_cm = excluded.waist_cm,
    abdomen_cm = excluded.abdomen_cm,
    hips_cm = excluded.hips_cm,
    neck_cm = excluded.neck_cm,
    shoulder_cm = excluded.shoulder_cm,
    left_bicep_cm = excluded.left_bicep_cm,
    right_bicep_cm = excluded.right_bicep_cm,
    left_forearm_cm = excluded.left_forearm_cm,
    right_forearm_cm = excluded.right_forearm_cm,
    left_thigh_cm = excluded.left_thigh_cm,
    right_thigh_cm = excluded.right_thigh_cm,
    left_calf_cm = excluded.left_calf_cm,
    right_calf_cm = excluded.right_calf_cm;
end $$;
