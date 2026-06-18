-- ════════════════════════════════════════════════════════════════
-- 0026 — Bloqueo server-side de clientes no activos (pendientes)
-- ════════════════════════════════════════════════════════════════
-- El gate de la app (UI) ya bloquea a los pendientes, pero RLS debe impedir
-- la escritura aunque alguien evite la UI. Empezamos por el vector reportado:
-- el envío de mensajes. El helper queda reutilizable para extender a otras
-- tablas o a vencimiento de suscripción en el futuro.

-- Helper: el usuario autenticado es staff o un cliente ACTIVO.
create or replace function private.is_active_client()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (p.role in ('trainer', 'admin') or p.client_status = 'active')
  );
$$;
grant execute on function private.is_active_client() to authenticated;

-- El cliente solo puede enviar mensajes si está activo.
drop policy if exists "messages: insert own" on public.messages;
create policy "messages: insert own" on public.messages for insert
  with check (auth.uid() = client_id and sender_role = 'client' and private.is_active_client());
