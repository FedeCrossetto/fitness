-- ════════════════════════════════════════════════════════════════
-- 0010 — Storage: buckets + políticas
-- ════════════════════════════════════════════════════════════════

-- Buckets públicos
insert into storage.buckets (id, name, public) values
  ('avatars',             'avatars',             true),
  ('exercise-media',      'exercise-media',      true),
  ('food-images',         'food-images',         true),
  ('brand-illustrations', 'brand-illustrations', true)
on conflict (id) do nothing;

-- Buckets privados (ruta {user_id}/... obligatoria)
insert into storage.buckets (id, name, public) values
  ('progress-photos', 'progress-photos', false),
  ('meal-photos',     'meal-photos',     false)
on conflict (id) do nothing;

-- ── Políticas: buckets privados — el usuario solo accede a su carpeta ──
do $$
declare b text;
begin
  foreach b in array array['progress-photos','meal-photos'] loop
    execute format('drop policy if exists "%s: select own folder" on storage.objects', b);
    execute format(
      'create policy "%s: select own folder" on storage.objects for select to authenticated
       using (bucket_id = %L and auth.uid()::text = (storage.foldername(name))[1])', b, b);

    execute format('drop policy if exists "%s: insert own folder" on storage.objects', b);
    execute format(
      'create policy "%s: insert own folder" on storage.objects for insert to authenticated
       with check (bucket_id = %L and auth.uid()::text = (storage.foldername(name))[1])', b, b);

    -- upsert necesita UPDATE además de INSERT+SELECT
    execute format('drop policy if exists "%s: update own folder" on storage.objects', b);
    execute format(
      'create policy "%s: update own folder" on storage.objects for update to authenticated
       using (bucket_id = %L and auth.uid()::text = (storage.foldername(name))[1])', b, b);

    execute format('drop policy if exists "%s: delete own folder" on storage.objects', b);
    execute format(
      'create policy "%s: delete own folder" on storage.objects for delete to authenticated
       using (bucket_id = %L and auth.uid()::text = (storage.foldername(name))[1])', b, b);
  end loop;
end $$;

-- ── Políticas: avatars — público de lectura, escritura solo en carpeta propia ──
drop policy if exists "avatars: public read" on storage.objects;
create policy "avatars: public read" on storage.objects for select using (bucket_id = 'avatars');

drop policy if exists "avatars: insert own folder" on storage.objects;
create policy "avatars: insert own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "avatars: update own folder" on storage.objects;
create policy "avatars: update own folder" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "avatars: delete own folder" on storage.objects;
create policy "avatars: delete own folder" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

-- ── Políticas: catálogos públicos — lectura pública, escritura solo admin ──
do $$
declare b text;
begin
  foreach b in array array['exercise-media','food-images','brand-illustrations'] loop
    execute format('drop policy if exists "%s: public read" on storage.objects', b);
    execute format(
      'create policy "%s: public read" on storage.objects for select using (bucket_id = %L)', b, b);

    execute format('drop policy if exists "%s: admin write" on storage.objects', b);
    execute format(
      'create policy "%s: admin write" on storage.objects for all to authenticated
       using (bucket_id = %L and private.is_admin())
       with check (bucket_id = %L and private.is_admin())', b, b, b);
  end loop;
end $$;
