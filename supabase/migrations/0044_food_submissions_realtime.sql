-- ════════════════════════════════════════════════════════════════
-- 0044 — Realtime en food_submissions (badge y tab Pendientes)
-- ════════════════════════════════════════════════════════════════

do $$
begin
  alter publication supabase_realtime add table public.food_submissions;
exception when duplicate_object then null;
end $$;
