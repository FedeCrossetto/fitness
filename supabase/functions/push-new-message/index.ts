// Edge Function: push-new-message
// Envía push (Expo Push Service) al alumno cuando su entrenador le escribe.
//
// Autorización (verify_jwt = false en deploy):
//   - Header x-push-webhook-secret (trigger DB pg_net)
//   - Bearer JWT de entrenador autenticado (invoke desde web)
//
// Solo coach → alumno (sender_role = 'trainer').

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

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

async function isAuthorized(req: Request, admin: ReturnType<typeof createClient>): Promise<boolean> {
  const webhookSecret = req.headers.get('x-push-webhook-secret');
  if (webhookSecret) {
    const { data } = await admin
      .from('push_webhook_config')
      .select('secret')
      .eq('name', 'messages')
      .maybeSingle();
    if (data?.secret === webhookSecret) return true;
  }

  const authHeader = req.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error } = await userClient.auth.getUser();
    if (user && !error) return true;
  }

  return false;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('ok', { status: 200 });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  if (!(await isAuthorized(req, admin))) {
    return new Response('unauthorized', { status: 401 });
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

  if (senderRole !== 'trainer') {
    return new Response('no es mensaje del coach', { status: 200 });
  }
  if (!clientId || !content) {
    return new Response('payload inválido', { status: 400 });
  }

  const { data: tokens } = await admin
    .from('push_tokens')
    .select('expo_token')
    .eq('user_id', clientId)
    .eq('is_active', true);

  if (!tokens || tokens.length === 0) {
    console.log('push-new-message: sin tokens para', clientId);
    return new Response('sin tokens', { status: 200 });
  }

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
    priority: 'high',
    data: { type: 'message' },
    channelId: 'messages',
  }));

  const pushResponse = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(messages),
  });

  const pushText = await pushResponse.text();
  if (!pushResponse.ok) {
    console.error('Error enviando push:', pushText);
    return new Response('error de push', { status: 502 });
  }

  try {
    const result = JSON.parse(pushText) as {
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

    const errors = (result.data ?? []).filter((t) => t.status === 'error');
    if (errors.length > 0) {
      console.error('Expo push tickets con error:', JSON.stringify(errors));
    }
  } catch {
    // no crítico
  }

  return new Response('enviado', { status: 200 });
});
