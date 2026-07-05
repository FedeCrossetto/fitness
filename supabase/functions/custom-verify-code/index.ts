// Edge Function: custom-verify-code
// Verifica el código de 6 dígitos (de custom-send-verification-code). No toca
// auth.users ni crea sesión — la app hace signIn(email, password) después de
// un `ok:true` acá (ver authStore.verifyEmailOtp).
//
// Body: { email: string, code: string }
// Máximo 5 intentos por código antes de exigir uno nuevo.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { sha256Hex } from '../_shared/resend.ts';

const MAX_ATTEMPTS = 5;

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método no permitido' }), { status: 405 });
  }

  const { email, code } = (await req.json().catch(() => ({}))) as { email?: string; code?: string };
  if (!email?.trim() || !code?.trim()) {
    return new Response(JSON.stringify({ error: 'Faltan datos' }), { status: 400 });
  }
  const normalizedEmail = email.trim().toLowerCase();

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { data: row, error: lookupError } = await admin
    .from('email_verification_codes')
    .select('id, code_hash, attempts, expires_at, used_at')
    .eq('email', normalizedEmail)
    .is('used_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lookupError || !row) {
    return new Response(JSON.stringify({ error: 'Pedí un código nuevo.' }), { status: 400 });
  }
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return new Response(JSON.stringify({ error: 'El código venció. Pedí uno nuevo.' }), { status: 400 });
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    return new Response(JSON.stringify({ error: 'Demasiados intentos. Pedí un código nuevo.' }), { status: 429 });
  }

  const codeHash = await sha256Hex(code.trim());
  if (codeHash !== row.code_hash) {
    await admin.from('email_verification_codes').update({ attempts: row.attempts + 1 }).eq('id', row.id);
    return new Response(JSON.stringify({ error: 'Código incorrecto' }), { status: 400 });
  }

  await admin.from('email_verification_codes').update({ used_at: new Date().toISOString() }).eq('id', row.id);

  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
});
