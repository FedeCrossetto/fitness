-- ─────────────────────────────────────────────────────────────────────────
-- 1) Orden manual de programas en la Biblioteca (drag & drop para reordenar).
-- ─────────────────────────────────────────────────────────────────────────
alter table public.programs
  add column if not exists sort_order integer not null default 0;

-- Backfill: orden inicial por created_at dentro de cada (trainer, carpeta).
with ranked as (
  select id,
         row_number() over (partition by trainer_id, folder_id order by created_at) - 1 as rn
  from public.programs
)
update public.programs p
   set sort_order = r.rn
  from ranked r
 where r.id = p.id;

create index if not exists idx_programs_sort on public.programs(trainer_id, folder_id, sort_order);

-- ─────────────────────────────────────────────────────────────────────────
-- 2) Sets individuales por ejercicio (tabla SET/KG/REPS estilo Hevy).
--    Se guarda un array jsonb [{ reps, kg }] en workout_exercises. Las columnas
--    sets/reps/weight_kg se mantienen como resumen (compat con mobile).
-- ─────────────────────────────────────────────────────────────────────────
alter table public.workout_exercises
  add column if not exists sets_detail jsonb not null default '[]'::jsonb;

-- Backfill: expandir sets/reps/weight_kg a un array de N sets.
update public.workout_exercises we
   set sets_detail = sub.arr
  from (
    select we2.id,
           coalesce(jsonb_agg(jsonb_build_object('reps', we2.reps, 'kg', we2.weight_kg)), '[]'::jsonb) as arr
      from public.workout_exercises we2
      cross join lateral generate_series(1, greatest(coalesce(we2.sets, 0), 0)) g
     group by we2.id
  ) sub
 where sub.id = we.id
   and jsonb_array_length(we.sets_detail) = 0;
