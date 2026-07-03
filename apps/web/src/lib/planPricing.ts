import type { PlanRow } from '@reset-fitness/shared/types/database';

export type PlanWithPrice = PlanRow & {
  effectivePrice: number;
  draftPrice: string;
  hasOverride: boolean;
};

export function formatMoney(amount: number, locale: string): string {
  return new Intl.NumberFormat(locale === 'es' ? 'es-AR' : 'en-US', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatInputPrice(value: string, locale: string): string {
  const n = Number(value.replace(/\D/g, ''));
  if (!n) return '';
  return new Intl.NumberFormat(locale === 'es' ? 'es-AR' : 'en-US').format(n);
}

export function mergePlans(
  plans: PlanRow[],
  overrides: { plan_id: string; price_ars: number; active?: boolean }[],
): PlanWithPrice[] {
  return plans.map((plan) => {
    const override = overrides.find((o) => o.plan_id === plan.id);
    const effectivePrice = override ? Number(override.price_ars) : Number(plan.price_ars);
    // Un plan built-in (trainer_id null) es visible por defecto según el
    // catálogo global (plan.active), salvo que ESTE entrenador lo haya
    // tapado/mostrado explícitamente vía trainer_plan_prices.active. Un
    // plan custom (trainer_id propio) no tiene override — su visibilidad
    // es directamente plan.active.
    const effectiveActive = override?.active !== undefined ? override.active : !!plan.active;
    return {
      ...plan,
      active: effectiveActive,
      effectivePrice,
      draftPrice: String(Math.round(effectivePrice)),
      // "Precio personalizado" solo si el precio realmente difiere del
      // catálogo — la fila de override también existe cuando lo único que
      // cambió fue la visibilidad (el switch "Visible en mobile").
      hasOverride: !!override && Number(override.price_ars) !== Number(plan.price_ars),
    };
  });
}
