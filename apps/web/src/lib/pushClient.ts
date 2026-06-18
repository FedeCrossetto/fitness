import { supabase } from '@/lib/supabase';

/** Dispara push al alumno cuando el entrenador envía un mensaje (best-effort). */
export async function notifyPushNewMessage(clientId: string, content: string): Promise<void> {
  try {
    const { error } = await supabase.functions.invoke('push-new-message', {
      body: { client_id: clientId, content, sender_role: 'trainer' },
    });
    if (error) console.warn('[push-new-message]', error.message);
  } catch (err) {
    console.warn('[push-new-message]', err);
  }
}
