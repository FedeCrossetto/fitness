import { supabase } from '../lib/supabase';
import type { PlanRow, PlanType, ProfileRow, SubscriptionRow } from '../types/database';

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

  // Sin filtro `active` acá: la RLS de `plans` ya devuelve solo los planes
  // built-in (trainer_id null) + los custom del propio entrenador — la
  // visibilidad real (mostrar/ocultar) se resuelve abajo por entrenador,
  // no es un flag global.
  const [{ data: plans, error: plansError }, overridesResult] = await Promise.all([
    // plan_type='base': el checkout self-service nunca debe ofrecer Mentoría
    // 1-1 (se procesa manualmente vía evaluación + activación del entrenador).
    supabase.from('plans').select('*').eq('plan_type', 'base').order('duration_days'),
    trainerId
      ? supabase
          .from('trainer_plan_prices')
          .select('plan_id, price_ars, active')
          .eq('trainer_id', trainerId)
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (plansError) throw plansError;
  if (overridesResult.error) throw overridesResult.error;

  const overrides = new Map(
    ((overridesResult.data as { plan_id: string; price_ars: number; active: boolean }[] | null) ?? []).map((o) => [
      o.plan_id,
      o,
    ]),
  );

  return ((plans as PlanRow[] | null) ?? [])
    .map((plan) => {
      const override = overrides.get(plan.id);
      return {
        ...plan,
        price_ars: override ? Number(override.price_ars) : Number(plan.price_ars),
        active: override ? override.active : !!plan.active,
      };
    })
    .filter((plan) => plan.active);
}

export async function fetchActiveSubscription(userId: string): Promise<SubscriptionRow | null> {
  const { data: activeRows, error: activeError } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false });
  if (activeError) throw activeError;

  const now = Date.now();
  const validActive = (activeRows ?? []).find(
    (row) => !row.expires_at || new Date(row.expires_at).getTime() > now,
  );
  if (validActive) return validActive;

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
  if (data.status === 'active' && data.expires_at && new Date(data.expires_at).getTime() <= now) {
    return { ...data, status: 'expired' };
  }
  return data;
}

/** Plan real del cliente (Base o Mentoría 1-1), vía su suscripción activa más
 * reciente. Sin suscripción (ej. recién activado) devuelve 'base', igual
 * default que la columna plans.plan_type. Usado para elegir qué formulario
 * de consulta (consultation_form_configs) le corresponde ver. */
export async function resolveClientPlanType(clientId: string): Promise<PlanType> {
  const sub = await fetchActiveSubscription(clientId);
  if (!sub) return 'base';
  const { data: plan } = await supabase
    .from('plans')
    .select('plan_type')
    .eq('id', sub.plan_id)
    .maybeSingle();
  return (plan as { plan_type: PlanType } | null)?.plan_type ?? 'base';
}

type SubscriptionAccessCache = {
  userId: string;
  subscription: SubscriptionRow | null;
  hasAccess: boolean;
  at: number;
};

let accessCache: SubscriptionAccessCache | null = null;
const ACCESS_CACHE_MS = 90_000;

export function clearSubscriptionAccessCache(): void {
  accessCache = null;
}

export function getCachedSubscriptionAccess(userId: string): boolean | null {
  if (!accessCache || accessCache.userId !== userId) return null;
  if (Date.now() - accessCache.at > ACCESS_CACHE_MS) return null;
  return accessCache.hasAccess;
}

export async function resolveSubscriptionAccess(
  userId: string,
): Promise<{ subscription: SubscriptionRow | null; hasAccess: boolean }> {
  const subscription = await fetchActiveSubscription(userId);
  const hasAccess = hasActiveAccess(subscription);
  accessCache = { userId, subscription, hasAccess, at: Date.now() };
  return { subscription, hasAccess };
}

/** Si hay suscripción activa pero el perfil sigue en pending, sincroniza client_status. */
export async function syncClientActivationIfPaid(
  userId: string,
  profile: ProfileRow,
): Promise<ProfileRow> {
  if (profile.role !== 'client' || profile.client_status === 'active') return profile;

  const { hasAccess } = await resolveSubscriptionAccess(userId);
  if (!hasAccess) return profile;

  const { data, error } = await supabase
    .from('profiles')
    .update({ client_status: 'active' })
    .eq('id', userId)
    .select()
    .single();
  if (error || !data) return profile;
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

export function isManualSubscription(subscription: SubscriptionRow | null | undefined): boolean {
  return subscription?.mp_status === 'manual';
}

/** Crea la suscripción recurrente (Preapproval) y devuelve la URL de
 * checkout de Mercado Pago donde el alumno autoriza el cobro mensual. */
export async function createCheckout(
  planId: string,
  returnUrl?: string,
): Promise<{ checkoutUrl: string; subscriptionId: string }> {
  const { data, error } = await supabase.functions.invoke<{
    init_point: string;
    subscription_id: string;
  }>('mp-create-preapproval', { body: { plan_id: planId, return_url: returnUrl } });
  if (error || !data) {
    if (__DEV__) {
      // FunctionsHttpError trae la respuesta real en `context` — logueamos
      // el detalle (incluye el motivo de rechazo de Mercado Pago) sin
      // mostrárselo al alumno.
      const context = (error as { context?: Response })?.context;
      void context?.clone().text().then((body) => console.warn('[createCheckout] error:', body)).catch(() => {});
      console.warn('[createCheckout] invoke error:', error);
    }
    throw new Error('No pudimos iniciar el pago. Intentá de nuevo.');
  }
  return { checkoutUrl: data.init_point, subscriptionId: data.subscription_id };
}

/** Cancela la suscripción recurrente en Mercado Pago (el alumno cancela la propia). */
export async function cancelSubscription(subscriptionId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke<{ ok?: boolean; error?: string }>(
    'mp-cancel-subscription',
    { body: { subscription_id: subscriptionId } },
  );
  if (error || !data?.ok) {
    throw new Error('No pudimos cancelar la suscripción. Intentá de nuevo.');
  }
}
