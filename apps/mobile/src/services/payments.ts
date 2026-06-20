import { supabase } from '../lib/supabase';
import type { PlanRow, SubscriptionRow } from '../types/database';

/**
 * Pagos con Mercado Pago.
 * La preferencia se crea en el backend (Edge Function `mp-create-preference`) para no exponer
 * el access token de MP en el cliente. El webhook `mp-webhook` activa la suscripción.
 */

/** Misma lógica que private.my_trainer_id(): el entrenador dueño de los precios. */
async function resolvePlanTrainerId(userId: string): Promise<string | null> {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('trainer_id, role')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!profile) return null;
  if (profile.role === 'trainer' || profile.role === 'admin') return userId;
  return profile.trainer_id;
}

export async function fetchPlans(userId?: string | null): Promise<PlanRow[]> {
  const trainerId = userId ? await resolvePlanTrainerId(userId) : null;

  const [{ data: plans, error: plansError }, overridesResult] = await Promise.all([
    supabase.from('plans').select('*').eq('active', true).order('duration_days'),
    trainerId
      ? supabase
          .from('trainer_plan_prices')
          .select('plan_id, price_ars')
          .eq('trainer_id', trainerId)
          .eq('active', true)
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (plansError) throw plansError;
  if (overridesResult.error) throw overridesResult.error;

  const overrides = new Map(
    ((overridesResult.data as { plan_id: string; price_ars: number }[] | null) ?? []).map((o) => [
      o.plan_id,
      Number(o.price_ars),
    ]),
  );

  return ((plans as PlanRow[] | null) ?? []).map((plan) => ({
    ...plan,
    price_ars: overrides.get(plan.id) ?? Number(plan.price_ars),
  }));
}

export async function fetchActiveSubscription(userId: string): Promise<SubscriptionRow | null> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .neq('status', 'pending')
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

export type SubscriptionWithPlan = SubscriptionRow & { plan_name: string | null };

export async function fetchActiveSubscriptionWithPlan(userId: string): Promise<SubscriptionWithPlan | null> {
  const sub = await fetchActiveSubscription(userId);
  if (!sub) return null;

  const { data: plan, error: planError } = await supabase
    .from('plans')
    .select('name')
    .eq('id', sub.plan_id)
    .maybeSingle();
  if (planError) throw planError;

  return { ...sub, plan_name: plan?.name ?? null };
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
