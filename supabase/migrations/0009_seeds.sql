-- ════════════════════════════════════════════════════════════════
-- 0009 — Seeds (alineados a la paleta verde) + programa demo
-- ════════════════════════════════════════════════════════════════

insert into public.goal_templates (title, goal_type, target_value, target_unit, icon, color, sort_order) values
  ('2.5L de Agua',         'hydration', 2500,  'ml',      'cup-water',  '#90BD3B', 0),
  ('Caminar 10.000 pasos', 'steps',     10000, 'steps',   'walk',       '#BEFC50', 1),
  ('Entrenar',             'training',  1,     'boolean', 'dumbbell',   '#7DA433', 2),
  ('Registrar 3 comidas',  'meals',     3,     'meals',   'food-apple', '#D4FD7F', 3)
on conflict do nothing;

insert into public.plans (id, name, description, price_ars, duration_days) values
  ('monthly',    'Plan Mensual',    'Acceso completo por 1 mes',   15000, 30),
  ('quarterly',  'Plan Trimestral', 'Acceso completo por 3 meses', 39000, 90),
  ('semiannual', 'Plan Semestral',  'Acceso completo por 6 meses', 69000, 180)
on conflict (id) do nothing;

-- ── Programa de entrenamiento demo (program_key 'default') ──
-- Ejercicios base
insert into public.exercises (id, slug, name, body_part, target_muscles, secondary_muscles, equipment, exercise_type, instructions) values
  ('ex-sentadilla',   'sentadilla-barra',   'Sentadilla con barra',     'piernas',  array['cuádriceps','glúteos'], array['core','isquiotibiales'], array['barra','rack'],      'fuerza', array['Apoyá la barra sobre los trapecios.','Bajá controlado hasta romper la paralela.','Subí empujando con todo el pie.']),
  ('ex-press-banca',  'press-banca',        'Press de banca',           'pecho',    array['pectoral mayor'],       array['tríceps','deltoide anterior'], array['barra','banco'], 'fuerza', array['Acostate con los pies firmes en el piso.','Bajá la barra al pecho con control.','Empujá hasta extender los codos.']),
  ('ex-peso-muerto',  'peso-muerto',        'Peso muerto',              'espalda',  array['isquiotibiales','glúteos'], array['lumbares','trapecios'], array['barra'],          'fuerza', array['Cadera atrás, espalda neutra.','Empujá el piso con las piernas.','Bloqueá cadera arriba sin hiperextender.']),
  ('ex-dominadas',    'dominadas',          'Dominadas',                'espalda',  array['dorsal ancho'],         array['bíceps','core'],         array['barra fija'],        'fuerza', array['Colgate con agarre prono.','Subí hasta pasar el mentón.','Bajá controlado a extensión completa.']),
  ('ex-press-militar','press-militar',      'Press militar',            'hombros',  array['deltoides'],            array['tríceps','core'],        array['barra'],             'fuerza', array['Barra a la altura de clavículas.','Empujá vertical sin arquear.','Bloqueá arriba y bajá con control.']),
  ('ex-remo-barra',   'remo-barra',         'Remo con barra',           'espalda',  array['dorsal','romboides'],   array['bíceps','lumbares'],     array['barra'],             'fuerza', array['Torso inclinado, espalda neutra.','Llevá la barra al abdomen.','Bajá controlando la fase excéntrica.']),
  ('ex-zancadas',     'zancadas',           'Zancadas con mancuernas',  'piernas',  array['cuádriceps','glúteos'], array['core'],                  array['mancuernas'],        'fuerza', array['Paso largo al frente.','Bajá la rodilla trasera casi al piso.','Volvé empujando con la pierna delantera.']),
  ('ex-plancha',      'plancha',            'Plancha abdominal',        'core',     array['recto abdominal'],      array['oblicuos','lumbares'],   array['peso corporal'],     'core',   array['Antebrazos al piso, cuerpo recto.','Activá abdomen y glúteos.','Mantené sin dejar caer la cadera.'])
on conflict (id) do nothing;

-- Workouts demo
insert into public.workouts (id, title, workout_type, duration_min, blocks, calories_est, notes) values
  ('11111111-1111-4111-8111-111111111111', 'Full Body A — Fuerza base',   'fuerza', 60, 3, 420, 'Enfocate en la técnica antes que en el peso.'),
  ('22222222-2222-4222-8222-222222222222', 'Full Body B — Empuje y tirón','fuerza', 55, 3, 390, 'Descansos completos entre básicos.'),
  ('33333333-3333-4333-8333-333333333333', 'Cardio Zona 2',               'cardio', 40, 1, 350, 'Mantené conversación posible durante todo el trote.')
on conflict (id) do nothing;

insert into public.workout_exercises (workout_id, exercise_id, sort_order, sets, reps, weight_kg, tempo, rest_seconds) values
  ('11111111-1111-4111-8111-111111111111', 'ex-sentadilla',    0, 4, '6-8',  60,   '3-1-1', 150),
  ('11111111-1111-4111-8111-111111111111', 'ex-press-banca',   1, 4, '8-10', 50,   '2-1-1', 120),
  ('11111111-1111-4111-8111-111111111111', 'ex-remo-barra',    2, 3, '10-12',40,   '2-0-1', 90),
  ('11111111-1111-4111-8111-111111111111', 'ex-plancha',       3, 3, '45s',  null, null,    60),
  ('22222222-2222-4222-8222-222222222222', 'ex-peso-muerto',   0, 4, '5',    80,   '2-1-1', 180),
  ('22222222-2222-4222-8222-222222222222', 'ex-press-militar', 1, 4, '8',    30,   '2-0-1', 120),
  ('22222222-2222-4222-8222-222222222222', 'ex-dominadas',     2, 3, 'al fallo', null, null, 120),
  ('22222222-2222-4222-8222-222222222222', 'ex-zancadas',      3, 3, '12',   16,   null,    90)
on conflict (workout_id, sort_order) do nothing;

-- Fase 1 con 7 días
insert into public.training_phases (id, program_key, phase_number, name, description, sort_order) values
  ('44444444-4444-4444-8444-444444444444', 'default', 1, 'Fase 1 — Adaptación', 'Construí la base: técnica, consistencia y hábito.', 0),
  ('55555555-5555-4555-8555-555555555555', 'default', 2, 'Fase 2 — Progresión', 'Subimos cargas y volumen con la técnica ya dominada.', 1)
on conflict (id) do nothing;

insert into public.training_days (phase_id, day_number, title, day_type, workout_id, sort_order) values
  ('44444444-4444-4444-8444-444444444444', 1, 'Día 1 — Full Body A', 'fuerza',   '11111111-1111-4111-8111-111111111111', 0),
  ('44444444-4444-4444-8444-444444444444', 2, 'Día 2 — Cardio suave','cardio',   '33333333-3333-4333-8333-333333333333', 1),
  ('44444444-4444-4444-8444-444444444444', 3, 'Día 3 — Descanso',    'descanso', null, 2),
  ('44444444-4444-4444-8444-444444444444', 4, 'Día 4 — Full Body B', 'fuerza',   '22222222-2222-4222-8222-222222222222', 3),
  ('44444444-4444-4444-8444-444444444444', 5, 'Día 5 — Técnica',     'tecnica',  null, 4),
  ('44444444-4444-4444-8444-444444444444', 6, 'Día 6 — Full Body A', 'fuerza',   '11111111-1111-4111-8111-111111111111', 5),
  ('44444444-4444-4444-8444-444444444444', 7, 'Día 7 — Descanso',    'descanso', null, 6)
on conflict (phase_id, day_number) do nothing;
