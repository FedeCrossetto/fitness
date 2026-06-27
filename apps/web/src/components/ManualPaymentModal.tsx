import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useTranslation } from '@/hooks/useTranslation';
import { useToast } from '@/hooks/useToast';
import type { PlanRow } from '@reset-fitness/shared/types/database';

export type ManualPaymentStudent = { id: string; full_name: string | null };

interface ManualPaymentModalProps {
  open: boolean;
  onClose: () => void;
  students: ManualPaymentStudent[];
  plans: PlanRow[];
  initialStudentId?: string;
  onSuccess?: () => void;
}

function todayInputValue(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dateInputToIso(date: string): string {
  return new Date(`${date}T12:00:00`).toISOString();
}

export function ManualPaymentModal({
  open,
  onClose,
  students,
  plans,
  initialStudentId,
  onSuccess,
}: ManualPaymentModalProps): React.JSX.Element | null {
  const { t, i18n, language } = useTranslation();
  const { showToast } = useToast();

  const [studentId, setStudentId] = useState('');
  const [planId, setPlanId] = useState('');
  const [startedOn, setStartedOn] = useState(todayInputValue());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStudentId(initialStudentId ?? students[0]?.id ?? '');
    setPlanId(plans[0]?.id ?? '');
    setStartedOn(todayInputValue());
  }, [open, initialStudentId, students, plans]);

  const formatMoney = useCallback(
    (amount: number) =>
      new Intl.NumberFormat(language === 'es' ? 'es-AR' : 'en-US', {
        style: 'currency',
        currency: 'ARS',
        maximumFractionDigits: 0,
      }).format(amount),
    [language],
  );

  const submit = useCallback(async () => {
    if (!studentId || !planId || submitting) return;
    setSubmitting(true);
    const { error } = await supabase.rpc('register_manual_payment', {
      p_client_id: studentId,
      p_plan_id: planId,
      p_started_at: dateInputToIso(startedOn),
    });
    setSubmitting(false);
    if (error) {
      showToast('error', t.payments.register_error);
      return;
    }
    showToast('success', t.payments.register_success);
    onClose();
    onSuccess?.();
  }, [studentId, planId, startedOn, submitting, showToast, t.payments.register_error, t.payments.register_success, onClose, onSuccess]);

  if (!open) return null;

  return (
    <div className="pay-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="pay-modal card" onClick={(e) => e.stopPropagation()}>
        <h2 className="payments-panel-title">{t.payments.register_title}</h2>
        <p className="payments-panel-sub" style={{ marginBottom: 18 }}>{t.payments.register_sub}</p>
        {students.length === 0 ? (
          <p className="muted" style={{ margin: '8px 0 18px' }}>{t.payments.register_no_students}</p>
        ) : (
          <>
            <label className="pay-modal-field">
              <span>{t.payments.register_student}</span>
              <select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>{s.full_name ?? '—'}</option>
                ))}
              </select>
            </label>
            <label className="pay-modal-field">
              <span>{t.payments.register_plan}</span>
              <select value={planId} onChange={(e) => setPlanId(e.target.value)}>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {formatMoney(Number(p.price_ars))}
                  </option>
                ))}
              </select>
            </label>
            <label className="pay-modal-field">
              <span>{t.payments.register_date}</span>
              <input
                type="date"
                value={startedOn}
                max={todayInputValue()}
                onChange={(e) => setStartedOn(e.target.value)}
              />
            </label>
            <p className="muted" style={{ margin: '0 0 12px', fontSize: 13 }}>
              {i18n(t.payments.register_date_hint, {
                date: new Date(`${startedOn}T12:00:00`).toLocaleDateString(language === 'es' ? 'es-AR' : 'en-US'),
              })}
            </p>
          </>
        )}
        <div className="pay-modal-actions">
          <button type="button" className="btn secondary" onClick={onClose}>
            {t.ui.cancel}
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => void submit()}
            disabled={submitting || !studentId || !planId || students.length === 0}
          >
            {submitting ? '…' : t.payments.register_confirm}
          </button>
        </div>
      </div>
    </div>
  );
}
