import { anyClient } from '../lib/supabase';

/**
 * Un cliente nuevo (todavía `client_status = 'pending'`) que aplicó a Mentoría
 * 1 a 1 no debe volver a ver la pantalla de selección de planes — queda
 * esperando a que el entrenador lo active (ver RootNavigator). `dismissed`
 * no cuenta: equivale a que nunca aplicó.
 */
export async function hasPendingMentoriaEvaluation(clientId: string): Promise<boolean> {
  try {
    const { data, error } = await anyClient
      .from('evaluation_requests')
      .select('id')
      .eq('client_id', clientId)
      .neq('status', 'dismissed')
      .limit(1);
    if (error) {
      if (__DEV__) console.warn('[evaluationGate] check failed:', error.message);
      return false;
    }
    return Array.isArray(data) && data.length > 0;
  } catch (err) {
    if (__DEV__) console.warn('[evaluationGate] check threw:', err);
    return false;
  }
}
