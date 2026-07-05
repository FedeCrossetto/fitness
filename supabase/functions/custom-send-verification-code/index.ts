// Edge Function: custom-send-verification-code
// Genera y manda por Resend el código de 6 dígitos para confirmar el mail al
// crear cuenta — reemplaza supabase.auth.resend({type:'signup'}) por el mismo
// motivo que el reset de contraseña (Custom SMTP pide plan Pro acá).
//
// No necesita tocar auth.users en absoluto: el código solo se asocia al email,
// y la app hace signIn() normal después de verificar (ver custom-verify-code).
//
// Body: { email: string }
// Cooldown de 45s por email para evitar spam de reenvíos.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { randomDigitCode, sendResendEmail, sha256Hex } from '../_shared/resend.ts';

const CODE_LENGTH = 6;
const CODE_TTL_MS = 10 * 60_000; // 10 min
const RESEND_COOLDOWN_MS = 45_000;

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método no permitido' }), { status: 405 });
  }

  const { email } = (await req.json().catch(() => ({}))) as { email?: string };
  if (!email?.trim()) {
    return new Response(JSON.stringify({ error: 'email requerido' }), { status: 400 });
  }
  const normalizedEmail = email.trim().toLowerCase();

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { data: recent } = await admin
    .from('email_verification_codes')
    .select('created_at')
    .eq('email', normalizedEmail)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recent && Date.now() - new Date(recent.created_at).getTime() < RESEND_COOLDOWN_MS) {
    // Ya se mandó uno hace poco — devolvemos ok igual (la UI ya tiene su propio
    // cooldown de 45s, esto es solo defensa contra llamadas directas al endpoint).
    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
  }

  const code = randomDigitCode(CODE_LENGTH);
  const codeHash = await sha256Hex(code);
  const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString();

  const { error: insertError } = await admin.from('email_verification_codes').insert({
    email: normalizedEmail,
    code_hash: codeHash,
    expires_at: expiresAt,
  });
  if (insertError) {
    console.error('[custom-send-verification-code] insert failed:', insertError.message);
    return new Response(JSON.stringify({ error: 'No pudimos generar el código' }), { status: 500 });
  }

  const { ok, error: sendError } = await sendResendEmail({
    to: normalizedEmail,
    subject: `${code} — Tu código de verificación R3SET`,
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; text-align:center;">
        <h2 style="color:#111;">Confirmá tu cuenta</h2>
        <p style="color:#444; line-height:1.5;">Ingresá este código en la app para activar tu cuenta:</p>
        <p style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color:#111; margin: 24px 0;">${code}</p>
        <p style="color:#888; font-size:13px;">Vence en 10 minutos. Si no creaste una cuenta en R3SET, ignorá este mail.</p>
      </div>
    `,
  });
  if (!ok) {
    console.error('[custom-send-verification-code] resend failed:', sendError);
    return new Response(JSON.stringify({ error: 'No pudimos enviar el mail' }), { status: 502 });
  }

  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
});
