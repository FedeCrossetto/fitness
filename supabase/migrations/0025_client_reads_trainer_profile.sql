-- ════════════════════════════════════════════════════════════════
-- 0025 — El alumno puede leer el perfil de su entrenador
-- ════════════════════════════════════════════════════════════════
-- Hasta ahora un cliente solo podía leer su propio perfil. Para mostrar el
-- avatar/nombre del entrenador en el chat necesita poder leer esa fila.
-- private.my_trainer_id() devuelve el trainer_id del usuario autenticado.

drop policy if exists "profiles: client reads trainer" on public.profiles;
create policy "profiles: client reads trainer" on public.profiles for select to authenticated
  using (id = private.my_trainer_id());
