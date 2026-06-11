-- ════════════════════════════════════════════════════════════════
-- 0011 — Fix: índice único de foods(user_id, barcode) usable por ON CONFLICT
-- ════════════════════════════════════════════════════════════════
-- El índice parcial original (`where barcode is not null`) no puede ser
-- inferido como árbitro de ON CONFLICT por PostgREST/supabase-js (el upsert
-- de saveFood fallaba con 42P10). Un índice único completo sobre
-- (user_id, barcode) sí sirve como árbitro y conserva la semántica: en
-- Postgres los NULL son distintos, así que varios alimentos sin barcode por
-- usuario siguen permitidos.

drop index if exists public.foods_user_barcode_unique;
create unique index if not exists foods_user_barcode_unique
  on public.foods(user_id, barcode);
