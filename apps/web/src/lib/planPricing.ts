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
  overrides: { plan_id: string; price_ars: number }[],
): PlanWithPrice[] {
  return plans.map((plan) => {
    const override = overrides.find((o) => o.plan_id === plan.id);
    const effectivePrice = override ? Number(override.price_ars) : Number(plan.price_ars);
    return {
      ...plan,
      effectivePrice,
      draftPrice: String(Math.round(effectivePrice)),
      hasOverride: !!override,
    };
  });
}
