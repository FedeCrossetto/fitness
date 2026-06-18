-- ════════════════════════════════════════════════════════════════
-- 0023 — Storage: el entrenador puede LEER las fotos de sus alumnos
-- ════════════════════════════════════════════════════════════════
-- Los buckets progress-photos y meal-photos son privados y, hasta ahora,
-- solo el dueño (carpeta {user_id}/...) podía leer sus objetos. El panel
-- web del entrenador necesita generar signed URLs de las fotos de sus
-- clientes vinculados (feed de actividad, detalle de alumno).
--
-- private.is_my_client(uuid) ya valida que el user_id sea cliente del
-- entrenador autenticado (definido en 0012_multitenancy.sql).

do $$
declare b text;
begin
  foreach b in array array['progress-photos','meal-photos'] loop
    execute format('drop policy if exists "%s: trainer reads clients" on storage.objects', b);
    execute format(
      'create policy "%s: trainer reads clients" on storage.objects for select to authenticated
       using (bucket_id = %L and private.is_my_client(((storage.foldername(name))[1])::uuid))', b, b);
  end loop;
end $$;
