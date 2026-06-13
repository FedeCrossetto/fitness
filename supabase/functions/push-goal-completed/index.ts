// Edge Function: push-goal-completed
// Envía una push (Expo Push Service) cuando una meta diaria pasa a completada.
// Invocable de dos formas:
//   1) Database Webhook sobre UPDATE de public.daily_goals (recomendado)
//   2) POST manual { user_id, goal_text }
//
// El webhook de DB se configura en Dashboard → Database → Webhooks, evento UPDATE
// sobre daily_goals, hacia esta función.

import { createClient } from 'jsr:@supabase/supabase-js@2';

interface DailyGoalRecord {
  id: string;
  user_id: string;
  text: string;
  completed: boolean;
}

interface WebhookPayload {
  type: 'UPDATE';
  record: DailyGoalRecord;
  old_record: DailyGoalRecord;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('ok', { status: 200 });
  }

  let userId: string | null = null;
  let goalText: string | null = null;

  const body = (await req.json()) as WebhookPayload | { user_id?: string; goal_text?: string };

  if ('record' in body && 'old_record' in body) {
    // Solo notificar la transición no-completada → completada
    if (!body.record.completed || body.old_record.completed) {
      return new Response('sin transición', { status: 200 });
    }
    userId = body.record.user_id;
    goalText = body.record.text;
  } else {
    userId = body.user_id ?? null;
    goalText = body.goal_text ?? null;
  }

  if (!userId || !goalText) {
    return new Response('payload inválido', { status: 400 });
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { data: tokens } = await admin
    .from('push_tokens')
    .select('expo_token')
    .eq('user_id', userId)
    .eq('is_active', true);

  if (!tokens || tokens.length === 0) {
    return new Response('sin tokens', { status: 200 });
  }

  const messages = tokens.map((t) => ({
    to: t.expo_token,
    sound: 'default',
    title: '¡Meta cumplida!',
    body: `Completaste "${goalText}". Seguí así, tu racha lo vale.`,
    data: { type: 'goal_completed' },
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

  // Desactivar tokens que Expo reporta como no registrados (app desinstalada, etc.)
  try {
    const result = (await pushResponse.json()) as {
      data?: { status: string; details?: { error?: string } }[];
    };
    const staleTokens = (result.data ?? [])
      .map((ticket, i) => ({ ticket, token: tokens[i]?.expo_token }))
      .filter(
        ({ ticket, token }) =>
          token && ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered'
      )
      .map(({ token }) => token as string);

    if (staleTokens.length > 0) {
      await admin.from('push_tokens').update({ is_active: false }).in('expo_token', staleTokens);
    }
  } catch {
    // si no pudimos parsear la respuesta, no es crítico: la push ya se envió
  }

  return new Response('enviado', { status: 200 });
});
