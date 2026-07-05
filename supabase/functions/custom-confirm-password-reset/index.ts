// Edge Function: custom-confirm-password-reset
// Verifica el token (de custom-request-password-reset) y actualiza la
// contraseña vía Admin API — sin sesión de Supabase involucrada en ningún
// momento del flujo.
//
// Body: { email: string, token: string, new_password: string }

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { sha256Hex } from '../_shared/resend.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método no permitido' }), { status: 405 });
  }

  const { email, token, new_password } = (await req.json().catch(() => ({}))) as {
    email?: string;
    token?: string;
    new_password?: string;
  };
  if (!email?.trim() || !token?.trim() || !new_password) {
    return new Response(JSON.stringify({ error: 'Faltan datos' }), { status: 400 });
  }
  if (new_password.length < 8) {
    return new Response(JSON.stringify({ error: 'La contraseña debe tener al menos 8 caracteres' }), { status: 400 });
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const normalizedEmail = email.trim().toLowerCase();
  const tokenHash = await sha256Hex(token.trim());

  const { data: row, error: lookupError } = await admin
    .from('password_reset_tokens')
    .select('id, user_id, expires_at, used_at')
    .eq('email', normalizedEmail)
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (lookupError || !row) {
    return new Response(JSON.stringify({ error: 'Link inválido o vencido' }), { status: 400 });
  }
  if (row.used_at) {
    return new Response(JSON.stringify({ error: 'Este link ya fue usado' }), { status: 400 });
  }
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return new Response(JSON.stringify({ error: 'Este link venció. Pedí uno nuevo.' }), { status: 400 });
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(row.user_id, { password: new_password });
  if (updateError) {
    console.error('[custom-confirm-password-reset] updateUserById failed:', updateError.message);
    return new Response(JSON.stringify({ error: 'No pudimos actualizar la contraseña' }), { status: 500 });
  }

  await admin.from('password_reset_tokens').update({ used_at: new Date().toISOString() }).eq('id', row.id);

  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
});
