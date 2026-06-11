// Edge Function: mp-webhook
// Recibe notificaciones de pago de Mercado Pago y activa/expira suscripciones.
// Configurar en MP la URL: https://<proyecto>.supabase.co/functions/v1/mp-webhook
// Desplegar con --no-verify-jwt (MP no envía JWT de Supabase).
//
// Secrets requeridos: MP_ACCESS_TOKEN

import { createClient } from 'jsr:@supabase/supabase-js@2';

interface MpPayment {
  id: number;
  status: string;
  external_reference?: string;
  metadata?: { subscription_id?: string };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('ok', { status: 200 });
  }

  const mpToken = Deno.env.get('MP_ACCESS_TOKEN');
  if (!mpToken) {
    return new Response('MP_ACCESS_TOKEN no configurado', { status: 500 });
  }

  const url = new URL(req.url);
  let paymentId: string | null = url.searchParams.get('data.id') ?? url.searchParams.get('id');

  try {
    const body = (await req.json()) as { type?: string; action?: string; data?: { id?: string | number } };
    if (body?.data?.id) paymentId = String(body.data.id);
    if (body?.type && body.type !== 'payment') {
      return new Response('ignorado', { status: 200 });
    }
  } catch {
    // body vacío: usamos query params
  }

  if (!paymentId) {
    return new Response('sin payment id', { status: 200 });
  }

  // Consultar el pago real a la API de MP (nunca confiar en el payload del webhook)
  const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${mpToken}` },
  });
  if (!paymentResponse.ok) {
    console.error('No se pudo consultar el pago', paymentId);
    return new Response('error consultando pago', { status: 200 });
  }
  const payment = (await paymentResponse.json()) as MpPayment;

  const subscriptionId = payment.external_reference ?? payment.metadata?.subscription_id;
  if (!subscriptionId) {
    return new Response('sin referencia de suscripción', { status: 200 });
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { data: subscription } = await admin
    .from('subscriptions')
    .select('*, plan:plans(duration_days)')
    .eq('id', subscriptionId)
    .single();

  if (!subscription) {
    return new Response('suscripción no encontrada', { status: 200 });
  }

  if (payment.status === 'approved') {
    const startedAt = new Date();
    const durationDays = (subscription.plan as { duration_days: number } | null)?.duration_days ?? 30;
    const expiresAt = new Date(startedAt.getTime() + durationDays * 24 * 60 * 60 * 1000);

    await admin
      .from('subscriptions')
      .update({
        status: 'active',
        mp_payment_id: String(payment.id),
        mp_status: payment.status,
        started_at: startedAt.toISOString(),
        expires_at: expiresAt.toISOString(),
      })
      .eq('id', subscriptionId);
  } else if (payment.status === 'rejected' || payment.status === 'cancelled') {
    await admin
      .from('subscriptions')
      .update({ status: 'cancelled', mp_payment_id: String(payment.id), mp_status: payment.status })
      .eq('id', subscriptionId);
  } else {
    await admin
      .from('subscriptions')
      .update({ mp_payment_id: String(payment.id), mp_status: payment.status })
      .eq('id', subscriptionId);
  }

  return new Response('ok', { status: 200 });
});
