-- Día de la semana recurrente asignado a una rutina (0=Lunes..6=Domingo).
-- null = sin día fijo (orden implícito por day_number, como hasta ahora).
alter table public.training_days
  add column if not exists day_of_week smallint;

alter table public.training_days
  add constraint training_days_day_of_week_range
  check (day_of_week is null or (day_of_week >= 0 and day_of_week <= 6));
