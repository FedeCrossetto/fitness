-- ════════════════════════════════════════════════════════════════
-- 0069 — Preferencias de notificación de facturación + log anti-spam
--   El entrenador puede querer que le avisen (por mail y/o WhatsApp) cuando
--   un alumno paga un precio distinto al de la frecuencia actual y le queda
--   poco para renovar. Guardamos la preferencia por entrenador (mismo
--   patrón que waiver_configs: fila única por trainer_id, RLS "manages own").
--   El WhatsApp todavía no tiene ningún backend de envío — el toggle solo
--   persiste la preferencia para cuando se conecte, no dispara nada hoy.
-- ════════════════════════════════════════════════════════════════

create table if not exists public.trainer_notification_prefs (
  trainer_id              uuid primary key references auth.users(id) on delete cascade,
  notify_billing_email    boolean not null default true,
  notify_billing_whatsapp boolean not null default false,
  updated_at              timestamptz not null default now()
);

drop trigger if exists on_trainer_notification_prefs_updated on public.trainer_notification_prefs;
create trigger on_trainer_notification_prefs_updated before update on public.trainer_notification_prefs
  for each row execute function public.handle_updated_at();

alter table public.trainer_notification_prefs enable row level security;

drop policy if exists "trainer_notification_prefs: trainer manages own" on public.trainer_notification_prefs;
create policy "trainer_notification_prefs: trainer manages own" on public.trainer_notification_prefs for all
  using (trainer_id = auth.uid()) with check (trainer_id = auth.uid());

drop policy if exists "trainer_notification_prefs: admin all" on public.trainer_notification_prefs;
create policy "trainer_notification_prefs: admin all" on public.trainer_notification_prefs for all
  using (private.is_admin());

-- Anti-spam: cuándo fue la última vez que se le avisó al entrenador sobre el
-- precio desactualizado de ESTA suscripción puntual, para no mandarle un
-- mail por día mientras el cron corre.
alter table public.subscriptions
  add column if not exists last_price_alert_sent_at timestamptz;

notify pgrst, 'reload schema';
