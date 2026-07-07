// Edge Function: notify-new-client
// Disparada por un trigger de Postgres (ver migración
// 20260707034630_trainer_notify_new_client_and_purchase.sql) cada vez que un
// perfil pasa a client_status='pending' con un trainer_id asignado — le manda
// un mail al entrenador avisando que tiene un cliente nuevo esperando aprobación.
//
// Protegida por un secret compartido (DB_WEBHOOK_SECRET), no el service role
// key — el trigger lo manda como Bearer token via pg_net.
//
// Secrets requeridos: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DB_WEBHOOK_SECRET,
//   RESEND_API_KEY, RESEND_FROM_EMAIL

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { sendResendEmail } from '../_shared/resend.ts';

Deno.serve(async (req) => {
  const dbSecret = Deno.env.get('DB_WEBHOOK_SECRET');
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!dbSecret || authHeader !== `Bearer ${dbSecret}`) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
  }

  const { client_id } = (await req.json().catch(() => ({}))) as { client_id?: string };
  if (!client_id) {
    return new Response(JSON.stringify({ error: 'client_id requerido' }), { status: 400 });
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { data: profile } = await admin
    .from('profiles')
    .select('full_name, phone, trainer_id, created_at')
    .eq('id', client_id)
    .maybeSingle();
  if (!profile?.trainer_id) {
    return new Response(JSON.stringify({ skipped: 'sin_trainer' }), { headers: { 'Content-Type': 'application/json' } });
  }

  const [{ data: clientAuth }, { data: trainerAuth }] = await Promise.all([
    admin.auth.admin.getUserById(client_id),
    admin.auth.admin.getUserById(profile.trainer_id),
  ]);
  const trainerEmail = trainerAuth?.user?.email;
  if (!trainerEmail) {
    return new Response(JSON.stringify({ skipped: 'sin_email_entrenador' }), { headers: { 'Content-Type': 'application/json' } });
  }

  const clientEmail = clientAuth?.user?.email ?? 'sin email';
  const clientName = profile.full_name ?? 'Sin nombre';

  const { ok } = await sendResendEmail({
    to: trainerEmail,
    subject: `Nuevo cliente pendiente: ${clientName}`,
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color:#111;">Tenés un cliente nuevo esperando aprobación</h2>
        <p style="color:#444; line-height:1.5;">
          <strong>${clientName}</strong> se registró con tu código de invitación.
        </p>
        <ul style="color:#444; line-height:1.7; padding-left:18px;">
          <li>Email: ${clientEmail}</li>
          ${profile.phone ? `<li>Teléfono: ${profile.phone}</li>` : ''}
        </ul>
        <p style="color:#444; line-height:1.5;">
          Entrá a la sección Clientes → Pendientes para revisar su solicitud y activarlo.
        </p>
      </div>
    `,
  });

  return new Response(JSON.stringify({ ok }), { headers: { 'Content-Type': 'application/json' } });
});
