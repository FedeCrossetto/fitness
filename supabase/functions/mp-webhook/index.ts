// Edge Function: mp-webhook
// Recibe notificaciones de Mercado Pago y activa/expira suscripciones.
// Configurar en MP la URL: https://<proyecto>.supabase.co/functions/v1/mp-webhook
// Desplegar con --no-verify-jwt (MP no envía JWT de Supabase).
//
// Maneja 3 tipos de notificación:
//   - `payment`                       — pago único (Preferencias), flujo legacy.
//   - `subscription_preapproval`      — cambios de estado de una suscripción
//                                        recurrente (autorizada/pausada/cancelada).
//   - `subscription_authorized_payment` — cada cobro mensual individual de una
//                                        suscripción recurrente ya autorizada.
//
// Secrets requeridos: MP_ACCESS_TOKEN
// Secret recomendado: MP_WEBHOOK_SECRET — clave secreta del webhook (Dashboard de MP
//   → Webhooks). Si está configurada, se valida la firma x-signature de cada
//   notificación; sin ella, la función procesa igual pero loguea una advertencia.

import { createClient } from 'jsr:@supabase/supabase-js@2';

type SupabaseAdmin = ReturnType<typeof createClient>;

interface MpPayment {
  id: number;
  status: string;
  external_reference?: string;
  metadata?: { subscription_id?: string };
}

interface MpPreapproval {
  id: string;
  status: string; // 'pending' | 'authorized' | 'paused' | 'cancelled'
  external_reference?: string;
}

interface MpAuthorizedPayment {
  id: number;
  preapproval_id: string;
  status: string; // 'processed' | 'pending' | 'rejected' | 'cancelled' (a confirmar en sandbox)
  transaction_amount?: number;
}

/** Cuánto se extiende `expires_at` en cada cobro recurrente exitoso — ventana
 * de gracia sobre el ciclo mensual, para tolerar cobros que lleguen unos
 * días tarde sin cortar el acceso de golpe. */
const RECURRING_GRACE_DAYS = 35;

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

/** Resuelve el token de MP a usar para consultar el recurso: el del
 * entrenador (?trainer= en la notification_url) o el de la plataforma. */
async function resolveQueryToken(admin: SupabaseAdmin, trainerId: string | null, fallback: string): Promise<string> {
  if (!trainerId) return fallback;
  const { data: mpAccount } = await admin
    .from('trainer_mp_accounts')
    .select('access_token')
    .eq('trainer_id', trainerId)
    .eq('active', true)
    .maybeSingle();
  return (mpAccount as { access_token?: string } | null)?.access_token ?? fallback;
}

/** Flujo legacy: pago único (Preferencias). */
async function handlePayment(admin: SupabaseAdmin, queryToken: string, paymentId: string): Promise<Response> {
  const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${queryToken}` },
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

    // Pago aprobado = activar el acceso del alumno (se integra con is_active_client()).
    if (subscription.user_id) {
      await admin
        .from('profiles')
        .update({ client_status: 'active' })
        .eq('id', subscription.user_id);
    }
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
}

/** Cambios de estado de una suscripción recurrente (autorizada/pausada/cancelada). */
async function handlePreapproval(admin: SupabaseAdmin, queryToken: string, preapprovalId: string): Promise<Response> {
  const resp = await fetch(`https://api.mercadopago.com/preapproval/${preapprovalId}`, {
    headers: { Authorization: `Bearer ${queryToken}` },
  });
  if (!resp.ok) {
    console.error('No se pudo consultar el preapproval', preapprovalId);
    return new Response('error consultando preapproval', { status: 200 });
  }
  const preapproval = (await resp.json()) as MpPreapproval;

  const subscriptionId = preapproval.external_reference;
  const { data: subscription } = subscriptionId
    ? await admin.from('subscriptions').select('id, user_id').eq('id', subscriptionId).maybeSingle()
    : await admin.from('subscriptions').select('id, user_id').eq('mp_preapproval_id', preapprovalId).maybeSingle();

  if (!subscription) {
    return new Response('suscripción no encontrada', { status: 200 });
  }

  if (preapproval.status === 'authorized') {
    const startedAt = new Date();
    const expiresAt = new Date(startedAt.getTime() + RECURRING_GRACE_DAYS * 24 * 60 * 60 * 1000);
    await admin
      .from('subscriptions')
      .update({
        status: 'active',
        mp_preapproval_id: preapproval.id,
        mp_status: preapproval.status,
        started_at: startedAt.toISOString(),
        expires_at: expiresAt.toISOString(),
      })
      .eq('id', subscription.id);

    if (subscription.user_id) {
      await admin.from('profiles').update({ client_status: 'active' }).eq('id', subscription.user_id);
    }
  } else if (preapproval.status === 'paused') {
    await admin
      .from('subscriptions')
      .update({ status: 'paused', mp_preapproval_id: preapproval.id, mp_status: preapproval.status })
      .eq('id', subscription.id);
  } else if (preapproval.status === 'cancelled') {
    await admin
      .from('subscriptions')
      .update({ status: 'cancelled', mp_preapproval_id: preapproval.id, mp_status: preapproval.status })
      .eq('id', subscription.id);
  } else {
    await admin
      .from('subscriptions')
      .update({ mp_preapproval_id: preapproval.id, mp_status: preapproval.status })
      .eq('id', subscription.id);
  }

  return new Response('ok', { status: 200 });
}

/** Cada cobro mensual individual de una suscripción ya autorizada. */
async function handleAuthorizedPayment(admin: SupabaseAdmin, queryToken: string, authorizedPaymentId: string): Promise<Response> {
  const resp = await fetch(`https://api.mercadopago.com/authorized_payments/${authorizedPaymentId}`, {
    headers: { Authorization: `Bearer ${queryToken}` },
  });
  if (!resp.ok) {
    console.error('No se pudo consultar el authorized_payment', authorizedPaymentId);
    return new Response('error consultando cobro', { status: 200 });
  }
  const charge = (await resp.json()) as MpAuthorizedPayment;

  const { data: subscription } = await admin
    .from('subscriptions')
    .select('id')
    .eq('mp_preapproval_id', charge.preapproval_id)
    .maybeSingle();

  if (!subscription) {
    return new Response('suscripción no encontrada para el preapproval', { status: 200 });
  }

  await admin.from('subscription_charges').insert({
    subscription_id: subscription.id,
    mp_payment_id: String(charge.id),
    amount_ars: charge.transaction_amount ?? null,
    status: charge.status,
    charged_at: new Date().toISOString(),
  });

  // Cobro exitoso: extendemos la ventana de acceso (gracia) y reactivamos si
  // había caído a 'expired' entre ciclos. Cobro fallido: solo queda
  // registrado — sin reintentos/dunning en esta primera versión, el acceso
  // se corta solo si no llega un próximo cobro exitoso a tiempo.
  if (charge.status === 'processed' || charge.status === 'approved') {
    const expiresAt = new Date(Date.now() + RECURRING_GRACE_DAYS * 24 * 60 * 60 * 1000);
    await admin
      .from('subscriptions')
      .update({ status: 'active', expires_at: expiresAt.toISOString(), mp_status: charge.status })
      .eq('id', subscription.id);
  }

  return new Response('ok', { status: 200 });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('ok', { status: 200 });
  }

  // Opcional: solo fallback para pagos sin entrenador. En el modelo por
  // entrenador se usa el token de cada uno (param ?trainer=).
  const mpToken = Deno.env.get('MP_ACCESS_TOKEN') ?? '';

  const url = new URL(req.url);
  const queryDataId = url.searchParams.get('data.id') ?? url.searchParams.get('id');
  // Si la preferencia/suscripción se creó con el token de un entrenador, viene este param.
  const trainerId = url.searchParams.get('trainer');

  let notificationType: string | undefined;
  let dataId: string | null = queryDataId;
  try {
    const body = (await req.json()) as { type?: string; action?: string; data?: { id?: string | number } };
    notificationType = body?.type;
    if (body?.data?.id) dataId = String(body.data.id);
  } catch {
    // body vacío: usamos query params (flujo legacy de `payment`)
  }

  // Validación de firma con el secret de la PLATAFORMA. Solo aplica a las
  // notificaciones de la plataforma: las de cada entrenador vienen firmadas
  // con el secret de SU cuenta, así que para esas la verificación real es
  // re-consultar el recurso con su token (no se puede falsificar un estado
  // aprobado/autorizado en la cuenta del entrenador).
  const webhookSecret = Deno.env.get('MP_WEBHOOK_SECRET');
  if (webhookSecret && !trainerId) {
    const valid = await isValidMpSignature(req, dataId, webhookSecret);
    if (!valid) {
      console.error('Firma de webhook MP inválida; notificación rechazada');
      return new Response('firma inválida', { status: 401 });
    }
  } else if (!webhookSecret && !trainerId) {
    console.warn('MP_WEBHOOK_SECRET no configurado: se omite validación de firma (no recomendado en producción)');
  }

  if (!dataId) {
    return new Response('sin data id', { status: 200 });
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const queryToken = await resolveQueryToken(admin, trainerId, mpToken);
  if (!queryToken) {
    console.error('Sin token para consultar el recurso (entrenador sin cuenta MP)');
    return new Response('sin token', { status: 200 });
  }

  // Sin `type` en el body (notificación vieja por query params) = pago único.
  if (!notificationType || notificationType === 'payment') {
    return handlePayment(admin, queryToken, dataId);
  }
  if (notificationType === 'subscription_preapproval') {
    return handlePreapproval(admin, queryToken, dataId);
  }
  if (notificationType === 'subscription_authorized_payment') {
    return handleAuthorizedPayment(admin, queryToken, dataId);
  }

  return new Response('ignorado', { status: 200 });
});
