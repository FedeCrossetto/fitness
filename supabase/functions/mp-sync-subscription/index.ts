// Edge Function: mp-sync-subscription
// Activación PULL (no push): la app, al volver del checkout, llama a esta
// función con el subscription_id. Acá consultamos ACTIVAMENTE el preapproval
// contra MercadoPago con el token del vendedor y, si está `authorized`,
// activamos la suscripción — sin depender de que MP nos empuje el webhook
// `subscription_preapproval` (que llega tarde o no llega).
//
// El webhook `mp-webhook` sigue siendo el responsable de los cobros mensuales
// posteriores; esta función solo resuelve la activación inicial de forma
// determinística.
//
// Requiere usuario autenticado (valida que la suscripción sea suya).

import { createClient } from 'jsr:@supabase/supabase-js@2';

/** Misma ventana de gracia que usa mp-webhook al autorizar/cobrar. */
const RECURRING_GRACE_DAYS = 35;

type SupabaseAdmin = ReturnType<typeof createClient>;

/** Resuelve el access token del vendedor (entrenador o plataforma) para
 * consultar el preapproval — mismo criterio que mp-create-preapproval. */
async function resolveSellerToken(
  admin: SupabaseAdmin,
  trainerId: string | null,
  platformToken: string,
): Promise<string> {
  if (!trainerId) return platformToken;
  const { data: acc } = await admin
    .from('trainer_mp_accounts')
    .select('access_token')
    .eq('trainer_id', trainerId)
    .eq('active', true)
    .maybeSingle();
  return (acc as { access_token?: string } | null)?.access_token ?? platformToken;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método no permitido' }), { status: 405 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const platformToken = Deno.env.get('MP_ACCESS_TOKEN') ?? '';

  const authHeader = req.headers.get('Authorization') ?? '';
  const supabaseAuth = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await supabaseAuth.auth.getUser();
  if (userError || !userData.user) {
    return new Response(JSON.stringify({ error: 'No autenticado' }), { status: 401 });
  }
  const userId = userData.user.id;

  const { subscription_id } = (await req.json().catch(() => ({}))) as { subscription_id?: string };

  const admin = createClient(supabaseUrl, serviceKey);

  // La suscripción a sincronizar: la indicada, o la más reciente del usuario
  // (fallback para cuando la app se reabrió y perdió el id en memoria).
  const query = admin
    .from('subscriptions')
    .select('id, user_id, status, mp_preapproval_id, plan_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1);
  const { data: sub } = subscription_id
    ? await admin
        .from('subscriptions')
        .select('id, user_id, status, mp_preapproval_id, plan_id')
        .eq('id', subscription_id)
        .maybeSingle()
    : await query.maybeSingle();

  const subscription = sub as
    | { id: string; user_id: string; status: string | null; mp_preapproval_id: string | null; plan_id: string }
    | null;

  if (!subscription || subscription.user_id !== userId) {
    return new Response(JSON.stringify({ error: 'Suscripción no encontrada' }), { status: 404 });
  }

  if (subscription.status === 'active') {
    return new Response(JSON.stringify({ status: 'active' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!subscription.mp_preapproval_id) {
    return new Response(JSON.stringify({ status: subscription.status, mp_status: null }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Token del vendedor (entrenador dueño del precio, o plataforma).
  const { data: profile } = await admin
    .from('profiles')
    .select('trainer_id')
    .eq('id', userId)
    .maybeSingle();
  const trainerId = (profile as { trainer_id?: string | null } | null)?.trainer_id ?? null;
  const sellerToken = await resolveSellerToken(admin, trainerId, platformToken);

  if (!sellerToken) {
    console.error('[mp-sync] sin token para consultar preapproval', subscription.mp_preapproval_id);
    return new Response(JSON.stringify({ status: subscription.status, mp_status: null, error: 'no_token' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const resp = await fetch(`https://api.mercadopago.com/preapproval/${subscription.mp_preapproval_id}`, {
    headers: { Authorization: `Bearer ${sellerToken}` },
  });
  if (!resp.ok) {
    const detail = await resp.text();
    console.error('[mp-sync] error consultando preapproval', subscription.mp_preapproval_id, resp.status, detail);
    return new Response(JSON.stringify({ status: subscription.status, mp_status: null, error: 'mp_query_failed' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const preapproval = (await resp.json()) as { id: string; status: string };

  if (preapproval.status === 'authorized') {
    const startedAt = new Date();
    const expiresAt = new Date(startedAt.getTime() + RECURRING_GRACE_DAYS * 24 * 60 * 60 * 1000);
    await admin
      .from('subscriptions')
      .update({
        status: 'active',
        mp_status: preapproval.status,
        started_at: startedAt.toISOString(),
        expires_at: expiresAt.toISOString(),
      })
      .eq('id', subscription.id);
    await admin.from('profiles').update({ client_status: 'active' }).eq('id', userId);
    return new Response(JSON.stringify({ status: 'active', mp_status: preapproval.status }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Reflejamos el estado de MP aunque no active (cancelled/paused/pending),
  // sin pisar el status local con algo inválido.
  await admin.from('subscriptions').update({ mp_status: preapproval.status }).eq('id', subscription.id);
  return new Response(JSON.stringify({ status: subscription.status, mp_status: preapproval.status }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
