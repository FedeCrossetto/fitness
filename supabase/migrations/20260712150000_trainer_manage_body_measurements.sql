-- El entrenador puede registrar/editar/borrar mediciones corporales de sus
-- clientes (necesario para el "Registrar medición" del panel). Antes sólo
-- tenía permiso de lectura (0012_multitenancy).
drop policy if exists "body_measurements: trainer manages clients" on public.body_measurements;
create policy "body_measurements: trainer manages clients" on public.body_measurements
  for all
  using (private.is_my_client(user_id))
  with check (private.is_my_client(user_id));
