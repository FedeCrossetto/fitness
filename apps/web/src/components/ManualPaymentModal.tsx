import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useTranslation } from '@/hooks/useTranslation';
import { useToast } from '@/hooks/useToast';
import type { PlanRow, PlanType } from '@reset-fitness/shared/types/database';

export type ManualPaymentStudent = { id: string; full_name: string | null };

interface ManualPaymentModalProps {
  open: boolean;
  onClose: () => void;
  students: ManualPaymentStudent[];
  plans: PlanRow[];
  initialStudentId?: string;
  onSuccess?: () => void;
}

const MONTH_OPTIONS = [1, 2, 3, 4, 5, 6];

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
  const [planType, setPlanType] = useState<PlanType>('base');
  const [months, setMonths] = useState(1);
  const [overrideAmount, setOverrideAmount] = useState(false);
  const [amountArs, setAmountArs] = useState('');
  const [startedOn, setStartedOn] = useState(todayInputValue());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStudentId(initialStudentId ?? students[0]?.id ?? '');
    setPlanType('base');
    setMonths(1);
    setOverrideAmount(false);
    setStartedOn(todayInputValue());
  }, [open, initialStudentId, students]);

  const resolvedPlan = useMemo(
    () => plans.find((p) => p.plan_type === planType && p.duration_days === months * 30) ?? null,
    [plans, planType, months],
  );

  // El monto se autocompleta desde el catálogo salvo que el entrenador tilde
  // el override (ej. lo acordado en la llamada difiere de lo registrado).
  useEffect(() => {
    if (overrideAmount) return;
    setAmountArs(resolvedPlan ? String(Math.round(Number(resolvedPlan.price_ars))) : '');
  }, [resolvedPlan, overrideAmount]);

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
    const amount = Number(amountArs);
    if (!studentId || !resolvedPlan || !amount || submitting) return;
    setSubmitting(true);
    const { error } = await supabase.rpc('register_manual_payment', {
      p_client_id: studentId,
      p_plan_id: resolvedPlan.id,
      p_started_at: dateInputToIso(startedOn),
      p_amount_ars: amount,
    });
    setSubmitting(false);
    if (error) {
      showToast('error', t.payments.register_error);
      return;
    }
    showToast('success', t.payments.register_success);
    onClose();
    onSuccess?.();
  }, [studentId, resolvedPlan, amountArs, startedOn, submitting, showToast, t.payments.register_error, t.payments.register_success, onClose, onSuccess]);

  if (!open) return null;

  const selectedStudent = students.find((s) => s.id === studentId);

  return (
    <div className="pay-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="pay-modal card" onClick={(e) => e.stopPropagation()}>
        <h2 className="payments-panel-title">{t.payments.register_title}</h2>
        <p className="payments-panel-sub" style={{ marginBottom: 18 }}>{t.payments.register_sub}</p>
        {students.length === 0 ? (
          <p className="muted" style={{ margin: '8px 0 18px' }}>{t.payments.register_no_students}</p>
        ) : (
          <>
            {students.length === 1 ? (
              <label className="pay-modal-field">
                <span>{t.payments.register_student}</span>
                <div className="pay-modal-fixed-student">{selectedStudent?.full_name ?? '—'}</div>
              </label>
            ) : (
              <label className="pay-modal-field">
                <span>{t.payments.register_student}</span>
                <select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>{s.full_name ?? '—'}</option>
                  ))}
                </select>
              </label>
            )}

            <label className="pay-modal-field">
              <span>{t.payments.register_plan_type}</span>
              <select value={planType} onChange={(e) => setPlanType(e.target.value as PlanType)}>
                <option value="base">Base</option>
                <option value="mentoria">Mentoría 1 a 1</option>
              </select>
            </label>

            <label className="pay-modal-field">
              <span>{t.payments.register_frequency}</span>
              <select value={months} onChange={(e) => setMonths(Number(e.target.value))}>
                {MONTH_OPTIONS.map((m) => (
                  <option key={m} value={m}>{m === 1 ? '1 mes' : `${m} meses`}</option>
                ))}
              </select>
            </label>

            <label className="pay-modal-field">
              <span>{t.payments.register_amount}</span>
              <input
                type="number"
                inputMode="numeric"
                value={amountArs}
                disabled={!overrideAmount}
                onChange={(e) => setAmountArs(e.target.value)}
              />
            </label>
            <label className="pay-modal-checkbox">
              <input
                type="checkbox"
                checked={overrideAmount}
                onChange={(e) => setOverrideAmount(e.target.checked)}
              />
              <span>{t.payments.register_override}</span>
            </label>
            {!resolvedPlan ? (
              <p className="muted" style={{ margin: '0 0 12px', fontSize: 13 }}>
                No hay precio de referencia cargado para esta combinación — ingresá el monto manualmente.
              </p>
            ) : null}

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
            {resolvedPlan && !overrideAmount ? (
              <p className="muted" style={{ margin: '0 0 12px', fontSize: 13 }}>
                Precio de referencia: {formatMoney(Number(resolvedPlan.price_ars))}
              </p>
            ) : null}
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
            disabled={submitting || !studentId || !amountArs || students.length === 0}
          >
            {submitting ? '…' : t.payments.register_confirm}
          </button>
        </div>
      </div>
    </div>
  );
}
