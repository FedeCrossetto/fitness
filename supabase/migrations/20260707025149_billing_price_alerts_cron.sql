-- ════════════════════════════════════════════════════════════════
-- 0070 — Cron diario: chequear precios de facturación desactualizados
--   Llama a la edge function check-billing-price-alerts una vez por día.
--   El secret compartido (no el service_role key) vive en Vault, no en texto
--   plano en esta migración — así el repo no expone ningún token real.
--   IMPORTANTE (paso manual post-migración): reemplazar el valor placeholder
--   del secret en Vault por el real (coincidir con el secret CRON_SECRET
--   seteado en la función vía `supabase secrets set CRON_SECRET=...`).
-- ════════════════════════════════════════════════════════════════

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

do $$
begin
  perform vault.create_secret(
    'CHANGE_ME_SET_VIA_SUPABASE_SECRETS_SET',
    'billing_alerts_cron_secret',
    'Shared secret para autorizar el cron de check-billing-price-alerts (debe coincidir con CRON_SECRET de la función).'
  );
exception when unique_violation then null;
end $$;

select cron.schedule(
  'check-billing-price-alerts-daily',
  '0 13 * * *', -- 13:00 UTC ≈ 10:00 en Argentina
  $cron$
  select net.http_post(
    url := 'https://lddadlaqvvqelbftvgpd.supabase.co/functions/v1/check-billing-price-alerts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets where name = 'billing_alerts_cron_secret'
      )
    ),
    body := '{}'::jsonb
  );
  $cron$
);
