// Edge Function: mp-oauth-start
// Genera la URL de autorización de MercadoPago (OAuth) para que el ENTRENADOR
// conecte su cuenta. Crea un `state` de un solo uso (anti-CSRF) y devuelve la URL.
// Requiere usuario autenticado (el entrenador).
//
// Secrets:
//   MP_CLIENT_ID  — App ID / client_id de tu aplicación de MercadoPago
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const MP_CLIENT_ID = Deno.env.get('MP_CLIENT_ID');

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method' }), { status: 405, headers: cors });
  }
  if (!MP_CLIENT_ID) {
    return new Response(JSON.stringify({ error: 'MP_CLIENT_ID no configurado' }), { status: 500, headers: cors });
  }

  // Autenticación del entrenador que pide conectar.
  const authHeader = req.headers.get('Authorization') ?? '';
  const authed = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data: userData, error: userError } = await authed.auth.getUser();
  if (userError || !userData.user) {
    return new Response(JSON.stringify({ error: 'no_auth' }), { status: 401, headers: cors });
  }
  const trainerId = userData.user.id;

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const state = crypto.randomUUID();
  const { error: stateError } = await admin
    .from('mp_oauth_states')
    .insert({ state, trainer_id: trainerId });
  if (stateError) {
    return new Response(JSON.stringify({ error: 'state' }), { status: 500, headers: cors });
  }

  const redirectUri = `${SUPABASE_URL}/functions/v1/mp-oauth-callback`;
  const authUrl =
    `https://auth.mercadopago.com.ar/authorization?client_id=${MP_CLIENT_ID}` +
    `&response_type=code&platform_id=mp&state=${state}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}`;

  return new Response(JSON.stringify({ authUrl }), {
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
});
