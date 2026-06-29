// Edge Function: mp-create-preference
// Crea una preferencia de Checkout Pro de Mercado Pago para el plan elegido y
// registra la suscripción en estado 'pending'. Requiere usuario autenticado.
//
// Secrets requeridos (supabase secrets set):
//   MP_ACCESS_TOKEN  — access token de Mercado Pago (NUNCA en el cliente)
//   APP_BASE_URL     — URL base para back_urls (ej: https://resetfit.app)

import { createClient } from 'jsr:@supabase/supabase-js@2';

/**
 * back_url para MP. Si el cliente envía `return_url` (deep link de la app, p. ej.
 * `exp://…/--/pago` en Expo Go o `reset-fitness://pago` en build standalone), lo
 * adjunta como query param para que la página /pago/* redirija al lugar correcto.
 */
function buildBackUrl(appBaseUrl: string, result: string, returnUrl?: string): string {
  const base = `${appBaseUrl}/pago/${result}`;
  return returnUrl ? `${base}?return=${encodeURIComponent(returnUrl)}` : base;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método no permitido' }), { status: 405 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  // Token de plataforma OPCIONAL: solo se usa como fallback para alumnos sin
  // entrenador. En el modelo "cada entrenador cobra lo suyo" no hace falta.
  const mpToken = Deno.env.get('MP_ACCESS_TOKEN') ?? '';
  const appBaseUrl = Deno.env.get('APP_BASE_URL') ?? 'https://resetfit.app';
  const mpClientId = Deno.env.get('MP_CLIENT_ID');
  const mpClientSecret = Deno.env.get('MP_CLIENT_SECRET');
  // Comisión de la plataforma (%). 0 = el entrenador recibe el 100%.
  const platformFeePct = Number(Deno.env.get('MP_PLATFORM_FEE_PCT') ?? '0');

  // Autenticación del usuario que invoca
  const authHeader = req.headers.get('Authorization') ?? '';
  const supabaseAuth = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await supabaseAuth.auth.getUser();
  if (userError || !userData.user) {
    return new Response(JSON.stringify({ error: 'No autenticado' }), { status: 401 });
  }
  const userId = userData.user.id;

  const { plan_id, return_url } = (await req.json()) as { plan_id?: string; return_url?: string };
  if (!plan_id) {
    return new Response(JSON.stringify({ error: 'plan_id requerido' }), { status: 400 });
  }

  const admin = createClient(supabaseUrl, serviceKey);

  const { data: plan, error: planError } = await admin
    .from('plans')
    .select('*')
    .eq('id', plan_id)
    .eq('active', true)
    .single();
  if (planError || !plan) {
    return new Response(JSON.stringify({ error: 'Plan inválido' }), { status: 400 });
  }

  const { data: profile } = await admin
    .from('profiles')
    .select('trainer_id')
    .eq('id', userId)
    .maybeSingle();

  let unitPrice = Number(plan.price_ars);
  let sellerToken = mpToken; // fallback: token de la plataforma
  let trainerIdForHook = '';

  if (profile?.trainer_id) {
    const { data: override } = await admin
      .from('trainer_plan_prices')
      .select('price_ars')
      .eq('trainer_id', profile.trainer_id)
      .eq('plan_id', plan_id)
      .maybeSingle();
    if (override?.price_ars) unitPrice = Number(override.price_ars);

    // Cobro directo al entrenador: usamos SU access token de MercadoPago.
    const { data: mpAccount } = await admin
      .from('trainer_mp_accounts')
      .select('access_token, refresh_token, token_expires_at')
      .eq('trainer_id', profile.trainer_id)
      .eq('active', true)
      .maybeSingle();

    if (!mpAccount?.access_token) {
      return new Response(
        JSON.stringify({ error: 'trainer_payments_not_configured' }),
        { status: 409, headers: { 'Content-Type': 'application/json' } },
      );
    }

    sellerToken = mpAccount.access_token;
    trainerIdForHook = profile.trainer_id;

    // Refrescar el token si está vencido o por vencer (buffer 1 día).
    const expMs = mpAccount.token_expires_at ? new Date(mpAccount.token_expires_at).getTime() : 0;
    const needsRefresh = expMs > 0 && expMs - Date.now() < 24 * 60 * 60 * 1000;
    if (needsRefresh && mpAccount.refresh_token && mpClientId && mpClientSecret) {
      const refreshResp = await fetch('https://api.mercadopago.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: mpClientId,
          client_secret: mpClientSecret,
          grant_type: 'refresh_token',
          refresh_token: mpAccount.refresh_token,
        }),
      });
      if (refreshResp.ok) {
        const r = (await refreshResp.json()) as {
          access_token: string; refresh_token?: string; expires_in?: number;
        };
        sellerToken = r.access_token;
        await admin
          .from('trainer_mp_accounts')
          .update({
            access_token: r.access_token,
            refresh_token: r.refresh_token ?? mpAccount.refresh_token,
            token_expires_at: r.expires_in
              ? new Date(Date.now() + r.expires_in * 1000).toISOString()
              : null,
            updated_at: new Date().toISOString(),
          })
          .eq('trainer_id', profile.trainer_id);
      }
    }
  }

  // Suscripción pendiente
  const { data: subscription, error: subError } = await admin
    .from('subscriptions')
    .insert({ user_id: userId, plan_id, status: 'pending' })
    .select()
    .single();
  if (subError || !subscription) {
    return new Response(JSON.stringify({ error: 'No se pudo crear la suscripción' }), { status: 500 });
  }

  if (!sellerToken) {
    return new Response(
      JSON.stringify({ error: 'trainer_payments_not_configured' }),
      { status: 409, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // Comisión de la plataforma (solo aplica con cobro vía cuenta del entrenador).
  const marketplaceFee =
    trainerIdForHook && platformFeePct > 0
      ? Math.round((unitPrice * platformFeePct) / 100)
      : 0;

  // Preferencia de Mercado Pago
  const preferenceBody: Record<string, unknown> = {
    ...(marketplaceFee > 0 ? { marketplace_fee: marketplaceFee } : {}),
    items: [
      {
        id: plan.id,
        title: `Reset Fit — ${plan.name}`,
        description: plan.description ?? '',
        quantity: 1,
        currency_id: 'ARS',
        unit_price: unitPrice,
      },
    ],
    external_reference: subscription.id,
    metadata: { subscription_id: subscription.id, user_id: userId, plan_id },
    back_urls: {
      success: buildBackUrl(appBaseUrl, 'exito', return_url),
      failure: buildBackUrl(appBaseUrl, 'error', return_url),
      pending: buildBackUrl(appBaseUrl, 'pendiente', return_url),
    },
    auto_return: 'approved',
    // El webhook necesita saber a qué entrenador (token) consultar el pago.
    notification_url: trainerIdForHook
      ? `${supabaseUrl}/functions/v1/mp-webhook?trainer=${trainerIdForHook}`
      : `${supabaseUrl}/functions/v1/mp-webhook`,
  };

  const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${sellerToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(preferenceBody),
  });

  if (!mpResponse.ok) {
    const detail = await mpResponse.text();
    console.error('Error de Mercado Pago:', detail);
    return new Response(JSON.stringify({ error: 'Error creando preferencia de pago' }), { status: 502 });
  }

  const preference = (await mpResponse.json()) as { id: string; init_point: string };

  await admin
    .from('subscriptions')
    .update({ mp_preference_id: preference.id })
    .eq('id', subscription.id);

  return new Response(
    JSON.stringify({ init_point: preference.init_point, subscription_id: subscription.id }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
