// Edge Function: mp-cancel-subscription
// Cancela una suscripción recurrente de Mercado Pago (Preapproval). Usada por
// dos puntos de entrada: el alumno cancelando la propia (mobile) y el
// entrenador cancelando la de un alumno suyo (panel web).
//
// Secrets requeridos: MP_ACCESS_TOKEN (fallback), MP_CLIENT_ID/SECRET (no
// necesarios acá, solo lectura de token existente — no se refresca).

import { createClient } from 'jsr:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método no permitido' }), { status: 405 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const mpToken = Deno.env.get('MP_ACCESS_TOKEN') ?? '';

  const authHeader = req.headers.get('Authorization') ?? '';
  const supabaseAuth = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await supabaseAuth.auth.getUser();
  if (userError || !userData.user) {
    return new Response(JSON.stringify({ error: 'No autenticado' }), { status: 401 });
  }
  const callerId = userData.user.id;

  const { subscription_id } = (await req.json()) as { subscription_id?: string };
  if (!subscription_id) {
    return new Response(JSON.stringify({ error: 'subscription_id requerido' }), { status: 400 });
  }

  const admin = createClient(supabaseUrl, serviceKey);

  const { data: subscription, error: subError } = await admin
    .from('subscriptions')
    .select('id, user_id, status, mp_preapproval_id')
    .eq('id', subscription_id)
    .maybeSingle();
  if (subError || !subscription) {
    return new Response(JSON.stringify({ error: 'Suscripción no encontrada' }), { status: 404 });
  }

  const { data: callerProfile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', callerId)
    .maybeSingle();

  const { data: studentProfile } = await admin
    .from('profiles')
    .select('trainer_id')
    .eq('id', subscription.user_id)
    .maybeSingle();

  const isSelf = subscription.user_id === callerId;
  const isAdmin = callerProfile?.role === 'admin';
  const isOwnTrainer = callerProfile?.role === 'trainer' && studentProfile?.trainer_id === callerId;

  if (!isSelf && !isAdmin && !isOwnTrainer) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403 });
  }

  if (!subscription.mp_preapproval_id) {
    return new Response(
      JSON.stringify({ error: 'not_a_recurring_subscription' }),
      { status: 409, headers: { 'Content-Type': 'application/json' } },
    );
  }

  if (subscription.status === 'cancelled') {
    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
  }

  // El token para cancelar es el del entrenador del alumno (la suscripción
  // vive en SU cuenta de MercadoPago).
  let sellerToken = mpToken;
  if (studentProfile?.trainer_id) {
    const { data: mpAccount } = await admin
      .from('trainer_mp_accounts')
      .select('access_token')
      .eq('trainer_id', studentProfile.trainer_id)
      .eq('active', true)
      .maybeSingle();
    if (mpAccount?.access_token) sellerToken = mpAccount.access_token;
  }

  if (!sellerToken) {
    return new Response(JSON.stringify({ error: 'trainer_payments_not_configured' }), { status: 409 });
  }

  const mpResponse = await fetch(`https://api.mercadopago.com/preapproval/${subscription.mp_preapproval_id}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${sellerToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status: 'cancelled' }),
  });

  if (!mpResponse.ok) {
    const detail = await mpResponse.text();
    console.error('Error cancelando preapproval en Mercado Pago:', detail);
    return new Response(JSON.stringify({ error: 'No pudimos cancelar la suscripción en Mercado Pago' }), { status: 502 });
  }

  await admin
    .from('subscriptions')
    .update({ status: 'cancelled' })
    .eq('id', subscription.id);

  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
});
