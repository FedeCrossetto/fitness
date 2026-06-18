// Edge Function: push-new-message
// Envía una push (Expo Push Service) al alumno cuando su entrenador le escribe.
// Invocable de dos formas:
//   1) Database Webhook sobre INSERT de public.messages (recomendado)
//   2) POST manual { client_id, content, sender_role }
//
// El webhook de DB se configura en Dashboard → Database → Webhooks, evento INSERT
// sobre messages, hacia esta función.
//
// Solo se notifica coach → alumno (sender_role = 'trainer'): el alumno usa la app
// mobile; el entrenador ve los mensajes en el panel web.

import { createClient } from 'jsr:@supabase/supabase-js@2';

interface MessageRecord {
  id: string;
  client_id: string;
  content: string;
  sender_role: 'client' | 'trainer';
}

interface WebhookPayload {
  type: 'INSERT';
  record: MessageRecord;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('ok', { status: 200 });
  }

  const body = (await req.json()) as
    | WebhookPayload
    | { client_id?: string; content?: string; sender_role?: string };

  let clientId: string | null = null;
  let content: string | null = null;
  let senderRole: string | null = null;

  if ('record' in body && body.record) {
    clientId = body.record.client_id;
    content = body.record.content;
    senderRole = body.record.sender_role;
  } else {
    clientId = body.client_id ?? null;
    content = body.content ?? null;
    senderRole = body.sender_role ?? null;
  }

  // Solo coach → alumno.
  if (senderRole !== 'trainer') {
    return new Response('no es mensaje del coach', { status: 200 });
  }
  if (!clientId || !content) {
    return new Response('payload inválido', { status: 400 });
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: tokens } = await admin
    .from('push_tokens')
    .select('expo_token')
    .eq('user_id', clientId)
    .eq('is_active', true);

  if (!tokens || tokens.length === 0) {
    return new Response('sin tokens', { status: 200 });
  }

  // Nombre del coach (opcional, para personalizar el título).
  let coachName = 'tu coach';
  const { data: client } = await admin
    .from('profiles')
    .select('trainer_id')
    .eq('id', clientId)
    .maybeSingle();
  if (client?.trainer_id) {
    const { data: coach } = await admin
      .from('profiles')
      .select('full_name')
      .eq('id', client.trainer_id)
      .maybeSingle();
    if (coach?.full_name) coachName = coach.full_name;
  }

  const preview = content.length > 120 ? `${content.slice(0, 117)}…` : content;

  const messages = tokens.map((t) => ({
    to: t.expo_token,
    sound: 'default',
    title: `Mensaje de ${coachName}`,
    body: preview,
    data: { type: 'message' },
  }));

  const pushResponse = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(messages),
  });

  if (!pushResponse.ok) {
    console.error('Error enviando push:', await pushResponse.text());
    return new Response('error de push', { status: 200 });
  }

  // Desactivar tokens que Expo reporta como no registrados.
  try {
    const result = (await pushResponse.json()) as {
      data?: { status: string; details?: { error?: string } }[];
    };
    const staleTokens = (result.data ?? [])
      .map((ticket, i) => ({ ticket, token: tokens[i]?.expo_token }))
      .filter(
        ({ ticket, token }) =>
          token && ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered',
      )
      .map(({ token }) => token as string);

    if (staleTokens.length > 0) {
      await admin.from('push_tokens').update({ is_active: false }).in('expo_token', staleTokens);
    }
  } catch {
    // no crítico: la push ya se envió
  }

  return new Response('enviado', { status: 200 });
});
