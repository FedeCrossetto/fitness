-- ════════════════════════════════════════════════════════════════
-- 0024 — Permitir múltiples fotos de progreso por posición y día
-- ════════════════════════════════════════════════════════════════
-- Hasta ahora unique(user_id, position, recorded_at) limitaba a una sola
-- foto por posición por día (la nueva pisaba la anterior). Lo quitamos para
-- que el alumno pueda subir todas las fotos que quiera y armar un historial.

alter table public.progress_photos
  drop constraint if exists progress_photos_user_id_position_recorded_at_key;

-- Índice para listar el historial por usuario/fecha de forma eficiente.
create index if not exists idx_progress_photos_user_created
  on public.progress_photos (user_id, created_at desc);
