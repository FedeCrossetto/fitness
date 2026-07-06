-- ════════════════════════════════════════════════════════════════
-- 0066 — Soft-delete de frecuencias de facturación (plans)
--   Antes, "eliminar" una frecuencia hacía un DELETE real que la FK
--   subscriptions.plan_id → plans.id (sin ON DELETE, default RESTRICT)
--   rechazaba en silencio si alguna vez existió una suscripción con esa
--   frecuencia — el entrenador veía un error genérico y la fila seguía
--   en la lista.
--
--   Ahora "eliminar" pasa a ser un soft-delete (deleted_at + active=false):
--   la fila sigue existiendo para no romper la FK ni la renovación de
--   MercadoPago de los alumnos que ya la tenían elegida (el monto
--   recurrente vive en el preapproval de MP, independiente de esta
--   tabla), pero deja de ofrecerse en la gestión del entrenador y en
--   checkout nuevo.
-- ════════════════════════════════════════════════════════════════

alter table public.plans
  add column if not exists deleted_at timestamptz;

-- Lectura: planes built-in + custom del propio entrenador/entrenador del
-- cliente, siempre que no estén soft-deleted — salvo que el usuario
-- actual tenga una suscripción propia apuntando a esa fila (para poder
-- seguir mostrándole su plan aunque ya no esté en el catálogo activo).
drop policy if exists "plans: read" on public.plans;
create policy "plans: read" on public.plans for select to authenticated
  using (
    (
      deleted_at is null
      and (trainer_id is null or trainer_id = private.my_trainer_id())
    )
    or exists (
      select 1 from public.subscriptions s
      where s.plan_id = plans.id and s.user_id = auth.uid()
    )
  );

-- El "borrado" desde la webapp ahora es un UPDATE (seteando deleted_at),
-- ya cubierto por la policy existente "plans: trainer updates own custom".
-- Se quita la policy de DELETE: ya no se debe poder borrar una fila real.
drop policy if exists "plans: trainer deletes own custom" on public.plans;

notify pgrst, 'reload schema';
