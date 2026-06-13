import { supabase } from '../lib/supabase';
import type { PlanRow, SubscriptionRow } from '../types/database';

/**
 * Pagos con Mercado Pago.
 * La preferencia se crea en el backend (Edge Function `mp-create-preference`) para no exponer
 * el access token de MP en el cliente. El webhook `mp-webhook` activa la suscripción.
 */

export async function fetchPlans(): Promise<PlanRow[]> {
  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .eq('active', true)
    .order('duration_days');
  if (error) throw error;
  return data;
}

export async function fetchActiveSubscription(userId: string): Promise<SubscriptionRow | null> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  if (data.status === 'active' && data.expires_at && new Date(data.expires_at) < new Date()) {
    return { ...data, status: 'expired' };
  }
  return data;
}

export function hasActiveAccess(subscription: SubscriptionRow | null): boolean {
  if (!subscription) return false;
  return (
    subscription.status === 'active' &&
    (!subscription.expires_at || new Date(subscription.expires_at) > new Date())
  );
}

/** Crea la preferencia de pago y devuelve la URL de checkout de Mercado Pago. */
export async function createCheckout(planId: string): Promise<{ checkoutUrl: string; subscriptionId: string }> {
  const { data, error } = await supabase.functions.invoke<{
    init_point: string;
    subscription_id: string;
  }>('mp-create-preference', { body: { plan_id: planId } });
  if (error || !data) {
    throw new Error('No pudimos iniciar el pago. Intentá de nuevo.');
  }
  return { checkoutUrl: data.init_point, subscriptionId: data.subscription_id };
}
