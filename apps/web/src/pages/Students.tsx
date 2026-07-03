import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import type { PlanRow, ProfileRow } from '@reset-fitness/shared/types/database';
import { ManualPaymentModal } from '@/components/ManualPaymentModal';
import { supabase, anyClient } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from '@/hooks/useTranslation';
import { useToast } from '@/hooks/useToast';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { buildInviteLink, getJoinBaseUrl } from '@/lib/inviteClient';
import { deleteClientAccount } from '@/lib/clientAccounts';
import { resolveAvatarUrl, initials } from '@/lib/avatarUrl';
import { ErrorState, LoadingRows } from '@/components/ui';
import { ChevronRightIcon, SearchIcon, TrashIcon, UsersIcon } from '@/components/icons';

type Student = Pick<ProfileRow, 'id' | 'full_name' | 'goal' | 'created_at' | 'avatar_url'> & {
  client_status: 'pending' | 'active';
};

type StudentPlan =
  | { kind: 'base'; label: string }
  | { kind: 'mentoria'; label: string }
  | { kind: 'none' };

function PlanBadge({ plan }: { plan: StudentPlan }): React.JSX.Element {
  if (plan.kind === 'none') return <span className="muted">—</span>;
  return (
    <span className={`plan-badge${plan.kind === 'mentoria' ? ' mentoria' : ''}`}>
      {plan.label}
    </span>
  );
}

function StudentAvatar({ name, url, style }: { name: string | null; url?: string | null; style?: React.CSSProperties }): React.JSX.Element {
  const resolved = resolveAvatarUrl(url);
  if (resolved) {
    return (
      <span className="avatar sm" style={{ padding: 0, overflow: 'hidden', ...style }}>
        <img src={resolved} alt={name ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} />
      </span>
    );
  }
  return <span className="avatar sm" style={style}>{initials(name)}</span>;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86400000);
  if (d === 0) return 'Hoy';
  if (d === 1) return 'Ayer';
  if (d < 30) return `Hace ${d} días`;
  const m = Math.floor(d / 30);
  return `Hace ${m} mes${m > 1 ? 'es' : ''}`;
}

function ClientRowActions({
  onOpen,
  onDelete,
}: {
  onOpen: () => void;
  onDelete: () => void;
}): React.JSX.Element {
  return (
    <div className="client-row-actions" onClick={(e) => e.stopPropagation()}>
      <button type="button" className="client-row-open" onClick={onOpen} aria-label="Abrir perfil" title="Abrir">
        <ChevronRightIcon size={17} />
      </button>
      <button type="button" className="client-row-trash" onClick={onDelete} aria-label="Eliminar cliente" title="Eliminar">
        <TrashIcon size={15} />
      </button>
    </div>
  );
}

export function StudentsPage(): React.JSX.Element {
  const { session } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [searchParams] = useSearchParams();
  const userId = session?.user.id;
  const [students, setStudents] = useState<Student[]>([]);
  const [query, setQuery] = useState(searchParams.get('q') ?? '');
  const [tab, setTab] = useState<'active' | 'pending'>(() =>
    searchParams.get('tab') === 'pending' ? 'pending' : 'active',
  );
  const [manualPayOpen, setManualPayOpen] = useState(false);
  const [manualPayStudentId, setManualPayStudentId] = useState<string | null>(null);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [activeSubByStudent, setActiveSubByStudent] = useState<Map<string, string>>(new Map());
  const [evaluationByStudent, setEvaluationByStudent] = useState<Map<string, { id: string; status: string }>>(new Map());

  const inviteLink = inviteCode ? buildInviteLink(inviteCode, getJoinBaseUrl()) : null;

  useEffect(() => { setQuery(searchParams.get('q') ?? ''); }, [searchParams]);
  useEffect(() => {
    if (searchParams.get('tab') === 'pending') setTab('pending');
  }, [searchParams]);

  const { data: studentsData, loading, error, refetch } = useSupabaseQuery<Student[]>(
    async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, goal, created_at, client_status, avatar_url')
        .eq('trainer_id', userId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data as Student[] | null) ?? [];
    },
    [userId],
    { enabled: !!userId },
  );

  useEffect(() => { if (studentsData) setStudents(studentsData); }, [studentsData]);

  useEffect(() => {
    if (!userId) return;
    void (async () => {
      const [{ data: branding }, { data: planRows }] = await Promise.all([
        supabase.from('trainer_branding').select('invite_code').eq('trainer_id', userId).maybeSingle(),
        // Sin filtro de `active`: ManualPaymentModal necesita poder resolver
        // cualquier combinación de Plan × Frecuencia del catálogo, incluidas
        // las que no están habilitadas para el checkout self-service de mobile.
        supabase.from('plans').select('*').order('duration_days'),
      ]);
      if (branding && 'invite_code' in branding) {
        setInviteCode((branding as { invite_code: string }).invite_code);
      }
      setPlans((planRows as PlanRow[] | null) ?? []);
    })();
  }, [userId]);

  // Plan que cada alumno eligió al crear la cuenta: "Plan Base" viene de una
  // suscripción activa; "Mentoría 1 a 1" no es una suscripción, es un lead
  // capturado en evaluation_requests (el entrenador lo procesa manualmente).
  useEffect(() => {
    if (!userId || !studentsData || studentsData.length === 0) return;
    const studentIds = studentsData.map((s) => s.id);
    void (async () => {
      const [{ data: subRows }, { data: evalRows }] = await Promise.all([
        supabase
          .from('subscriptions')
          .select('user_id, plan_id, status, expires_at, created_at')
          .in('user_id', studentIds)
          .eq('status', 'active')
          .order('created_at', { ascending: false }),
        supabase
          .from('evaluation_requests')
          .select('id, client_id, status, created_at')
          .eq('trainer_id', userId)
          .order('created_at', { ascending: false }),
      ]);

      const subMap = new Map<string, string>();
      for (const row of (subRows as { user_id: string; plan_id: string; expires_at: string | null }[] | null) ?? []) {
        if (subMap.has(row.user_id)) continue;
        if (row.expires_at && new Date(row.expires_at) < new Date()) continue;
        subMap.set(row.user_id, row.plan_id);
      }
      setActiveSubByStudent(subMap);

      const evalMap = new Map<string, { id: string; status: string }>();
      for (const row of (evalRows as { id: string; client_id: string; status: string }[] | null) ?? []) {
        if (!evalMap.has(row.client_id)) evalMap.set(row.client_id, { id: row.id, status: row.status });
      }
      setEvaluationByStudent(evalMap);
    })();
  }, [userId, studentsData]);

  const planByStudent = useMemo(() => {
    const map = new Map<string, StudentPlan>();
    for (const s of students) {
      const planId = activeSubByStudent.get(s.id);
      const planRow = planId ? plans.find((p) => p.id === planId) : undefined;
      if (planRow) {
        map.set(s.id, {
          kind: planRow.plan_type === 'mentoria' ? 'mentoria' : 'base',
          label: planRow.plan_type === 'mentoria' ? 'Mentoría 1 a 1' : 'Base',
        });
      } else if (evaluationByStudent.has(s.id)) {
        map.set(s.id, { kind: 'mentoria', label: 'Mentoría 1 a 1' });
      } else {
        map.set(s.id, { kind: 'none' });
      }
    }
    return map;
  }, [students, activeSubByStudent, evaluationByStudent, plans]);

  // Frecuencia de facturación de la suscripción activa (solo Activos) —
  // en Pendientes queda en blanco hasta que se active al alumno.
  const billingByStudent = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of students) {
      const planId = activeSubByStudent.get(s.id);
      const planRow = planId ? plans.find((p) => p.id === planId) : undefined;
      if (!planRow) continue;
      const months = Math.max(1, Math.round(planRow.duration_days / 30));
      map.set(s.id, months === 1 ? '1 mes' : `${months} meses`);
    }
    return map;
  }, [students, activeSubByStudent, plans]);

  const markEvaluationCompleted = async (studentId: string) => {
    const row = evaluationByStudent.get(studentId);
    if (!row) return;
    const { error } = await anyClient.from('evaluation_requests').update({ status: 'completed' }).eq('id', row.id);
    if (error) {
      showToast('error', 'No pudimos actualizar el estado de la reunión.');
      return;
    }
    setEvaluationByStudent((prev) => {
      const next = new Map(prev);
      next.set(studentId, { ...row, status: 'completed' });
      return next;
    });
    showToast('success', 'Reunión marcada como hecha');
  };

  const copyLink = () => {
    if (!inviteLink) return;
    void navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openManualPayment = (id: string) => {
    setManualPayStudentId(id);
    setManualPayOpen(true);
  };

  const onManualPaymentSuccess = () => {
    if (!manualPayStudentId) return;
    setStudents((prev) => prev.map((s) => (
      s.id === manualPayStudentId ? { ...s, client_status: 'active' } : s
    )));
    void refetch();
  };

  const removeClient = async (id: string) => {
    setDeletingId(id);
    setDeleteError(null);
    const result = await deleteClientAccount(id);
    if (result.ok) {
      setStudents((prev) => prev.filter((s) => s.id !== id));
      setConfirmDeleteId(null);
      showToast('success', 'Cliente eliminado');
    } else {
      setDeleteError(result.message);
    }
    setDeletingId(null);
  };

  const clientToDelete = confirmDeleteId ? students.find((s) => s.id === confirmDeleteId) : null;

  const active  = useMemo(() => students.filter((s) => s.client_status === 'active'), [students]);
  const pending = useMemo(() => students.filter((s) => s.client_status === 'pending'), [students]);
  const current = tab === 'active' ? active : pending;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return current;
    return current.filter(
      (s) => (s.full_name ?? '').toLowerCase().includes(q) || (s.goal ?? '').toLowerCase().includes(q)
    );
  }, [current, query]);

  return (
    <div>
      <div className="students-page-header">
        <div>
          <h1 className="page-title">{t.web.clients}</h1>
          <p className="page-sub">{t.web.clients_sub}</p>
        </div>
      </div>

      {/* Invite banner */}
      {inviteCode && inviteLink && (
        <div className="invite-banner">
          <div className="invite-banner-text">
            <div className="invite-banner-title">Link de invitación</div>
            <div className="invite-banner-sub">
              Compartilo por WhatsApp o email. El alumno se registra con Google o email y queda vinculado automáticamente.
            </div>
          </div>
          <div className="invite-banner-row">
            <input
              readOnly
              className="invite-link-input"
              value={inviteLink}
              aria-label="Link de invitación"
              onFocus={(e) => e.target.select()}
            />
            <div className="invite-banner-btns">
              <button type="button" className="btn secondary sm" onClick={copyLink}>
                {copied ? 'Copiado' : 'Copiar'}
              </button>
              <button
                type="button"
                className="btn secondary sm"
                onClick={() => setShowQR((v) => !v)}
              >
                QR
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR modal */}
      {showQR && inviteLink && (
        <div className="invite-qr-backdrop" onClick={() => setShowQR(false)}>
          <div className="invite-qr-modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>QR de invitación</div>
            <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 20 }}>
              El alumno escanea y se registra con Google o email en un minuto
            </div>
            <QRCodeSVG value={inviteLink} size={200} />
            <div style={{ marginTop: 16, fontSize: 11, color: 'var(--text-tertiary)', wordBreak: 'break-all', textAlign: 'center', padding: '0 8px' }}>
              {inviteLink}
            </div>
            <button className="btn secondary" style={{ marginTop: 20, width: '100%' }} onClick={() => setShowQR(false)}>
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="students-tabs">
        <button
          className={`students-tab${tab === 'active' ? ' active' : ''}`}
          onClick={() => setTab('active')}
        >
          Activos
          <span className="students-tab-count">{active.length}</span>
        </button>
        <button
          className={`students-tab${tab === 'pending' ? ' active' : ''}`}
          onClick={() => setTab('pending')}
        >
          Pendientes
          {pending.length > 0 && <span className="students-tab-count pending">{pending.length}</span>}
        </button>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-toolbar">
          <div className="search-field">
            <SearchIcon size={16} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre u objetivo…"
            />
          </div>
          <span className="row-count">
            {loading ? '…' : `${filtered.length} cliente${filtered.length === 1 ? '' : 's'}`}
          </span>
        </div>

        {error ? (
          <div style={{ padding: 20 }}><ErrorState message={error} onRetry={refetch} /></div>
        ) : loading ? (
          <div style={{ padding: 16 }}><LoadingRows rows={5} /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <span className="empty-ico"><UsersIcon size={22} /></span>
            <div className="t">
              {tab === 'active'
                ? (students.length === 0 ? 'Todavía no hay alumnos' : 'Sin resultados')
                : 'Sin clientes pendientes'}
            </div>
            <p className="muted" style={{ margin: 0 }}>
              {tab === 'active' && students.length === 0
                ? 'Compartí tu código de invitación para que se sumen al registrarse.'
                : tab === 'pending'
                  ? 'Cuando un alumno se registre aparecerá aquí para que lo apruebes.'
                  : 'Probá con otro término de búsqueda.'}
            </p>
          </div>
        ) : tab === 'active' ? (
          /* ── Active table ── */
          <table>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Objetivo</th>
                <th>Plan</th>
                <th>Facturación</th>
                <th>Se unió</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} className="row-clickable" onClick={() => navigate(`/students/${s.id}`)}>
                  <td>
                    <div className="cell-user">
                      <StudentAvatar name={s.full_name} url={s.avatar_url} />
                      <div>
                        <div className="cell-name">{s.full_name ?? 'Alumno'}</div>
                        <div className="cell-sub">Acceso completo</div>
                      </div>
                    </div>
                  </td>
                  <td className="muted">{s.goal ?? '—'}</td>
                  <td><PlanBadge plan={planByStudent.get(s.id) ?? { kind: 'none' }} /></td>
                  <td className="muted">{billingByStudent.get(s.id) ?? '—'}</td>
                  <td className="muted">{timeAgo(s.created_at)}</td>
                  <td>
                    <ClientRowActions
                      onOpen={() => navigate(`/students/${s.id}`)}
                      onDelete={() => { setDeleteError(null); setConfirmDeleteId(s.id); }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          /* ── Pending table ── */
          <table>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Objetivo</th>
                <th>Plan</th>
                <th>Facturación</th>
                <th>Solicitó</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id}>
                  <td>
                    <div className="cell-user">
                      <StudentAvatar name={s.full_name} url={s.avatar_url} style={!s.avatar_url ? { background: '#fef3c7', color: '#92400e' } : undefined} />
                      <div>
                        <div className="cell-name">{s.full_name ?? 'Nuevo alumno'}</div>
                        <div className="cell-sub">Esperando aprobación</div>
                      </div>
                    </div>
                  </td>
                  <td className="muted">{s.goal ?? '—'}</td>
                  <td><PlanBadge plan={planByStudent.get(s.id) ?? { kind: 'none' }} /></td>
                  <td className="muted">—</td>
                  <td className="muted">{timeAgo(s.created_at)}</td>
                  <td>
                    <div className="client-pending-actions">
                      {planByStudent.get(s.id)?.kind === 'mentoria' && evaluationByStudent.get(s.id)?.status !== 'completed' ? (
                        <button
                          className="btn secondary sm"
                          onClick={() => void markEvaluationCompleted(s.id)}
                        >
                          Marcar reunión hecha
                        </button>
                      ) : null}
                      <button
                        className="btn primary sm"
                        onClick={() => openManualPayment(s.id)}
                      >
                        Activar
                      </button>
                      <ClientRowActions
                        onOpen={() => navigate(`/students/${s.id}`)}
                        onDelete={() => { setDeleteError(null); setConfirmDeleteId(s.id); }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {confirmDeleteId && clientToDelete && (
        <div className="modal-backdrop" onClick={() => !deletingId && setConfirmDeleteId(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="page-title" style={{ fontSize: 18, margin: '0 0 8px' }}>Eliminar cliente</h2>
            <p style={{ margin: '0 0 20px', fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              Se borrará la cuenta de <strong>{clientToDelete.full_name ?? 'este alumno'}</strong> y todos sus datos.
              Esta acción no se puede deshacer.
            </p>
            {deleteError && (
              <div style={{ marginBottom: 14, padding: '10px 12px', borderRadius: 8, background: '#fef2f2', color: '#b91c1c', fontSize: 13 }}>
                {deleteError}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="btn secondary" onClick={() => setConfirmDeleteId(null)} disabled={!!deletingId}>
                Cancelar
              </button>
              <button
                className="btn danger"
                onClick={() => void removeClient(confirmDeleteId)}
                disabled={!!deletingId}
              >
                {deletingId === confirmDeleteId ? 'Eliminando…' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        /* Invite banner */
        .invite-banner {
          display: flex; flex-direction: column; gap: 14px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius); padding: 16px 18px; margin-bottom: 20px;
        }
        .invite-banner-text { min-width: 0; }
        .invite-banner-title { font-weight: 600; font-size: 14px; color: var(--text-primary); margin-bottom: 4px; }
        .invite-banner-sub { font-size: 13px; color: var(--text-secondary); line-height: 1.5; }
        .invite-banner-row {
          display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
        }
        .invite-link-input {
          flex: 1; min-width: 200px;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 13px; font-weight: 400; letter-spacing: 0;
          color: var(--text-secondary);
          background: var(--surface-elevated);
          border: 1px solid var(--border);
          border-radius: 8px; padding: 9px 12px;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .invite-link-input:focus { outline: none; border-color: var(--border-strong); color: var(--text-primary); }
        .invite-banner-btns { display: flex; gap: 8px; flex-shrink: 0; }

        /* QR modal */
        .invite-qr-backdrop {
          position: fixed; inset: 0; z-index: 9999;
          background: rgba(0,0,0,.45); backdrop-filter: blur(4px);
          display: flex; align-items: center; justify-content: center;
        }
        .invite-qr-modal {
          background: var(--surface); border-radius: var(--radius-lg); padding: 32px;
          display: flex; flex-direction: column; align-items: center;
          box-shadow: 0 24px 80px rgba(0,0,0,.25); min-width: 300px;
        }

        .students-page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 4px; }
        .students-tabs { display: flex; gap: 0; margin-bottom: 16px; border-bottom: 2px solid var(--border); }
        .students-tab {
          display: flex; align-items: center; gap: 7px;
          padding: 9px 18px; font-size: 13.5px; font-weight: 600;
          color: var(--text-tertiary); background: none; border: none; cursor: pointer;
          border-bottom: 2px solid transparent; margin-bottom: -2px;
          transition: color 150ms;
        }
        .students-tab:hover { color: var(--text-primary); }
        .students-tab.active { color: var(--text-primary); border-bottom-color: var(--primary); }
        .students-tab-count {
          min-width: 20px; height: 18px; padding: 0 5px;
          background: var(--surface-elevated); color: var(--text-secondary);
          border-radius: 9px; font-size: 11px; font-weight: 700;
          display: flex; align-items: center; justify-content: center;
        }
        .students-tab-count.pending {
          background: var(--brand-lime-soft);
          color: color-mix(in srgb, var(--brand-lime) 72%, #0C0C0C);
        }
        .plan-badge {
          display: inline-flex; align-items: center;
          padding: 3px 9px; border-radius: 999px;
          font-size: 12px; font-weight: 600; white-space: nowrap;
          background: var(--brand-lime-soft);
          color: color-mix(in srgb, var(--brand-lime) 72%, #0C0C0C);
        }
        .plan-badge.mentoria {
          background: rgba(255,115,74,0.12);
          color: #c44e26;
        }
        .cell-sub { font-size: 11.5px; color: var(--text-tertiary); margin-top: 1px; }
        .btn.sm { font-size: 12px; padding: 5px 12px; }
        .client-row-actions {
          display: flex; align-items: center; gap: 2px; justify-content: flex-end;
        }
        .client-row-open,
        .client-row-trash {
          display: inline-flex; align-items: center; justify-content: center;
          width: 34px; height: 34px; border: none; background: transparent;
          color: var(--text-tertiary); border-radius: 8px; cursor: pointer;
          transition: background 140ms ease, color 140ms ease;
        }
        .client-row-open:hover { background: var(--surface-elevated); color: var(--text-primary); }
        .client-row-trash:hover { background: #fef2f2; color: #dc2626; }
        .client-pending-actions {
          display: flex; align-items: center; gap: 8px; justify-content: flex-end;
        }
        .btn.danger {
          background: #fef2f2; color: #b91c1c; border: 1.5px solid #fecaca;
        }
        .btn.danger:hover { background: #fee2e2; opacity: 1; }
      `}</style>

      <ManualPaymentModal
        open={manualPayOpen}
        onClose={() => setManualPayOpen(false)}
        students={students.filter((s) => s.id === manualPayStudentId).map((s) => ({ id: s.id, full_name: s.full_name }))}
        plans={plans}
        initialStudentId={manualPayStudentId ?? undefined}
        onSuccess={onManualPaymentSuccess}
      />
    </div>
  );
}
