-- ════════════════════════════════════════════════════════════════
-- 0053 — Medidas corporales durante onboarding (clientes pending)
-- ════════════════════════════════════════════════════════════════
-- 0035 exigía is_active_client() para escribir body_measurements, pero el
-- cuestionario post-registro corre mientras el alumno aún está pending.
-- Revertimos el gate solo en esta tabla; el resto del tracking sigue bloqueado.

drop policy if exists "body_measurements: insert own" on public.body_measurements;
create policy "body_measurements: insert own" on public.body_measurements
  for insert with check (auth.uid() = user_id);

drop policy if exists "body_measurements: update own" on public.body_measurements;
create policy "body_measurements: update own" on public.body_measurements
  for update using (auth.uid() = user_id);
