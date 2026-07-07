// Edge Function: notify-plan-purchased
// Disparada por un trigger de Postgres (ver migración
// 20260707034630_trainer_notify_new_client_and_purchase.sql) cada vez que una
// suscripción pasa a status='active' por primera vez — cubre preapproval
// autorizado y pago único de MercadoPago, pago manual registrado por el
// entrenador, y reactivación pull — sin importar el camino, le manda un mail
// al entrenador con los datos básicos del cliente y del plan comprado.
//
// Protegida por un secret compartido (DB_WEBHOOK_SECRET), no el service role
// key — el trigger lo manda como Bearer token via pg_net.
//
// Secrets requeridos: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DB_WEBHOOK_SECRET,
//   RESEND_API_KEY, RESEND_FROM_EMAIL

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { sendResendEmail } from '../_shared/resend.ts';

Deno.serve(async (req) => {
  const dbSecret = Deno.env.get('DB_WEBHOOK_SECRET');
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!dbSecret || authHeader !== `Bearer ${dbSecret}`) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
  }

  const { subscription_id } = (await req.json().catch(() => ({}))) as { subscription_id?: string };
  if (!subscription_id) {
    return new Response(JSON.stringify({ error: 'subscription_id requerido' }), { status: 400 });
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { data: sub } = await admin
    .from('subscriptions')
    .select('user_id, plan_id, amount_ars, started_at, mp_status')
    .eq('id', subscription_id)
    .maybeSingle();
  if (!sub) {
    return new Response(JSON.stringify({ skipped: 'sin_suscripcion' }), { headers: { 'Content-Type': 'application/json' } });
  }

  const [{ data: profile }, { data: plan }] = await Promise.all([
    admin.from('profiles').select('full_name, phone, trainer_id').eq('id', sub.user_id).maybeSingle(),
    admin.from('plans').select('name, duration_days, plan_type').eq('id', sub.plan_id).maybeSingle(),
  ]);
  if (!profile?.trainer_id) {
    return new Response(JSON.stringify({ skipped: 'sin_trainer' }), { headers: { 'Content-Type': 'application/json' } });
  }

  const [{ data: clientAuth }, { data: trainerAuth }] = await Promise.all([
    admin.auth.admin.getUserById(sub.user_id),
    admin.auth.admin.getUserById(profile.trainer_id),
  ]);
  const trainerEmail = trainerAuth?.user?.email;
  if (!trainerEmail) {
    return new Response(JSON.stringify({ skipped: 'sin_email_entrenador' }), { headers: { 'Content-Type': 'application/json' } });
  }

  const clientEmail = clientAuth?.user?.email ?? 'sin email';
  const clientName = profile.full_name ?? 'Sin nombre';
  const months = plan ? Math.max(1, Math.round(Number(plan.duration_days) / 30)) : null;
  const durationLabel = months ? (months === 1 ? '1 mes' : `${months} meses`) : 'duración no disponible';
  const planLabel = plan ? `${plan.plan_type === 'mentoria' ? 'Mentoría 1 a 1' : 'Base'} — ${durationLabel}` : 'Plan no disponible';
  const amountLabel = sub.amount_ars != null ? `$${Number(sub.amount_ars).toLocaleString('es-AR')}` : 'monto no disponible';
  const paymentMethod = sub.mp_status === 'manual' ? 'Pago manual' : 'Mercado Pago';

  const { ok } = await sendResendEmail({
    to: trainerEmail,
    subject: `Nuevo pago: ${clientName} compró ${planLabel}`,
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color:#111;">¡Nuevo pago recibido!</h2>
        <p style="color:#444; line-height:1.5;">
          <strong>${clientName}</strong> activó su suscripción.
        </p>
        <ul style="color:#444; line-height:1.7; padding-left:18px;">
          <li>Email: ${clientEmail}</li>
          ${profile.phone ? `<li>Teléfono: ${profile.phone}</li>` : ''}
          <li>Plan: ${planLabel}</li>
          <li>Monto: ${amountLabel}</li>
          <li>Método: ${paymentMethod}</li>
        </ul>
      </div>
    `,
  });

  return new Response(JSON.stringify({ ok }), { headers: { 'Content-Type': 'application/json' } });
});
