-- ════════════════════════════════════════════════════════════════
-- 0062 — Permitir al entrenador actualizar el status de sus evaluation_requests
--   Necesario para la acción "Marcar reunión hecha" en /students (Pendientes).
--   Hasta ahora solo había policy de select para el entrenador.
-- ════════════════════════════════════════════════════════════════

drop policy if exists "trainers_update_evaluation_requests" on public.evaluation_requests;

create policy "trainers_update_evaluation_requests" on public.evaluation_requests
  for update to authenticated
  using (trainer_id = auth.uid())
  with check (trainer_id = auth.uid());

notify pgrst, 'reload schema';
