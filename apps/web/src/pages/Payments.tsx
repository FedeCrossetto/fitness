import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { PlanRow, SubscriptionRow } from '@reset-fitness/shared/types/database';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from '@/hooks/useTranslation';
import { useToast } from '@/hooks/useToast';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { CreditCardIcon } from '@/components/icons';
import { ErrorState, LoadingRows } from '@/components/ui';
import { ManualPaymentModal } from '@/components/ManualPaymentModal';
import { formatInputPrice, formatMoney, mergePlans, type PlanWithPrice } from '@/lib/planPricing';

// ── Types ──────────────────────────────────────────────────────────────────

type StudentMin = { id: string; full_name: string | null };

type PaymentRow = {
  id: string;
  studentId: string;
  studentName: string;
  planName: string;
  amount: number;
  date: string;
  status: 'paid' | 'pending' | 'overdue' | 'cancelled';
};

type PaymentsData = {
  plans: PlanWithPrice[];
  payments: PaymentRow[];
  students: StudentMin[];
};

// ── Helpers ────────────────────────────────────────────────────────────────

function mapStatus(status: SubscriptionRow['status']): PaymentRow['status'] {
  if (status === 'active') return 'paid';
  if (status === 'pending') return 'pending';
  if (status === 'expired') return 'overdue';
  return 'cancelled';
}

function isThisMonth(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

function planAccent(id: string): string {
  if (id === 'quarterly') return 'payments-plan-cell--featured';
  if (id === 'semiannual') return 'payments-plan-cell--value';
  return '';
}

// Isotipo de MercadoPago (óvalo celeste + handshake).
function MpLogo({ size = 20 }: { size?: number }): React.JSX.Element {
  // Logo oficial de MercadoPago: wordmark "mercado pago" en azul + amarillo
  return (
    <svg width={size * 3.6} height={size} viewBox="0 0 108 30" fill="none" aria-hidden style={{ flexShrink: 0 }}>
      {/* Isotipo — círculo azul con onda */}
      <circle cx="15" cy="15" r="15" fill="#009EE3" />
      <path
        d="M8.5 16.2c1.6-3.2 5-5.2 8.7-4.6 2 .3 3.8 1.4 5 3l-2.1 1.5c-.8-1.1-2-1.8-3.4-1.9-2.1-.2-4 1-4.8 2.9L8.5 16.2z"
        fill="#fff"
      />
      <path
        d="M22.2 14.6c.5 1 .7 2.1.5 3.2-.4 2.4-2.4 4.2-4.8 4.4-1.5.1-3-.5-4-1.6l2.1-1.5c.5.5 1.2.8 2 .8 1.2-.1 2.2-1 2.5-2.2l2.1 1.5-.4-4.6z"
        fill="#FFE600"
      />
      {/* Wordmark "mercado" */}
      <text x="35" y="20" fontFamily="system-ui, sans-serif" fontSize="11" fontWeight="700" fill="#009EE3" letterSpacing="-0.2">mercado</text>
      {/* Wordmark "pago" */}
      <text x="35" y="30" fontFamily="system-ui, sans-serif" fontSize="11" fontWeight="700" fill="#009EE3" letterSpacing="-0.2" opacity="0.75">pago</text>
    </svg>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export function PaymentsPage(): React.JSX.Element {
  const { session } = useAuth();
  const { t, i18n, language } = useTranslation();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const userId = session?.user.id;

  const [plans, setPlans] = useState<PlanWithPrice[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [students, setStudents] = useState<StudentMin[]>([]);
  const [savingPlanId, setSavingPlanId] = useState<string | null>(null);

  const [regOpen, setRegOpen] = useState(false);

  // Conexión MercadoPago (OAuth)
  const [mpConnected, setMpConnected] = useState(false);
  const [mpBusy, setMpBusy] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  // Estado de conexión MP del entrenador.
  useEffect(() => {
    if (!userId) return;
    void (async () => {
      const { data } = await supabase.rpc('trainer_mp_connected');
      setMpConnected(data === true);
    })();
  }, [userId]);

  // Resultado del callback OAuth (?mp=connected | error).
  useEffect(() => {
    const mp = searchParams.get('mp');
    if (!mp) return;
    if (mp === 'connected') {
      setMpConnected(true);
      showToast('success', t.payments.mp_connected_toast);
    } else {
      showToast('error', t.payments.mp_error_toast);
    }
    searchParams.delete('mp');
    setSearchParams(searchParams, { replace: true });
  }, [searchParams, setSearchParams, showToast, t.payments.mp_connected_toast, t.payments.mp_error_toast]);

  const connectMercadoPago = useCallback(async () => {
    setMpBusy(true);
    const { data, error: fnError } = await supabase.functions.invoke<{ authUrl: string }>('mp-oauth-start');
    setMpBusy(false);
    if (fnError || !data?.authUrl) {
      showToast('error', t.payments.mp_connect_error);
      return;
    }
    window.location.href = data.authUrl; // redirige a MercadoPago para autorizar
  }, [showToast, t.payments.mp_connect_error]);

  const locale = language === 'es' ? 'es-AR' : 'en-US';

  const { data, loading, error, refetch } = useSupabaseQuery<PaymentsData>(
    async () => {
      const [
        { data: planRows, error: plansError },
        { data: overrideRows, error: overridesError },
        { data: students, error: studentsError },
      ] = await Promise.all([
        // Sin filtro de `active`: el modal de "Registrar pago" necesita poder
        // resolver Mentoría/2-4-5 meses; la grilla de precios de abajo sigue
        // mostrando solo los planes Base activos (se filtra en memoria).
        supabase.from('plans').select('*').order('duration_days'),
        supabase.from('trainer_plan_prices').select('plan_id, price_ars').eq('trainer_id', userId!),
        supabase
          .from('profiles')
          .select('id, full_name')
          .eq('trainer_id', userId!),
      ]);

      if (plansError) throw plansError;
      if (overridesError) throw overridesError;
      if (studentsError) throw studentsError;

      const mergedPlans = mergePlans(
        (planRows as PlanRow[] | null) ?? [],
        (overrideRows as { plan_id: string; price_ars: number }[] | null) ?? [],
      );

      const studentMap = new Map(
        ((students as StudentMin[] | null) ?? []).map((s) => [s.id, s.full_name ?? '—']),
      );
      const studentIds = [...studentMap.keys()];

      let paymentRows: PaymentRow[] = [];
      if (studentIds.length > 0) {
        const { data: subs, error: subsError } = await supabase
          .from('subscriptions')
          .select('id, user_id, plan_id, status, started_at, created_at')
          .in('user_id', studentIds)
          .neq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(100);

        if (subsError) throw subsError;

        const planById = new Map(mergedPlans.map((p) => [p.id, p]));

        paymentRows = ((subs as Pick<SubscriptionRow, 'id' | 'user_id' | 'plan_id' | 'status' | 'started_at' | 'created_at'>[] | null) ?? [])
          .map((sub) => {
            const plan = planById.get(sub.plan_id);
            return {
              id: sub.id,
              studentId: sub.user_id,
              studentName: studentMap.get(sub.user_id) ?? '—',
              planName: plan?.name ?? sub.plan_id,
              amount: plan?.effectivePrice ?? 0,
              date: sub.started_at ?? sub.created_at,
              status: mapStatus(sub.status),
            };
          });
      }

      return { plans: mergedPlans, payments: paymentRows, students: (students as StudentMin[] | null) ?? [] };
    },
    [userId],
    { enabled: !!userId },
  );

  useEffect(() => {
    if (data) {
      setPlans(data.plans);
      setPayments(data.payments);
      setStudents(data.students);
    }
  }, [data]);

  const openRegister = () => {
    setRegOpen(true);
  };

  const stats = useMemo(() => {
    const collected = payments
      .filter((p) => p.status === 'paid' && isThisMonth(p.date))
      .reduce((sum, p) => sum + p.amount, 0);
    const pending = payments
      .filter((p) => p.status === 'pending')
      .reduce((sum, p) => sum + p.amount, 0);
    return { collected, pending, count: payments.length };
  }, [payments]);

  const statusLabel: Record<PaymentRow['status'], string> = {
    paid: t.payments.status_paid,
    pending: t.payments.status_pending,
    overdue: t.payments.status_overdue,
    cancelled: t.payments.status_cancelled,
  };

  const statusClass: Record<PaymentRow['status'], string> = {
    paid: 'pay-badge pay-badge--paid',
    pending: 'pay-badge pay-badge--pending',
    overdue: 'pay-badge pay-badge--overdue',
    cancelled: 'pay-badge pay-badge--cancelled',
  };

  // Grilla editable: solo los planes Base activos de siempre (Mentoría y las
  // frecuencias nuevas se ajustan directo en la base por ahora).
  const priceGridPlans = useMemo(
    () => plans.filter((p) => p.plan_type === 'base' && p.active),
    [plans],
  );

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
        prev.map((p) =>
          p.id === plan.id
            ? { ...p, effectivePrice: price, hasOverride: true, draftPrice: String(price) }
            : p,
        ),
      );
      setPayments((prev) =>
        prev.map((row) =>
          row.planName === plan.name ? { ...row, amount: price } : row,
        ),
      );
      showToast('success', t.payments.price_saved);
    } catch {
      showToast('error', t.payments.price_error);
    } finally {
      setSavingPlanId(null);
    }
  }, [userId, showToast, t.payments.price_error, t.payments.price_saved]);

  return (
    <div className="payments-page">
      <header className="payments-header">
        <div className="payments-header-text">
          <h1 className="page-title">{t.payments.title}</h1>
          <p className="page-sub payments-header-sub">{t.payments.sub}</p>
        </div>
        <div className="payments-header-actions">
          {mpConnected ? (
            <span className="payments-mp-badge">
              <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden style={{ flexShrink: 0 }}>
                <circle cx="4" cy="4" r="4" fill="currentColor" />
              </svg>
              {t.payments.mp_connected}
            </span>
          ) : (
            <button className="btn btn-mp" onClick={() => void connectMercadoPago()} disabled={mpBusy}>
              {mpBusy ? <span className="btn-mp-busy">…</span> : <MpLogo size={16} />}
            </button>
          )}
          <button className="btn" onClick={openRegister} disabled={loading || !!error}>
            {t.payments.register_payment}
          </button>
        </div>
      </header>

      {error ? (
        <ErrorState message={t.payments.load_error} onRetry={refetch} />
      ) : loading ? (
        <LoadingRows rows={4} />
      ) : (
        <div className="payments-body">
          <div className="payments-stats-strip">
            <div className="payments-stat-block">
              <span className="payments-stat-block-label">{t.payments.collected_month}</span>
              <span className="payments-stat-block-value">{formatMoney(stats.collected, language)}</span>
            </div>
            <div className="payments-stat-block">
              <span className="payments-stat-block-label">{t.payments.pending_total}</span>
              <span className="payments-stat-block-value">
                {formatMoney(stats.pending, language)}
              </span>
            </div>
            <div className="payments-stat-block">
              <span className="payments-stat-block-label">{t.payments.transactions}</span>
              <span className="payments-stat-block-value">{stats.count}</span>
            </div>
          </div>

          <section className="payments-plans-panel">
            <div className="payments-panel-head" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <h2 className="payments-panel-title">{t.payments.plans_title}</h2>
                <p className="payments-panel-sub">{t.payments.plans_sub}</p>
              </div>
              <button type="button" className="btn secondary sm" onClick={() => navigate('/payments/planes')}>
                {t.payments.manage_plans_link}
              </button>
            </div>
            <div className="payments-plans-row">
              {priceGridPlans.map((plan) => {
                const months = Math.max(1, Math.round(plan.duration_days / 30));
                const perMonth = Math.round(plan.effectivePrice / months);
                const dirty = plan.draftPrice !== String(Math.round(plan.effectivePrice));
                const saving = savingPlanId === plan.id;
                return (
                  <div
                    key={plan.id}
                    className={`payments-plan-cell ${planAccent(plan.id)}`}
                  >
                    <div className="payments-plan-cell-head">
                      <span className="payments-plan-name">{plan.name}</span>
                      <span className="payments-plan-duration">
                        {i18n(t.payments.duration_days, { n: plan.duration_days })}
                      </span>
                    </div>
                    {plan.hasOverride ? (
                      <span className="payments-custom-tag">{t.payments.custom_price}</span>
                    ) : null}
                    {plan.description ? (
                      <p className="payments-plan-desc">{plan.description}</p>
                    ) : null}
                    <div className="payments-price-field">
                      <label className="payments-price-label" htmlFor={`price-${plan.id}`}>
                        ARS
                      </label>
                      <div className={`payments-price-input-wrap${dirty ? ' dirty' : ''}`}>
                        <span className="payments-price-currency">$</span>
                        <input
                          id={`price-${plan.id}`}
                          type="text"
                          inputMode="numeric"
                          className="payments-price-input"
                          value={formatInputPrice(plan.draftPrice, language)}
                          onChange={(e) => updateDraftPrice(plan.id, e.target.value)}
                          aria-label={plan.name}
                        />
                      </div>
                    </div>
                    <div className="payments-plan-actions">
                      <span className="payments-plan-foot">
                        {i18n(t.payments.per_month, { price: formatMoney(perMonth, language) })}
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

          <section className="card payments-history-card">
            <div className="payments-panel-head payments-panel-head--table">
              <h2 className="payments-panel-title">{t.payments.history_title}</h2>
              <span className="payments-history-count">
                {i18n(t.payments.history_count, { n: payments.length })}
              </span>
            </div>

            {payments.length === 0 ? (
              <div className="payments-empty">
                <div className="payments-empty-icon">
                  <CreditCardIcon size={22} />
                </div>
                <p className="payments-empty-title">{t.payments.empty_history}</p>
                <p className="payments-empty-sub">{t.payments.empty_history_sub}</p>
              </div>
            ) : (
              <div className="payments-table-wrap">
                <table className="payments-table">
                  <thead>
                    <tr>
                      <th>{t.payments.col_student}</th>
                      <th>{t.payments.col_plan}</th>
                      <th>{t.payments.col_amount}</th>
                      <th>{t.payments.col_date}</th>
                      <th>{t.payments.col_status}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr
                        key={p.id}
                        className="payments-table-row"
                        onClick={() => navigate(`/students/${p.studentId}`)}
                      >
                        <td><span className="cell-name">{p.studentName}</span></td>
                        <td className="muted">{p.planName}</td>
                        <td className="payments-amount">{formatMoney(p.amount, language)}</td>
                        <td className="muted">
                          <span>{new Date(p.date).toLocaleDateString(locale)}</span>
                          <span className="payments-time">
                            {new Date(p.date).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </td>
                        <td>
                          <span className={statusClass[p.status]}>{statusLabel[p.status]}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      <ManualPaymentModal
        open={regOpen}
        onClose={() => setRegOpen(false)}
        students={students}
        plans={plans.map((p) => ({ ...p, price_ars: p.effectivePrice }))}
        onSuccess={() => void refetch()}
      />
    </div>
  );
}
