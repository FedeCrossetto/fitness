-- ════════════════════════════════════════════════════════════════
-- 0041 — Realtime en communities (badge de lectura del entrenador)
-- ════════════════════════════════════════════════════════════════

do $$
begin
  alter publication supabase_realtime add table public.communities;
exception when duplicate_object then null;
end $$;
