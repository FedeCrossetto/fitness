// Edge Function: mp-oauth-callback
// MercadoPago redirige acá tras autorizar. Intercambia el `code` por los tokens
// del entrenador (access_token + refresh_token) y los guarda en
// trainer_mp_accounts. Luego redirige al panel web.
//
// Debe deployarse con verify_jwt = false (lo invoca el navegador, sin JWT).
//
// Secrets:
//   MP_CLIENT_ID, MP_CLIENT_SECRET, APP_BASE_URL
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const MP_CLIENT_ID = Deno.env.get('MP_CLIENT_ID');
const MP_CLIENT_SECRET = Deno.env.get('MP_CLIENT_SECRET');
const APP_BASE_URL = Deno.env.get('APP_BASE_URL') ?? '';

function redirectTo(result: 'connected' | 'error'): Response {
  const url = `${APP_BASE_URL}/payments?mp=${result}`;
  return new Response(null, { status: 302, headers: { Location: url } });
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (!code || !state || !MP_CLIENT_ID || !MP_CLIENT_SECRET) {
    return redirectTo('error');
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  // Validar y consumir el state (un solo uso).
  const { data: stateRow } = await admin
    .from('mp_oauth_states')
    .select('trainer_id, created_at')
    .eq('state', state)
    .maybeSingle();
  await admin.from('mp_oauth_states').delete().eq('state', state);

  if (!stateRow) return redirectTo('error');
  // Expira a los 15 minutos.
  if (Date.now() - new Date(stateRow.created_at).getTime() > 15 * 60 * 1000) {
    return redirectTo('error');
  }

  // Intercambiar el code por tokens.
  const redirectUri = `${SUPABASE_URL}/functions/v1/mp-oauth-callback`;
  const tokenResp = await fetch('https://api.mercadopago.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: MP_CLIENT_ID,
      client_secret: MP_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenResp.ok) {
    console.error('MP oauth/token error:', await tokenResp.text());
    return redirectTo('error');
  }

  const tok = (await tokenResp.json()) as {
    access_token: string;
    refresh_token?: string;
    user_id?: number | string;
    public_key?: string;
    expires_in?: number;
    scope?: string;
  };

  const expiresAt = tok.expires_in
    ? new Date(Date.now() + tok.expires_in * 1000).toISOString()
    : null;

  const { error: upsertError } = await admin.from('trainer_mp_accounts').upsert(
    {
      trainer_id: stateRow.trainer_id,
      access_token: tok.access_token,
      refresh_token: tok.refresh_token ?? null,
      mp_user_id: tok.user_id != null ? String(tok.user_id) : null,
      public_key: tok.public_key ?? null,
      token_expires_at: expiresAt,
      scope: tok.scope ?? null,
      active: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'trainer_id' },
  );

  if (upsertError) {
    console.error('Error guardando cuenta MP:', upsertError.message);
    return redirectTo('error');
  }

  return redirectTo('connected');
});
