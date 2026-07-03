import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { PlanRow, SubscriptionRow } from '@reset-fitness/shared/types/database';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from '@/hooks/useTranslation';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { CreditCardIcon } from '@/components/icons';
import { ErrorState, LoadingRows } from '@/components/ui';
import { ManualPaymentModal } from '@/components/ManualPaymentModal';
import { formatMoney, mergePlans, type PlanWithPrice } from '@/lib/planPricing';

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

// ── Page ───────────────────────────────────────────────────────────────────

export function PaymentsPage(): React.JSX.Element {
  const { session } = useAuth();
  const { t, i18n, language } = useTranslation();
  const navigate = useNavigate();
  const userId = session?.user.id;

  const [plans, setPlans] = useState<PlanWithPrice[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [students, setStudents] = useState<StudentMin[]>([]);

  const [regOpen, setRegOpen] = useState(false);

  const locale = language === 'es' ? 'es-AR' : 'en-US';

  const { data, loading, error, refetch } = useSupabaseQuery<PaymentsData>(
    async () => {
      const [
        { data: planRows, error: plansError },
        { data: overrideRows, error: overridesError },
        { data: students, error: studentsError },
      ] = await Promise.all([
        // Sin filtro de `active`: el modal de "Registrar pago" necesita poder
        // resolver Mentoría/2-4-5 meses.
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
          .select('id, user_id, plan_id, status, started_at, created_at, mp_preapproval_id')
          .in('user_id', studentIds)
          .neq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(100);

        if (subsError) throw subsError;

        const planById = new Map(mergedPlans.map((p) => [p.id, p]));
        const allSubs = (subs as (Pick<SubscriptionRow, 'id' | 'user_id' | 'plan_id' | 'status' | 'started_at' | 'created_at'> & { mp_preapproval_id: string | null })[] | null) ?? [];

        // Suscripciones de pago único/manual: la fila de `subscriptions` ES el pago.
        const oneTimeRows: PaymentRow[] = allSubs
          .filter((sub) => !sub.mp_preapproval_id)
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

        // Suscripciones recurrentes: cada cobro mensual en `subscription_charges`
        // es su propia fila (una suscripción activa genera muchos cobros).
        const recurringSubs = allSubs.filter((sub) => sub.mp_preapproval_id);
        let chargeRows: PaymentRow[] = [];
        if (recurringSubs.length > 0) {
          const subById = new Map(recurringSubs.map((s) => [s.id, s]));
          const { data: charges, error: chargesError } = await supabase
            .from('subscription_charges')
            .select('id, subscription_id, amount_ars, status, charged_at')
            .in('subscription_id', recurringSubs.map((s) => s.id))
            .order('charged_at', { ascending: false })
            .limit(200);
          if (chargesError) throw chargesError;

          chargeRows = ((charges as { id: string; subscription_id: string; amount_ars: number | null; status: string | null; charged_at: string }[] | null) ?? [])
            .map((charge) => {
              const sub = subById.get(charge.subscription_id);
              const plan = sub ? planById.get(sub.plan_id) : undefined;
              const status: PaymentRow['status'] =
                charge.status === 'processed' || charge.status === 'approved'
                  ? 'paid'
                  : charge.status === 'rejected' || charge.status === 'cancelled'
                    ? 'cancelled'
                    : 'pending';
              return {
                id: charge.id,
                studentId: sub?.user_id ?? '',
                studentName: sub ? (studentMap.get(sub.user_id) ?? '—') : '—',
                planName: plan?.name ?? sub?.plan_id ?? '—',
                amount: charge.amount_ars ?? plan?.effectivePrice ?? 0,
                date: charge.charged_at,
                status,
              };
            })
            .filter((row) => !!row.studentId);
        }

        paymentRows = [...oneTimeRows, ...chargeRows].sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
        );
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

  return (
    <div className="payments-page">
      <header className="payments-header">
        <div className="payments-header-text">
          <h1 className="page-title">{t.payments.title}</h1>
          <p className="page-sub payments-header-sub">{t.payments.sub}</p>
        </div>
        <div className="payments-header-actions">
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
