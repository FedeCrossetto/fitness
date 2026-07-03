import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { PlanRow, PlanType } from '@reset-fitness/shared/types/database';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from '@/hooks/useTranslation';
import { useToast } from '@/hooks/useToast';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { ErrorState, LoadingRows, ConfirmDialog } from '@/components/ui';
import { BookOpenIcon, TeamIcon, PlusIcon, TrashIcon } from '@/components/icons';
import { formatInputPrice, formatMoney, mergePlans, type PlanWithPrice } from '@/lib/planPricing';

type PlanGroup = {
  type: PlanType;
  label: string;
  icon: React.ReactNode;
  items: PlanWithPrice[];
};

const MAX_MONTHS = 12;

export function ManagePlansPage(): React.JSX.Element {
  const { session } = useAuth();
  const { t, i18n, language } = useTranslation();
  const { showToast } = useToast();
  const userId = session?.user.id;

  const [plans, setPlans] = useState<PlanWithPrice[]>([]);
  const [savingPlanId, setSavingPlanId] = useState<string | null>(null);
  const [openType, setOpenType] = useState<PlanType | null>(null);
  const [addingOpen, setAddingOpen] = useState(false);
  const [newMonths, setNewMonths] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newVisible, setNewVisible] = useState(true);
  const [adding, setAdding] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PlanWithPrice | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [saveTarget, setSaveTarget] = useState<PlanWithPrice | null>(null);
  const [toggleTarget, setToggleTarget] = useState<PlanWithPrice | null>(null);

  const { data, loading, error, refetch } = useSupabaseQuery<PlanWithPrice[]>(
    async () => {
      // RLS ya filtra a los planes built-in (trainer_id null) + los custom
      // del propio entrenador.
      const [{ data: planRows, error: plansError }, { data: overrideRows, error: overridesError }] = await Promise.all([
        supabase.from('plans').select('*').order('plan_type').order('duration_days'),
        supabase.from('trainer_plan_prices').select('plan_id, price_ars, active').eq('trainer_id', userId!),
      ]);
      if (plansError) throw plansError;
      if (overridesError) throw overridesError;
      return mergePlans(
        (planRows as PlanRow[] | null) ?? [],
        (overrideRows as { plan_id: string; price_ars: number; active: boolean }[] | null) ?? [],
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
      // Un plan custom (trainer_id propio) guarda el precio directo en su
      // fila de `plans`; un plan built-in usa el override de siempre.
      const isOwnCustom = plan.trainer_id === userId;
      const { error: saveError } = isOwnCustom
        ? await supabase.from('plans').update({ price_ars: price }).eq('id', plan.id)
        : await supabase.from('trainer_plan_prices').upsert(
            { trainer_id: userId, plan_id: plan.id, price_ars: price, active: true },
            { onConflict: 'trainer_id,plan_id' },
          );
      if (saveError) throw saveError;
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

  const groups = useMemo<PlanGroup[]>(() => {
    const byType = (type: PlanType) => plans.filter((p) => p.plan_type === type);
    return [
      { type: 'base', label: t.payments.manage_plans_group_base, icon: <BookOpenIcon size={18} />, items: byType('base') },
      { type: 'mentoria', label: t.payments.manage_plans_group_mentoria, icon: <TeamIcon size={18} />, items: byType('mentoria') },
    ];
  }, [plans, t.payments.manage_plans_group_base, t.payments.manage_plans_group_mentoria]);

  const openGroup = groups.find((g) => g.type === openType) ?? null;

  // Meses 1-12 que todavía no tienen una frecuencia (built-in o custom) en
  // este grupo — son las únicas opciones válidas para agregar una nueva.
  const availableMonths = useMemo(() => {
    if (!openGroup) return [];
    const used = new Set(openGroup.items.map((p) => Math.round(p.duration_days / 30)));
    return Array.from({ length: MAX_MONTHS }, (_, i) => i + 1).filter((m) => !used.has(m));
  }, [openGroup]);

  const closeModal = () => {
    setOpenType(null);
    setAddingOpen(false);
    setNewMonths('');
    setNewPrice('');
    setNewVisible(true);
  };

  const openAddForm = () => {
    setNewMonths(String(availableMonths[0] ?? ''));
    setNewVisible(true);
    setAddingOpen(true);
  };

  const toggleVisible = useCallback(async (plan: PlanWithPrice) => {
    if (!userId || togglingId) return;
    const nextActive = !plan.active;
    const isOwnCustom = plan.trainer_id === userId;
    setTogglingId(plan.id);
    setPlans((prev) => prev.map((p) => (p.id === plan.id ? { ...p, active: nextActive } : p)));

    const { error: toggleError } = isOwnCustom
      ? await supabase.from('plans').update({ active: nextActive }).eq('id', plan.id)
      : await supabase.from('trainer_plan_prices').upsert(
          { trainer_id: userId, plan_id: plan.id, price_ars: plan.effectivePrice, active: nextActive },
          { onConflict: 'trainer_id,plan_id' },
        );

    setTogglingId(null);
    if (toggleError) {
      setPlans((prev) => prev.map((p) => (p.id === plan.id ? { ...p, active: plan.active } : p)));
      showToast('error', t.payments.manage_plans_visibility_error);
      return;
    }
    showToast('success', nextActive ? t.payments.manage_plans_visibility_on : t.payments.manage_plans_visibility_off);
  }, [userId, togglingId, showToast, t.payments.manage_plans_visibility_error, t.payments.manage_plans_visibility_on, t.payments.manage_plans_visibility_off]);

  const addFrequency = useCallback(async () => {
    if (!userId || !openGroup || adding) return;
    const months = Number(newMonths);
    const price = Number(newPrice);
    if (!months || months <= 0 || !price || price <= 0) return;

    const durationDays = months * 30;
    if (openGroup.items.some((p) => p.duration_days === durationDays)) {
      showToast('error', t.payments.manage_plans_add_freq_duplicate);
      return;
    }

    setAdding(true);
    const label = months === 1 ? '1 mes' : `${months} meses`;
    const { data: inserted, error: insertError } = await supabase
      .from('plans')
      .insert({
        trainer_id: userId,
        plan_type: openGroup.type,
        name: `${openGroup.label} — ${label}`,
        description: `Acceso completo por ${label}`,
        price_ars: price,
        duration_days: durationDays,
        active: newVisible,
      })
      .select()
      .single();
    setAdding(false);

    if (insertError || !inserted) {
      showToast('error', t.payments.manage_plans_add_freq_error);
      return;
    }

    const row = inserted as PlanRow;
    setPlans((prev) => [
      ...prev,
      { ...row, effectivePrice: price, draftPrice: String(price), hasOverride: false },
    ]);
    showToast('success', t.payments.manage_plans_add_freq_success);
    setAddingOpen(false);
    setNewMonths('');
    setNewPrice('');
    setNewVisible(true);
  }, [userId, openGroup, adding, newMonths, newPrice, newVisible, showToast, t.payments.manage_plans_add_freq_duplicate, t.payments.manage_plans_add_freq_error, t.payments.manage_plans_add_freq_success]);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    const { error: deleteError } = await supabase.from('plans').delete().eq('id', deleteTarget.id);
    setDeleting(false);
    if (deleteError) {
      showToast('error', t.payments.manage_plans_delete_error);
      return;
    }
    setPlans((prev) => prev.filter((p) => p.id !== deleteTarget.id));
    showToast('success', t.payments.manage_plans_delete_success);
    setDeleteTarget(null);
  }, [deleteTarget, deleting, showToast, t.payments.manage_plans_delete_error, t.payments.manage_plans_delete_success]);

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
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
          {groups.map((group) => {
            const prices = group.items.map((p) => p.effectivePrice);
            const min = prices.length ? Math.min(...prices) : 0;
            const max = prices.length ? Math.max(...prices) : 0;
            return (
              <div
                key={group.type}
                className="card"
                style={{ cursor: 'pointer', marginBottom: 0 }}
                onClick={() => setOpenType(group.type)}
                role="button"
                tabIndex={0}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div className="stat-ico" style={{ background: 'var(--surface-elevated)' }}>
                    {group.icon}
                  </div>
                  <span className="badge solid gray">
                    {group.items.length === 1
                      ? t.payments.manage_plans_freq_count_one
                      : i18n(t.payments.manage_plans_freq_count, { n: group.items.length })}
                  </span>
                </div>
                <div style={{ fontWeight: 650, fontSize: 16, marginBottom: 6 }}>{group.label}</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                  {min === max ? formatMoney(min, language) : `${formatMoney(min, language)} – ${formatMoney(max, language)}`}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {openGroup ? (
        <div className="pay-modal-backdrop" onClick={closeModal} role="dialog" aria-modal="true">
          <div className="card manage-plans-modal" onClick={(e) => e.stopPropagation()}>
            <div className="payments-panel-head" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '0 0 16px' }}>
              <h2 className="payments-panel-title">{openGroup.label}</h2>
              <button type="button" className="btn secondary sm" onClick={closeModal}>
                {t.payments.manage_plans_close}
              </button>
            </div>

            <div className="payments-plans-row">
              {openGroup.items.map((plan) => {
                const months = Math.max(1, Math.round(plan.duration_days / 30));
                const perMonth = Math.round(plan.effectivePrice / months);
                const dirty = plan.draftPrice !== String(Math.round(plan.effectivePrice));
                const saving = savingPlanId === plan.id;
                const isOwnCustom = plan.trainer_id === userId;
                return (
                  <div key={plan.id} className="payments-plan-cell" style={{ position: 'relative' }}>
                    {isOwnCustom ? (
                      <button
                        type="button"
                        className="manage-plans-delete-btn"
                        title={t.ui.delete}
                        onClick={() => setDeleteTarget(plan)}
                      >
                        <TrashIcon size={14} />
                      </button>
                    ) : null}
                    <div className="payments-plan-cell-head">
                      <span className="payments-plan-name">{months === 1 ? '1 mes' : `${months} meses`}</span>
                    </div>
                    {isOwnCustom ? (
                      <span className="payments-custom-tag">{t.payments.manage_plans_custom_badge}</span>
                    ) : plan.hasOverride ? (
                      <span className="payments-custom-tag">{t.payments.custom_price}</span>
                    ) : null}
                    <label className="manage-plans-visible-row">
                      <span>{t.payments.manage_plans_visible_label}</span>
                      <span className={`toggle-switch${togglingId === plan.id ? ' saving' : ''}`}>
                        <input
                          type="checkbox"
                          checked={!!plan.active}
                          onChange={() => setToggleTarget(plan)}
                          disabled={togglingId === plan.id}
                          aria-label={t.payments.manage_plans_visible_label}
                        />
                        <span className="toggle-track">
                          <span className="toggle-thumb" />
                        </span>
                      </span>
                    </label>
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
                          aria-label={`${openGroup.label} — ${months} ${months === 1 ? 'mes' : 'meses'}`}
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
                        onClick={() => setSaveTarget(plan)}
                      >
                        {saving ? '…' : t.payments.save_price}
                      </button>
                    </div>
                  </div>
                );
              })}

              {addingOpen ? (
                <div className="payments-plan-cell manage-plans-add-form">
                  <label className="payments-price-label" htmlFor="new-freq-months">
                    {t.payments.manage_plans_add_freq_months}
                  </label>
                  <select
                    id="new-freq-months"
                    className="manage-plans-add-input"
                    value={newMonths}
                    onChange={(e) => setNewMonths(e.target.value)}
                  >
                    {availableMonths.map((m) => (
                      <option key={m} value={m}>{m === 1 ? '1 mes' : `${m} meses`}</option>
                    ))}
                  </select>
                  <label className="payments-price-label" htmlFor="new-freq-price" style={{ marginTop: 10 }}>
                    {t.payments.manage_plans_add_freq_price}
                  </label>
                  <input
                    id="new-freq-price"
                    type="text"
                    inputMode="numeric"
                    className="manage-plans-add-input"
                    value={formatInputPrice(newPrice, language)}
                    onChange={(e) => setNewPrice(e.target.value.replace(/[^\d]/g, ''))}
                  />
                  <label className="manage-plans-visible-row" style={{ marginTop: 14 }}>
                    <span>{t.payments.manage_plans_visible_label}</span>
                    <span className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={newVisible}
                        onChange={(e) => setNewVisible(e.target.checked)}
                        aria-label={t.payments.manage_plans_visible_label}
                      />
                      <span className="toggle-track">
                        <span className="toggle-thumb" />
                      </span>
                    </span>
                  </label>
                  <div className="payments-plan-actions" style={{ marginTop: 14 }}>
                    <button type="button" className="btn secondary sm" onClick={() => setAddingOpen(false)}>
                      {t.ui.cancel}
                    </button>
                    <button
                      type="button"
                      className="btn sm"
                      disabled={adding || !newMonths || !newPrice}
                      onClick={() => void addFrequency()}
                    >
                      {adding ? '…' : t.payments.manage_plans_add_freq_confirm}
                    </button>
                  </div>
                </div>
              ) : availableMonths.length > 0 ? (
                <button type="button" className="payments-plan-cell manage-plans-add-tile" onClick={openAddForm}>
                  <PlusIcon size={20} />
                  <span>{t.payments.manage_plans_add_freq}</span>
                </button>
              ) : (
                <div className="payments-plan-cell manage-plans-add-tile manage-plans-add-tile--full">
                  <span>{t.payments.manage_plans_add_freq_none}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={!!deleteTarget}
        title={t.payments.manage_plans_delete_title}
        message={t.payments.manage_plans_delete_confirm}
        confirmLabel={t.ui.delete}
        cancelLabel={t.ui.cancel}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteTarget(null)}
        danger
      />

      <ConfirmDialog
        open={!!saveTarget}
        title={t.payments.manage_plans_save_confirm_title}
        message={t.payments.manage_plans_save_confirm_msg}
        confirmLabel={t.payments.save_price}
        cancelLabel={t.ui.cancel}
        onConfirm={() => {
          const plan = saveTarget;
          setSaveTarget(null);
          if (plan) void savePlanPrice(plan);
        }}
        onCancel={() => setSaveTarget(null)}
      />

      <ConfirmDialog
        open={!!toggleTarget}
        title={t.payments.manage_plans_visibility_confirm_title}
        message={
          toggleTarget?.active
            ? t.payments.manage_plans_visibility_confirm_hide
            : t.payments.manage_plans_visibility_confirm_show
        }
        confirmLabel={t.ui.confirm}
        cancelLabel={t.ui.cancel}
        onConfirm={() => {
          const plan = toggleTarget;
          setToggleTarget(null);
          if (plan) void toggleVisible(plan);
        }}
        onCancel={() => setToggleTarget(null)}
      />

      <style>{`
        .manage-plans-modal { width: 100%; max-width: 800px; margin: 0; box-shadow: var(--shadow-hover); max-height: 85vh; overflow-y: auto; }
        .manage-plans-delete-btn {
          position: absolute; top: 10px; right: 10px; width: 26px; height: 26px;
          display: flex; align-items: center; justify-content: center;
          border-radius: var(--radius-sm); border: 1px solid var(--border);
          background: var(--surface); color: var(--text-tertiary); cursor: pointer;
        }
        .manage-plans-delete-btn:hover { color: var(--red, #dc2626); border-color: var(--red, #dc2626); }
        .manage-plans-add-tile {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 8px; border: 1.5px dashed var(--border-strong); background: none;
          color: var(--text-tertiary); cursor: pointer; font-size: 13px; font-weight: 600;
          min-height: 160px; border-radius: var(--radius);
        }
        .manage-plans-add-tile:hover { color: var(--text-primary); border-color: var(--text-tertiary); }
        .manage-plans-add-tile--full { cursor: default; padding: 0 24px; text-align: center; font-weight: 500; }
        .manage-plans-add-tile--full:hover { color: var(--text-tertiary); border-color: var(--border-strong); }
        .manage-plans-add-form { display: flex; flex-direction: column; }
        .manage-plans-add-input {
          width: 100%; padding: 9px 10px; border-radius: var(--radius-sm);
          border: 1px solid var(--border-strong); background: var(--surface);
          color: var(--text-primary); font-size: 14px; margin-top: 4px;
        }
        .manage-plans-visible-row {
          display: flex; align-items: center; justify-content: space-between; gap: 10px;
          font-size: 12.5px; color: var(--text-secondary); cursor: pointer;
        }

        /* Toggle */
        .toggle-switch { position: relative; display: inline-flex; cursor: pointer; flex-shrink: 0; }
        .toggle-switch input { position: absolute; opacity: 0; width: 0; height: 0; }
        .toggle-track {
          width: 36px; height: 20px; border-radius: 10px;
          background: #e2e8f0;
          border: 1.5px solid #cbd5e1;
          transition: background 180ms, border-color 180ms;
          display: flex; align-items: center; padding: 2px;
          box-sizing: border-box;
        }
        .toggle-switch input:checked ~ .toggle-track {
          background: #22c55e;
          border-color: #16a34a;
        }
        .toggle-thumb {
          width: 14px; height: 14px; border-radius: 50%; background: #94a3b8;
          box-shadow: 0 1px 3px rgba(0,0,0,.2); transition: transform 180ms, background 180ms;
          flex-shrink: 0;
        }
        .toggle-switch input:checked ~ .toggle-track .toggle-thumb {
          transform: translateX(16px);
          background: #fff;
        }
        .toggle-switch.saving { opacity: .4; pointer-events: none; }
      `}</style>
    </div>
  );
}
