-- ════════════════════════════════════════════════════════════════
-- 0071 — Notificar al entrenador por mail: cliente nuevo pendiente + compra de plan
--   Dos triggers en la base (no en el código de la app) para que dispare
--   sin importar por qué camino pasó: signup por email, OAuth, vinculación
--   post-OAuth, webhook de MP, pago manual, o pull-sync. Cada uno llama
--   (vía pg_net, ya usado por el cron de alertas de precio) a un edge
--   function dedicado que arma y manda el mail con Resend.
--
--   Protegidos por un secret compartido propio (DB_WEBHOOK_SECRET), no el
--   service_role key — mismo patrón que el cron de billing alerts. El
--   valor real se setea aparte (Vault + `supabase secrets set`), nunca en
--   esta migración.
-- ════════════════════════════════════════════════════════════════

do $$
begin
  perform vault.create_secret(
    'CHANGE_ME_SET_VIA_SUPABASE_SECRETS_SET',
    'db_webhook_secret',
    'Shared secret para autorizar las llamadas de triggers de la DB a edge functions (notify-new-client, notify-plan-purchased). Debe coincidir con DB_WEBHOOK_SECRET de esas funciones.'
  );
exception when unique_violation then null;
end $$;

-- ── Cliente nuevo en estado "pending" ──────────────────────────────────────
-- Cubre tanto el insert directo (signup por email con código en metadata)
-- como la vinculación post-OAuth (link_client_by_invite_code, que hace un
-- UPDATE sobre una fila ya existente) — dispara solo en la transición HACIA
-- 'pending', no en cada UPDATE subsiguiente del perfil.
create or replace function private.notify_new_pending_client()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.client_status = 'pending' and new.trainer_id is not null
     and (tg_op = 'INSERT' or old.client_status is distinct from 'pending') then
    perform net.http_post(
      url := 'https://lddadlaqvvqelbftvgpd.supabase.co/functions/v1/notify-new-client',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          select decrypted_secret from vault.decrypted_secrets where name = 'db_webhook_secret'
        )
      ),
      body := jsonb_build_object('client_id', new.id)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists on_profile_pending_notify on public.profiles;
create trigger on_profile_pending_notify
  after insert or update on public.profiles
  for each row execute function private.notify_new_pending_client();

-- ── Suscripción pasa a "active" por primera vez (compra de plan) ──────────
-- Un solo trigger cubre los 4 caminos de activación (preapproval autorizado
-- y pago único de MP en mp-webhook, pago manual via register_manual_payment,
-- y la reactivación pull de mp-sync-subscription) sin duplicar el envío de
-- mail en cada uno. No dispara en renovaciones (ya estaba 'active').
create or replace function private.notify_plan_purchased()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'active' and (tg_op = 'INSERT' or old.status is distinct from 'active') then
    perform net.http_post(
      url := 'https://lddadlaqvvqelbftvgpd.supabase.co/functions/v1/notify-plan-purchased',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          select decrypted_secret from vault.decrypted_secrets where name = 'db_webhook_secret'
        )
      ),
      body := jsonb_build_object('subscription_id', new.id)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists on_subscription_activated_notify on public.subscriptions;
create trigger on_subscription_activated_notify
  after insert or update on public.subscriptions
  for each row execute function private.notify_plan_purchased();
