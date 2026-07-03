import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { PlanRow, PlanType } from '@reset-fitness/shared/types/database';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from '@/hooks/useTranslation';
import { useToast } from '@/hooks/useToast';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { ErrorState, LoadingRows } from '@/components/ui';
import { formatInputPrice, formatMoney, mergePlans, type PlanWithPrice } from '@/lib/planPricing';

/** Todo el catálogo (Base + Mentoría, 1 a 6 meses) — a diferencia de la
 * grilla acotada de /payments, que solo muestra los 3 planes Base activos
 * de siempre. Acá se editan los precios de referencia que autocompletan el
 * monto en "Registrar pago manual" (incluidos los que hoy no están
 * habilitados para el checkout self-service de mobile). */
export function ManagePlansPage(): React.JSX.Element {
  const { session } = useAuth();
  const { t, language } = useTranslation();
  const { showToast } = useToast();
  const userId = session?.user.id;

  const [plans, setPlans] = useState<PlanWithPrice[]>([]);
  const [savingPlanId, setSavingPlanId] = useState<string | null>(null);

  const { data, loading, error, refetch } = useSupabaseQuery<PlanWithPrice[]>(
    async () => {
      const [{ data: planRows, error: plansError }, { data: overrideRows, error: overridesError }] = await Promise.all([
        supabase.from('plans').select('*').order('plan_type').order('duration_days'),
        supabase.from('trainer_plan_prices').select('plan_id, price_ars').eq('trainer_id', userId!),
      ]);
      if (plansError) throw plansError;
      if (overridesError) throw overridesError;
      return mergePlans(
        (planRows as PlanRow[] | null) ?? [],
        (overrideRows as { plan_id: string; price_ars: number }[] | null) ?? [],
      );
    },
    [userId],
    { enabled: !!userId },
  );

  useEffect(() => { if (data) setPlans(data); }, [data]);

  const updateDraftPrice = useCallback((planId: string, value: string) => {
    setPlans((prev) =>
      prev.map((p) => (p.id === planId ? { ...p, draftPrice: value.replace(/[^\d]/g, '') } : p)),
    );
  }, []);

  const savePlanPrice = useCallback(async (plan: PlanWithPrice) => {
    if (!userId) return;
    const price = Number(plan.draftPrice);
    if (!price || price <= 0) return;

    setSavingPlanId(plan.id);
    try {
      const { error: upsertError } = await supabase.from('trainer_plan_prices').upsert(
        { trainer_id: userId, plan_id: plan.id, price_ars: price, active: true },
        { onConflict: 'trainer_id,plan_id' },
      );
      if (upsertError) throw upsertError;
      setPlans((prev) =>
        prev.map((p) => (p.id === plan.id ? { ...p, effectivePrice: price, hasOverride: true, draftPrice: String(price) } : p)),
      );
      showToast('success', t.payments.price_saved);
    } catch {
      showToast('error', t.payments.price_error);
    } finally {
      setSavingPlanId(null);
    }
  }, [userId, showToast, t.payments.price_error, t.payments.price_saved]);

  const groups = useMemo(() => {
    const byType = (type: PlanType) => plans.filter((p) => p.plan_type === type);
    return [
      { type: 'base' as PlanType, label: t.payments.manage_plans_group_base, items: byType('base') },
      { type: 'mentoria' as PlanType, label: t.payments.manage_plans_group_mentoria, items: byType('mentoria') },
    ];
  }, [plans, t.payments.manage_plans_group_base, t.payments.manage_plans_group_mentoria]);

  return (
    <div>
      <Link to="/payments" className="back-link">← {t.web.back_to_payments}</Link>
      <h1 className="page-title">{t.payments.manage_plans_title}</h1>
      <p className="page-sub">{t.payments.manage_plans_sub}</p>

      {error ? (
        <ErrorState message={t.payments.load_error} onRetry={refetch} />
      ) : loading ? (
        <LoadingRows rows={4} />
      ) : (
        groups.map((group) => (
          <section key={group.type} className="payments-plans-panel" style={{ marginTop: 20 }}>
            <div className="payments-panel-head">
              <h2 className="payments-panel-title">{group.label}</h2>
            </div>
            <div className="payments-plans-row">
              {group.items.map((plan) => {
                const months = Math.max(1, Math.round(plan.duration_days / 30));
                const perMonth = Math.round(plan.effectivePrice / months);
                const dirty = plan.draftPrice !== String(Math.round(plan.effectivePrice));
                const saving = savingPlanId === plan.id;
                return (
                  <div key={plan.id} className="payments-plan-cell">
                    <div className="payments-plan-cell-head">
                      <span className="payments-plan-name">{months === 1 ? '1 mes' : `${months} meses`}</span>
                      {!plan.active ? <span className="payments-custom-tag">Oculto en mobile</span> : null}
                    </div>
                    {plan.hasOverride ? (
                      <span className="payments-custom-tag">{t.payments.custom_price}</span>
                    ) : null}
                    <div className="payments-price-field">
                      <label className="payments-price-label" htmlFor={`manage-price-${plan.id}`}>
                        ARS
                      </label>
                      <div className={`payments-price-input-wrap${dirty ? ' dirty' : ''}`}>
                        <span className="payments-price-currency">$</span>
                        <input
                          id={`manage-price-${plan.id}`}
                          type="text"
                          inputMode="numeric"
                          className="payments-price-input"
                          value={formatInputPrice(plan.draftPrice, language)}
                          onChange={(e) => updateDraftPrice(plan.id, e.target.value)}
                          aria-label={`${group.label} — ${months} ${months === 1 ? 'mes' : 'meses'}`}
                        />
                      </div>
                    </div>
                    <div className="payments-plan-actions">
                      <span className="payments-plan-foot">
                        {formatMoney(perMonth, language)} / mes
                      </span>
                      <button
                        type="button"
                        className={`btn sm payments-save-btn${dirty ? '' : ' secondary'}`}
                        disabled={!dirty || saving}
                        onClick={() => void savePlanPrice(plan)}
                      >
                        {saving ? '…' : t.payments.save_price}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
