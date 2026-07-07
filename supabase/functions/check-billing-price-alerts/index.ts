// Edge Function: check-billing-price-alerts
// Cron diario (ver migración 20260707025500_billing_price_alerts_cron.sql):
// recorre las suscripciones activas recurrentes (MercadoPago) cuyo precio
// actual de la frecuencia difiere de lo que el alumno realmente paga
// (subscriptions.amount_ars), y si faltan menos de 10 días para la renovación,
// le manda un mail al entrenador para que lo actualice a mano en MP.
//
// Protegida por un secret compartido (CRON_SECRET) en vez del service role
// key de Supabase — evita exponer un token todopoderoso en la definición del
// cron job. Solo pg_cron (via Vault) y quien tenga ese secret puede invocarla.
//
// Secrets requeridos: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET,
//   RESEND_API_KEY, RESEND_FROM_EMAIL

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { sendResendEmail } from '../_shared/resend.ts';

const ALERT_THRESHOLD_DAYS = 10;
const RESEND_COOLDOWN_MS = 20 * 60 * 60 * 1000; // ~20h: margen para que el cron diario no repita el mismo día.

Deno.serve(async (req) => {
  const cronSecret = Deno.env.get('CRON_SECRET');
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { data: subs, error: subsError } = await admin
    .from('subscriptions')
    .select('id, user_id, plan_id, amount_ars, expires_at, mp_preapproval_id, last_price_alert_sent_at')
    .eq('status', 'active')
    .not('mp_preapproval_id', 'is', null)
    .not('amount_ars', 'is', null);

  if (subsError) {
    console.error('[check-billing-price-alerts] error listando subscriptions:', subsError.message);
    return new Response(JSON.stringify({ error: 'db_error' }), { status: 500 });
  }

  const rows = subs ?? [];
  let checked = 0;
  let flagged = 0;
  let sent = 0;

  for (const sub of rows) {
    checked++;
    const daysLeft = Math.ceil((new Date(sub.expires_at as string).getTime() - Date.now()) / 86_400_000);
    if (daysLeft >= ALERT_THRESHOLD_DAYS) continue;

    if (sub.last_price_alert_sent_at) {
      const sinceLast = Date.now() - new Date(sub.last_price_alert_sent_at as string).getTime();
      if (sinceLast < RESEND_COOLDOWN_MS) continue;
    }

    const { data: profile } = await admin
      .from('profiles')
      .select('trainer_id, full_name')
      .eq('id', sub.user_id)
      .maybeSingle();
    if (!profile?.trainer_id) continue;

    const { data: plan } = await admin
      .from('plans')
      .select('price_ars')
      .eq('id', sub.plan_id)
      .maybeSingle();
    if (!plan) continue;

    const { data: override } = await admin
      .from('trainer_plan_prices')
      .select('price_ars')
      .eq('trainer_id', profile.trainer_id)
      .eq('plan_id', sub.plan_id)
      .maybeSingle();

    const effectivePrice = Number(override?.price_ars ?? plan.price_ars);
    if (effectivePrice === Number(sub.amount_ars)) continue;

    flagged++;

    const { data: prefs } = await admin
      .from('trainer_notification_prefs')
      .select('notify_billing_email')
      .eq('trainer_id', profile.trainer_id)
      .maybeSingle();
    // Sin fila propia = default (notify_billing_email true), igual que la
    // columna en la tabla — el entrenador nunca configuró esto todavía.
    if (prefs && !prefs.notify_billing_email) continue;

    const { data: trainerAuth } = await admin.auth.admin.getUserById(profile.trainer_id);
    const trainerEmail = trainerAuth?.user?.email;
    if (!trainerEmail) continue;

    const { ok } = await sendResendEmail({
      to: trainerEmail,
      subject: 'Un cliente tiene un precio de facturación desactualizado',
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="color:#111;">Precio de facturación desactualizado</h2>
          <p style="color:#444; line-height:1.5;">
            <strong>${profile.full_name ?? 'Un cliente'}</strong> paga $${Number(sub.amount_ars).toLocaleString('es-AR')}
            por mes, pero el precio actual de esa frecuencia es $${effectivePrice.toLocaleString('es-AR')}.
            Su suscripción renueva en ${daysLeft} día${daysLeft === 1 ? '' : 's'}.
          </p>
          <p style="color:#444; line-height:1.5;">
            Entrá a Mercado Pago y actualizá el monto de la suscripción recurrente para que coincida,
            o revisá el detalle en la pestaña Facturación de este cliente en la webapp.
          </p>
        </div>
      `,
    });
    if (ok) {
      sent++;
      await admin.from('subscriptions').update({ last_price_alert_sent_at: new Date().toISOString() }).eq('id', sub.id);
    }
  }

  return new Response(JSON.stringify({ checked, flagged, sent }), { headers: { 'Content-Type': 'application/json' } });
});
