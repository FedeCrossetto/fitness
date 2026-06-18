-- ════════════════════════════════════════════════════════════════
-- 0027 — El entrenador puede actualizar el perfil de sus alumnos
-- ════════════════════════════════════════════════════════════════
-- Faltaba la policy de UPDATE: el entrenador solo podía leer a sus clientes
-- (0012), no modificarlos. Por eso "activar" un alumno desde la web no
-- persistía (RLS bloqueaba el UPDATE en silencio, 0 filas) y el alumno seguía
-- figurando como 'pending' en la app.
--
-- with check (trainer_id = auth.uid()): el entrenador no puede reasignar el
-- alumno a otro entrenador ni desvincularlo por esta vía.

drop policy if exists "profiles: trainer updates clients" on public.profiles;
create policy "profiles: trainer updates clients" on public.profiles for update to authenticated
  using (trainer_id = auth.uid())
  with check (trainer_id = auth.uid());
