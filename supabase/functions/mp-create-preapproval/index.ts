// Edge Function: mp-create-preapproval
// Crea una Suscripción (Preapproval) recurrente de Mercado Pago para el plan
// elegido y registra la suscripción en estado 'pending'. Requiere usuario
// autenticado. Hermana de mp-create-preference (pago único) — a diferencia
// de esa, acá se cobra la tarifa MENSUAL de la frecuencia elegida, todos los
// meses, en vez del total de una sola vez.
//
// Secrets requeridos (supabase secrets set):
//   MP_ACCESS_TOKEN  — access token de Mercado Pago (NUNCA en el cliente)
//   APP_BASE_URL     — URL base para back_url (ej: https://resetfit.app)

import { createClient } from 'jsr:@supabase/supabase-js@2';

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

  // `return_url` (deep link de la app) ya no viaja en `back_url`: a
  // diferencia de Preferencias, la API de Suscripciones (Preapproval) de MP
  // rechaza con invalid_field_content un `back_url` que trae un esquema
  // custom (ej. `exp://…`) codificado en el query string. Lo guardamos en la
  // fila de la suscripción y el back_url solo lleva el id (uuid limpio) —
  // la página /pago/:result lo resuelve vía get_subscription_return_url.
  const { plan_id, return_url } = (await req.json()) as { plan_id?: string; return_url?: string };
  if (!plan_id) {
    return new Response(JSON.stringify({ error: 'plan_id requerido' }), { status: 400 });
  }

  const admin = createClient(supabaseUrl, serviceKey);

  // Suscripciones existentes del usuario — usado abajo para el guard
  // anti-doble-suscripción (evita crear un segundo preapproval si ya hay uno activo).
  const { data: existingSubs } = await admin
    .from('subscriptions')
    .select('id, status, mp_status, mp_preapproval_id, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(5);

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

  if (!sellerToken) {
    return new Response(
      JSON.stringify({ error: 'trainer_payments_not_configured' }),
      { status: 409, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // La frecuencia elegida (ej. "8 meses") ya no es lo que se cobra de una
  // sola vez — fija la tarifa MENSUAL con descuento que MP va a cobrar todos
  // los meses hasta que se cancele.
  const months = Math.max(1, Math.round(Number(plan.duration_days) / 30));
  let monthlyRate = Math.round(unitPrice / months);

  // TEMPORAL: mientras se sigue probando el flujo de pago recurrente, el
  // plan mensual cobra $15 reales en la pasarela (mínimo de MP para
  // suscripciones) aunque el front muestre el precio de lista. Sacar esta
  // línea cuando se cierre la etapa de pruebas con montos bajos.
  if (plan.id === 'monthly') monthlyRate = 15;

  // Guard anti-doble-suscripción: si el alumno YA tiene una suscripción activa,
  // no creamos otro preapproval (era la raíz de los cobros duplicados). La app,
  // al recibir `already_active`, muestra "tu plan ya está activo" y avanza.
  const activeSub = (existingSubs as { id: string; status: string | null }[] | null)?.find(
    (s) => s.status === 'active',
  );
  if (activeSub) {
    return new Response(
      JSON.stringify({ already_active: true, subscription_id: activeSub.id }),
      { headers: { 'Content-Type': 'application/json' } },
    );
  }

  const { data: authUser, error: authUserError } = await admin.auth.admin.getUserById(userId);
  const payerEmail = authUser?.user?.email;
  if (authUserError || !payerEmail) {
    return new Response(JSON.stringify({ error: 'No pudimos obtener el email del alumno' }), { status: 500 });
  }

  // Suscripción pendiente (misma fila que usa el flujo de pago único —
  // `mp_preapproval_id` distingue el modelo recurrente de `mp_payment_id`,
  // que es por cobro individual).
  const { data: subscription, error: subError } = await admin
    .from('subscriptions')
    .insert({ user_id: userId, plan_id, status: 'pending', client_return_url: return_url ?? null })
    .select()
    .single();
  if (subError || !subscription) {
    return new Response(JSON.stringify({ error: 'No se pudo crear la suscripción' }), { status: 500 });
  }

  const preapprovalBody = {
    // Sin em dash ("—"): la API de Preapproval de MP rechaza ese carácter en
    // `reason` con invalid_field_content (a diferencia de Preferencias, que
    // sí lo acepta en `title`).
    reason: `Reset Fit - ${plan.name}`,
    external_reference: subscription.id,
    payer_email: payerEmail,
    back_url: `${appBaseUrl}/pago/exito?sub=${subscription.id}`,
    status: 'pending',
    auto_recurring: {
      frequency: 1,
      frequency_type: 'months',
      transaction_amount: monthlyRate,
      currency_id: 'ARS',
    },
    // El webhook necesita saber a qué entrenador (token) consultar la suscripción.
    notification_url: trainerIdForHook
      ? `${supabaseUrl}/functions/v1/mp-webhook?trainer=${trainerIdForHook}`
      : `${supabaseUrl}/functions/v1/mp-webhook`,
  };

  const mpResponse = await fetch('https://api.mercadopago.com/preapproval', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${sellerToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(preapprovalBody),
  });

  if (!mpResponse.ok) {
    const detail = await mpResponse.text();
    console.error('Error de Mercado Pago (preapproval):', detail);
    return new Response(
      JSON.stringify({ error: 'Error creando la suscripción de pago', detail }),
      { status: 502, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const preapproval = (await mpResponse.json()) as { id: string; init_point: string };

  await admin
    .from('subscriptions')
    .update({ mp_preapproval_id: preapproval.id })
    .eq('id', subscription.id);

  return new Response(
    JSON.stringify({ init_point: preapproval.init_point, subscription_id: subscription.id }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
