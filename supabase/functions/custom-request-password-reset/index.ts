// Edge Function: custom-request-password-reset
// Reemplaza a supabase.auth.resetPasswordForEmail() — Custom SMTP pide plan Pro
// en este proyecto, así que el mail lo mandamos nosotros vía Resend.
//
// Body: { email: string, deep_link?: string }
//   deep_link — el `exp://ip:puerto/--/auth/callback` (o `reset-fitness://...`
//   en build standalone) de ESTA sesión de Metro/dispositivo, calculado por la
//   app en el momento (ver getPasswordResetRedirectUri). Sin esto, una página
//   web estática no puede reabrir Expo Go — su IP/puerto cambian en cada sesión.
//
// Siempre responde `{ok:true}` exista o no la cuenta (evita filtrar qué mails
// están registrados) — EXCEPTO cuando la cuenta existe pero fue creada por
// Google/Apple (sin identity "email"): ahí no tiene sentido mandar un mail
// con link de reset porque no hay contraseña que cambiar, así que devolvemos
// `{ok:true, oauth_provider:"google"|"apple"}` para que la app se lo diga al
// usuario en vez de simular un envío que nunca va a llegar. Esto sí revela
// que ese email tiene cuenta OAuth — trade-off aceptado a propósito acá
// (app chica, un solo entrenador) a cambio de no confundir al usuario.
//
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY,
//   RESEND_FROM_EMAIL, APP_BASE_URL

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { sendResendEmail, sha256Hex } from '../_shared/resend.ts';

const TOKEN_TTL_MS = 30 * 60_000; // 30 min

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método no permitido' }), { status: 405 });
  }

  const { email, deep_link } = (await req.json().catch(() => ({}))) as { email?: string; deep_link?: string };
  if (!email?.trim()) {
    return new Response(JSON.stringify({ error: 'email requerido' }), { status: 400 });
  }
  const normalizedEmail = email.trim().toLowerCase();

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // No hay forma directa de "buscar por email" en el Admin API — la lista de
  // usuarios de este proyecto es chica (app de un entrenador), así que iterar
  // es aceptable. Si el volumen crece, reemplazar por una función SQL propia.
  let userId: string | null = null;
  let oauthProvider: string | null = null;
  let page = 1;
  while (userId === null) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data?.users?.length) break;
    const match = data.users.find((u) => u.email?.toLowerCase() === normalizedEmail);
    if (match) {
      userId = match.id;
      const hasEmailIdentity = match.identities?.some((i) => i.provider === 'email') ?? false;
      if (!hasEmailIdentity) {
        oauthProvider = match.identities?.[0]?.provider ?? match.app_metadata?.provider ?? 'google';
      }
    }
    if (data.users.length < 200) break; // última página
    page += 1;
  }

  // Respuesta genérica siempre — no confirmamos/negamos si el mail existe.
  const genericOk = new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
  if (!userId) return genericOk;

  // Cuenta de Google/Apple sin password propia: no hay nada que resetear.
  if (oauthProvider) {
    return new Response(JSON.stringify({ ok: true, oauth_provider: oauthProvider }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const token = crypto.randomUUID().replace(/-/g, '');
  const tokenHash = await sha256Hex(token);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();

  const { error: insertError } = await admin.from('password_reset_tokens').insert({
    user_id: userId,
    email: normalizedEmail,
    token_hash: tokenHash,
    expires_at: expiresAt,
  });
  if (insertError) {
    console.error('[custom-request-password-reset] insert failed:', insertError.message);
    return genericOk;
  }

  const appBaseUrl = Deno.env.get('APP_BASE_URL') ?? 'https://reset-fitness.vercel.app';
  const params = new URLSearchParams({ token, email: normalizedEmail, type: 'custom_recovery' });
  if (deep_link) params.set('deep_link', deep_link);
  const resetLink = `${appBaseUrl}/auth/mobile-callback?${params.toString()}`;
  console.log('[custom-request-password-reset] deep_link recibido=', deep_link, '| resetLink=', resetLink);

  const { ok, error: sendError } = await sendResendEmail({
    to: normalizedEmail,
    subject: 'Restablecé tu contraseña — R3SET',
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color:#111;">Restablecé tu contraseña</h2>
        <p style="color:#444; line-height:1.5;">
          Tocá el botón para elegir una contraseña nueva. Este link vence en 30 minutos.
        </p>
        <p style="text-align:center; margin: 32px 0;">
          <a href="${resetLink}" style="background:#C1ED00; color:#07090A; padding:14px 28px; border-radius:10px; text-decoration:none; font-weight:700;">
            RESTABLECER CONTRASEÑA
          </a>
        </p>
        <p style="color:#888; font-size:13px;">Si no pediste este cambio, ignorá este mail.</p>
      </div>
    `,
  });
  if (!ok) console.error('[custom-request-password-reset] resend failed:', sendError);

  return genericOk;
});
