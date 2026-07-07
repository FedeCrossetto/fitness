-- ════════════════════════════════════════════════════════════════
-- 0072 — Preferencias de notificación para cliente nuevo y compra de plan
--   Mismo patrón que notify_billing_email/whatsapp (0069) — cada tipo de
--   aviso se puede prender/apagar por separado en Settings > Notifications.
-- ════════════════════════════════════════════════════════════════

alter table public.trainer_notification_prefs
  add column if not exists notify_new_client_email       boolean not null default true,
  add column if not exists notify_new_client_whatsapp     boolean not null default false,
  add column if not exists notify_plan_purchased_email    boolean not null default true,
  add column if not exists notify_plan_purchased_whatsapp boolean not null default false;

notify pgrst, 'reload schema';
