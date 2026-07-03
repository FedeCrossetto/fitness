-- ════════════════════════════════════════════════════════════════
-- 0064 — Un formulario de consulta por Plan (Base / Mentoría 1-1)
--   Hasta ahora había un solo form_code por entrenador. Se agrega la
--   dimensión plan_type para que el entrenador pueda definir un formulario
--   distinto para clientes de Mentoría 1-1 y de Plan Base.
--   Los registros existentes quedan plan_type='base' (comportamiento actual
--   preservado); Mentoría arranca sin fila, igual que cualquier entrenador
--   nuevo hoy (la pantalla ya maneja "sin config" con el DEFAULT_FORM).
-- ════════════════════════════════════════════════════════════════

alter table public.consultation_form_configs
  add column if not exists plan_type text not null default 'base' check (plan_type in ('base', 'mentoria'));

alter table public.consultation_form_configs
  drop constraint if exists consultation_form_configs_trainer_id_key;

alter table public.consultation_form_configs
  add constraint consultation_form_configs_trainer_id_plan_type_key unique (trainer_id, plan_type);

notify pgrst, 'reload schema';
