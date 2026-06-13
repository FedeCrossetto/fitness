// Edge Function: mp-webhook
// Recibe notificaciones de pago de Mercado Pago y activa/expira suscripciones.
// Configurar en MP la URL: https://<proyecto>.supabase.co/functions/v1/mp-webhook
// Desplegar con --no-verify-jwt (MP no envía JWT de Supabase).
//
// Secrets requeridos: MP_ACCESS_TOKEN
// Secret recomendado: MP_WEBHOOK_SECRET — clave secreta del webhook (Dashboard de MP
//   → Webhooks). Si está configurada, se valida la firma x-signature de cada
//   notificación; sin ella, la función procesa igual pero loguea una advertencia.

import { createClient } from 'jsr:@supabase/supabase-js@2';

interface MpPayment {
  id: number;
  status: string;
  external_reference?: string;
  metadata?: { subscription_id?: string };
}

/** Comparación en tiempo constante para evitar timing attacks. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

/**
 * Valida la firma x-signature de Mercado Pago según el algoritmo oficial:
 * manifest = `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`
 * v1 = HMAC_SHA256(manifest, secret) en hex.
 */
async function isValidMpSignature(
  req: Request,
  dataId: string | null,
  secret: string
): Promise<boolean> {
  const xSignature = req.headers.get('x-signature');
  const xRequestId = req.headers.get('x-request-id');
  if (!xSignature || !xRequestId || !dataId) return false;

  const parts: Record<string, string> = {};
  for (const kv of xSignature.split(',')) {
    const idx = kv.indexOf('=');
    if (idx === -1) continue;
    parts[kv.slice(0, idx).trim()] = kv.slice(idx + 1).trim();
  }
  const ts = parts['ts'];
  const v1 = parts['v1'];
  if (!ts || !v1) return false;

  const manifest = `id:${dataId.toLowerCase()};request-id:${xRequestId};ts:${ts};`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(manifest));
  const computed = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return timingSafeEqual(computed, v1);
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
  const queryDataId = url.searchParams.get('data.id') ?? url.searchParams.get('id');

  // Validación de firma: el manifest usa el data.id del query string.
  const webhookSecret = Deno.env.get('MP_WEBHOOK_SECRET');
  if (webhookSecret) {
    const valid = await isValidMpSignature(req, queryDataId, webhookSecret);
    if (!valid) {
      console.error('Firma de webhook MP inválida; notificación rechazada');
      return new Response('firma inválida', { status: 401 });
    }
  } else {
    console.warn('MP_WEBHOOK_SECRET no configurado: se omite validación de firma (no recomendado en producción)');
  }

  let paymentId: string | null = queryDataId;

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
