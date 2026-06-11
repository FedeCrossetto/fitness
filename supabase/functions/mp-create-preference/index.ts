// Edge Function: mp-create-preference
// Crea una preferencia de Checkout Pro de Mercado Pago para el plan elegido y
// registra la suscripción en estado 'pending'. Requiere usuario autenticado.
//
// Secrets requeridos (supabase secrets set):
//   MP_ACCESS_TOKEN  — access token de Mercado Pago (NUNCA en el cliente)
//   APP_BASE_URL     — URL base para back_urls (ej: https://habito.app)

import { createClient } from 'jsr:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método no permitido' }), { status: 405 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const mpToken = Deno.env.get('MP_ACCESS_TOKEN');
  const appBaseUrl = Deno.env.get('APP_BASE_URL') ?? 'https://habito.app';

  if (!mpToken) {
    return new Response(JSON.stringify({ error: 'MP_ACCESS_TOKEN no configurado' }), { status: 500 });
  }

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

  const { plan_id } = (await req.json()) as { plan_id?: string };
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

  // Suscripción pendiente
  const { data: subscription, error: subError } = await admin
    .from('subscriptions')
    .insert({ user_id: userId, plan_id, status: 'pending' })
    .select()
    .single();
  if (subError || !subscription) {
    return new Response(JSON.stringify({ error: 'No se pudo crear la suscripción' }), { status: 500 });
  }

  // Preferencia de Mercado Pago
  const preferenceBody = {
    items: [
      {
        id: plan.id,
        title: `Habito — ${plan.name}`,
        description: plan.description ?? '',
        quantity: 1,
        currency_id: 'ARS',
        unit_price: Number(plan.price_ars),
      },
    ],
    external_reference: subscription.id,
    metadata: { subscription_id: subscription.id, user_id: userId, plan_id },
    back_urls: {
      success: `${appBaseUrl}/pago/exito`,
      failure: `${appBaseUrl}/pago/error`,
      pending: `${appBaseUrl}/pago/pendiente`,
    },
    auto_return: 'approved',
  };

  const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${mpToken}`,
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
