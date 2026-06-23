-- ════════════════════════════════════════════════════════════════
-- 0055 — Fotos de progreso durante onboarding (clientes pending)
-- ════════════════════════════════════════════════════════════════
-- 0035 exigía is_active_client() para progress_photos y el bucket
-- progress-photos, pero el alumno puede registrar fotos antes de activarse.
-- Revertimos el gate solo acá; meal-photos sigue bloqueado para pending.

drop policy if exists "progress_photos: insert own" on public.progress_photos;
create policy "progress_photos: insert own" on public.progress_photos
  for insert with check (auth.uid() = user_id);

drop policy if exists "progress_photos: update own" on public.progress_photos;
create policy "progress_photos: update own" on public.progress_photos
  for update using (auth.uid() = user_id);

drop policy if exists "progress-photos: insert own folder" on storage.objects;
create policy "progress-photos: insert own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'progress-photos' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "progress-photos: update own folder" on storage.objects;
create policy "progress-photos: update own folder" on storage.objects for update to authenticated
  using (bucket_id = 'progress-photos' and auth.uid()::text = (storage.foldername(name))[1]);
