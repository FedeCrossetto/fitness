-- ════════════════════════════════════════════════════════════════
-- 0035 — Gate server-side: solo clientes ACTIVOS pueden escribir su tracking
-- ════════════════════════════════════════════════════════════════
-- Extiende private.is_active_client() (0026) a todas las escrituras de
-- seguimiento del alumno. Un cliente pendiente (no activado) o con la
-- suscripción vencida no puede crear/editar estos datos, aunque evite la UI.
--
-- NO se gatean: subscriptions, waiver_signatures, consultation_responses,
-- push_tokens ni avatars — el alumno los necesita estando pendiente
-- (pagar/activarse, firmar deslinde, completar consulta, recibir push).
--
-- Recordatorio: cuando is_active_client() incorpore vencimiento de
-- suscripción, este gate lo aplica automáticamente a todo lo de acá.

do $$
declare t text;
begin
  foreach t in array array[
    'daily_goals', 'workout_logs', 'foods', 'meal_logs',
    'hydration_logs', 'body_measurements', 'progress_photos'
  ] loop
    execute format('drop policy if exists "%s: insert own" on public.%I', t, t);
    execute format(
      'create policy "%s: insert own" on public.%I for insert
       with check (auth.uid() = user_id and private.is_active_client())', t, t);

    execute format('drop policy if exists "%s: update own" on public.%I', t, t);
    execute format(
      'create policy "%s: update own" on public.%I for update
       using (auth.uid() = user_id and private.is_active_client())', t, t);
  end loop;
end $$;

-- Storage: subir/editar fotos de progreso y comidas también requiere estar activo.
do $$
declare b text;
begin
  foreach b in array array['progress-photos', 'meal-photos'] loop
    execute format('drop policy if exists "%s: insert own folder" on storage.objects', b);
    execute format(
      'create policy "%s: insert own folder" on storage.objects for insert to authenticated
       with check (bucket_id = %L and auth.uid()::text = (storage.foldername(name))[1]
                   and private.is_active_client())', b, b);

    execute format('drop policy if exists "%s: update own folder" on storage.objects', b);
    execute format(
      'create policy "%s: update own folder" on storage.objects for update to authenticated
       using (bucket_id = %L and auth.uid()::text = (storage.foldername(name))[1]
              and private.is_active_client())', b, b);
  end loop;
end $$;
