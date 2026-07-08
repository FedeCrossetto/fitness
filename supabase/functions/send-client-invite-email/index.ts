// Edge Function: send-client-invite-email
// Llamada directamente desde el panel web (modal "Agregar cliente") cuando el
// entrenador manda su link de invitación por email en vez de copiarlo/compartirlo
// a mano. Requiere sesión de entrenador (Authorization: Bearer <jwt de usuario>).
//
// Secrets requeridos: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
//   RESEND_API_KEY, RESEND_FROM_EMAIL

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { sendResendEmail } from '../_shared/resend.ts';

const PRODUCTION_APP_URL = 'https://reset-fitness.vercel.app';

// El navegador manda un preflight OPTIONS antes del POST (Content-Type: application/json
// no es "simple") — sin responderlo con estos headers, fetch nunca llega a mandar el POST.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Método no permitido' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const authHeader = req.headers.get('Authorization') ?? '';
  const supabaseAuth = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await supabaseAuth.auth.getUser();
  if (userError || !userData.user) {
    return json({ error: 'No autenticado' }, 401);
  }
  const trainerId = userData.user.id;

  const { email } = (await req.json().catch(() => ({}))) as { email?: string };
  const cleanEmail = (email ?? '').trim();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    return json({ error: 'email_invalido' }, 400);
  }

  const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const [{ data: trainerProfile }, { data: branding }] = await Promise.all([
    admin.from('profiles').select('role, full_name').eq('id', trainerId).maybeSingle(),
    admin.from('trainer_branding').select('invite_code, app_name').eq('trainer_id', trainerId).maybeSingle(),
  ]);
  if (!trainerProfile || (trainerProfile.role !== 'trainer' && trainerProfile.role !== 'admin')) {
    return json({ error: 'No autorizado' }, 403);
  }
  if (!branding?.invite_code) {
    return json({ error: 'sin_codigo_invitacion' }, 400);
  }

  const inviteLink = `${PRODUCTION_APP_URL}/unirse?code=${encodeURIComponent(branding.invite_code)}`;
  const trainerName = trainerProfile.full_name ?? 'tu entrenador';
  const appName = branding.app_name ?? 'R3SET';

  const { ok, error } = await sendResendEmail({
    to: cleanEmail,
    subject: `${trainerName} te invitó a ${appName}`,
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color:#111;">${trainerName} te invitó a entrenar con ${appName}</h2>
        <p style="color:#444; line-height:1.5;">
          Hacé clic en el siguiente botón para crear tu cuenta y quedar vinculado automáticamente.
        </p>
        <p style="text-align:center; margin: 28px 0;">
          <a href="${inviteLink}" style="background:#111; color:#fff; padding:12px 24px; border-radius:8px; text-decoration:none; font-weight:600; display:inline-block;">
            Crear mi cuenta
          </a>
        </p>
        <p style="color:#888; font-size:13px; line-height:1.5;">
          Si el botón no funciona, copiá y pegá este link en tu navegador:<br />
          <a href="${inviteLink}" style="color:#888;">${inviteLink}</a>
        </p>
      </div>
    `,
  });

  if (!ok) {
    return json({ error: error ?? 'send_failed' }, 502);
  }

  return json({ ok: true });
});
