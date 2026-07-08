import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import type { PlanRow, ProfileRow } from '@reset-fitness/shared/types/database';
import type { Translations } from '@reset-fitness/shared';
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
import { DumbbellIcon, MoreVerticalIcon, PlusIcon, SearchIcon, TrashIcon, UsersIcon } from '@/components/icons';

type Client = Pick<ProfileRow, 'id' | 'full_name' | 'goal' | 'created_at' | 'avatar_url'> & {
  client_status: 'pending' | 'active';
};

const MENTORIA_STATUS_LABEL: Record<string, string> = {
  pending: 'Pendiente de contacto',
  contacted: 'Contactado',
  scheduled: 'Reunión agendada',
  completed: 'Reunión hecha',
};

type ClientPlan =
  | { kind: 'base'; label: string }
  | { kind: 'mentoria'; label: string }
  | { kind: 'none' };

function PlanBadge({ plan }: { plan: ClientPlan }): React.JSX.Element {
  if (plan.kind === 'none') return <span className="muted">—</span>;
  return (
    <span className={`plan-badge${plan.kind === 'mentoria' ? ' mentoria' : ''}`}>
      {plan.label}
    </span>
  );
}

function BillingWarningIcons({
  warnings,
  t,
  i18n,
}: {
  warnings: { deleted: boolean; priceChanged: { current: number; paid: number } | null } | undefined;
  t: Translations;
  i18n: (str: string, vars: Record<string, string | number>) => string;
}): React.JSX.Element | null {
  if (!warnings || (!warnings.deleted && !warnings.priceChanged)) return null;
  return (
    <span style={{ display: 'inline-flex', gap: 4, marginLeft: 6 }}>
      {warnings.deleted ? (
        <span title={t.payments.manage_plans_deleted_tooltip} style={{ cursor: 'help' }}>⚠️</span>
      ) : null}
      {warnings.priceChanged ? (
        <span
          title={i18n(t.payments.manage_plans_price_changed_tooltip, {
            current: warnings.priceChanged.current.toLocaleString('es-AR'),
            paid: warnings.priceChanged.paid.toLocaleString('es-AR'),
          })}
          style={{ cursor: 'help' }}
        >
          💲
        </span>
      ) : null}
    </span>
  );
}

function ClientAvatar({ name, url, style }: { name: string | null; url?: string | null; style?: React.CSSProperties }): React.JSX.Element {
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

const WEEKDAY_LETTERS = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'];

/** Últimos 7 días, de más viejo a hoy — celda resaltada si el cliente registró
 * al menos un entreno ese día. Look & feel de app.hevycoach.com/clients. */
function Last7Days({ activeDays }: { activeDays: Set<string> | undefined }): React.JSX.Element {
  const days = useMemo(() => {
    const out: { key: string; letter: string; num: number; active: boolean }[] = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      out.push({ key, letter: WEEKDAY_LETTERS[d.getDay()]!, num: d.getDate(), active: !!activeDays?.has(key) });
    }
    return out;
  }, [activeDays]);

  return (
    <div className="last7-row">
      {days.map((d) => (
        <div key={d.key} className={`last7-cell${d.active ? ' active' : ''}`}>
          <span className="last7-letter">{d.letter}</span>
          <span className="last7-num">{d.num}</span>
        </div>
      ))}
    </div>
  );
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

/** Menú kebab por fila (look & feel: app.hevycoach.com/clients). */
function ClientRowMenu({
  open,
  onToggle,
  onAssignProgram,
  onDelete,
}: {
  open: boolean;
  onToggle: () => void;
  onAssignProgram: () => void;
  onDelete: () => void;
}): React.JSX.Element {
  return (
    <div className="client-row-menu" onClick={(e) => e.stopPropagation()}>
      <button type="button" className="client-row-kebab" onClick={onToggle} aria-label="Más opciones" title="Más opciones">
        <MoreVerticalIcon size={18} />
      </button>
      {open && (
        <>
          <div className="client-row-menu-backdrop" onClick={onToggle} />
          <div className="client-row-menu-pop">
            <button type="button" className="client-row-menu-item" onClick={onAssignProgram}>
              <DumbbellIcon size={15} /> Asignar entrenamiento
            </button>
            <button type="button" className="client-row-menu-item danger" onClick={onDelete}>
              <TrashIcon size={15} /> Eliminar cliente
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function ClientsPage(): React.JSX.Element {
  const { session } = useAuth();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [searchParams] = useSearchParams();
  const userId = session?.user.id;
  const [clients, setClients] = useState<Client[]>([]);
  const [query, setQuery] = useState(searchParams.get('q') ?? '');
  const [tab, setTab] = useState<'active' | 'pending' | 'mentoria'>(() => {
    const t = searchParams.get('tab');
    return t === 'pending' || t === 'mentoria' ? t : 'active';
  });
  const [manualPayOpen, setManualPayOpen] = useState(false);
  const [manualPayClientId, setManualPayClientId] = useState<string | null>(null);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [priceOverrides, setPriceOverrides] = useState<Map<string, number>>(new Map());
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [addClientOpen, setAddClientOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [activeSubByClient, setActiveSubByClient] = useState<Map<string, string>>(new Map());
  const [activeSubExtraByClient, setActiveSubExtraByClient] = useState<
    Map<string, { amount_ars: number | null; mp_preapproval_id: string | null; expires_at: string | null }>
  >(new Map());
  const [evaluationByClient, setEvaluationByClient] = useState<Map<string, { id: string; status: string }>>(new Map());
  // Días (YYYY-MM-DD) de los últimos 7 con al menos un entreno registrado, por cliente.
  const [last7ByClient, setLast7ByClient] = useState<Map<string, Set<string>>>(new Map());

  const inviteLink = inviteCode ? buildInviteLink(inviteCode, getJoinBaseUrl()) : null;

  useEffect(() => { setQuery(searchParams.get('q') ?? ''); }, [searchParams]);
  useEffect(() => {
    const t = searchParams.get('tab');
    if (t === 'pending' || t === 'mentoria') setTab(t);
  }, [searchParams]);

  const { data: clientsData, loading, error, refetch } = useSupabaseQuery<Client[]>(
    async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, goal, created_at, client_status, avatar_url')
        .eq('trainer_id', userId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data as Client[] | null) ?? [];
    },
    [userId],
    { enabled: !!userId },
  );

  useEffect(() => { if (clientsData) setClients(clientsData); }, [clientsData]);

  useEffect(() => {
    if (!userId) return;
    void (async () => {
      const [{ data: branding }, { data: planRows }, { data: overrideRows }] = await Promise.all([
        supabase.from('trainer_branding').select('invite_code').eq('trainer_id', userId).maybeSingle(),
        // Sin filtro de `active`: ManualPaymentModal necesita poder resolver
        // cualquier combinación de Plan × Frecuencia del catálogo, incluidas
        // las que no están habilitadas para el checkout self-service de mobile.
        supabase.from('plans').select('*').order('duration_days'),
        // Precio propio del entrenador para un plan built-in: sin esto, el
        // aviso de "precio desactualizado" comparaba contra el precio crudo
        // del catálogo global en vez de lo que este entrenador realmente cobra.
        supabase.from('trainer_plan_prices').select('plan_id, price_ars').eq('trainer_id', userId),
      ]);
      if (branding && 'invite_code' in branding) {
        setInviteCode((branding as { invite_code: string }).invite_code);
      }
      setPlans((planRows as PlanRow[] | null) ?? []);
      setPriceOverrides(
        new Map(
          ((overrideRows as { plan_id: string; price_ars: number }[] | null) ?? []).map((o) => [o.plan_id, Number(o.price_ars)]),
        ),
      );
    })();
  }, [userId]);

  // Plan que cada alumno eligió al crear la cuenta: "Plan Base" viene de una
  // suscripción activa; "Mentoría 1 a 1" no es una suscripción, es un lead
  // capturado en evaluation_requests (el entrenador lo procesa manualmente).
  useEffect(() => {
    if (!userId || !clientsData || clientsData.length === 0) return;
    const clientIds = clientsData.map((s) => s.id);
    void (async () => {
      const [{ data: subRows }, { data: evalRows }] = await Promise.all([
        supabase
          .from('subscriptions')
          .select('user_id, plan_id, status, expires_at, created_at, amount_ars, mp_preapproval_id')
          .in('user_id', clientIds)
          .eq('status', 'active')
          .order('created_at', { ascending: false }),
        supabase
          .from('evaluation_requests')
          .select('id, client_id, status, created_at')
          .eq('trainer_id', userId)
          .order('created_at', { ascending: false }),
      ]);

      const subMap = new Map<string, string>();
      const subExtraMap = new Map<string, { amount_ars: number | null; mp_preapproval_id: string | null; expires_at: string | null }>();
      for (const row of (subRows as {
        user_id: string;
        plan_id: string;
        expires_at: string | null;
        amount_ars: number | null;
        mp_preapproval_id: string | null;
      }[] | null) ?? []) {
        if (subMap.has(row.user_id)) continue;
        if (row.expires_at && new Date(row.expires_at) < new Date()) continue;
        subMap.set(row.user_id, row.plan_id);
        subExtraMap.set(row.user_id, { amount_ars: row.amount_ars, mp_preapproval_id: row.mp_preapproval_id, expires_at: row.expires_at });
      }
      setActiveSubByClient(subMap);
      setActiveSubExtraByClient(subExtraMap);

      const evalMap = new Map<string, { id: string; status: string }>();
      for (const row of (evalRows as { id: string; client_id: string; status: string }[] | null) ?? []) {
        if (!evalMap.has(row.client_id)) evalMap.set(row.client_id, { id: row.id, status: row.status });
      }
      setEvaluationByClient(evalMap);
    })();
  }, [userId, clientsData]);

  // Actividad de entrenamiento de los últimos 7 días (para el widget "Últimos 7
  // días" de la tabla de Activos, look & feel de app.hevycoach.com/clients).
  useEffect(() => {
    if (!clientsData || clientsData.length === 0) return;
    const clientIds = clientsData.map((s) => s.id);
    const since = new Date();
    since.setDate(since.getDate() - 6);
    const sinceStr = since.toISOString().slice(0, 10);
    void (async () => {
      const { data } = await supabase
        .from('workout_logs')
        .select('user_id, date')
        .in('user_id', clientIds)
        .gte('date', sinceStr);
      const map = new Map<string, Set<string>>();
      for (const row of (data as { user_id: string; date: string }[] | null) ?? []) {
        const day = row.date.slice(0, 10);
        const set = map.get(row.user_id) ?? new Set<string>();
        set.add(day);
        map.set(row.user_id, set);
      }
      setLast7ByClient(map);
    })();
  }, [clientsData]);

  const planByClient = useMemo(() => {
    const map = new Map<string, ClientPlan>();
    for (const s of clients) {
      const planId = activeSubByClient.get(s.id);
      const planRow = planId ? plans.find((p) => p.id === planId) : undefined;
      if (planRow) {
        map.set(s.id, {
          kind: planRow.plan_type === 'mentoria' ? 'mentoria' : 'base',
          label: planRow.plan_type === 'mentoria' ? 'Mentoría 1 a 1' : 'Base',
        });
      } else if (evaluationByClient.has(s.id)) {
        map.set(s.id, { kind: 'mentoria', label: 'Mentoría 1 a 1' });
      } else {
        map.set(s.id, { kind: 'none' });
      }
    }
    return map;
  }, [clients, activeSubByClient, evaluationByClient, plans]);

  // Fecha de vencimiento de la suscripción activa (solo Activos).
  const expiresByClient = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const s of clients) {
      if (!activeSubByClient.has(s.id)) continue;
      map.set(s.id, activeSubExtraByClient.get(s.id)?.expires_at ?? null);
    }
    return map;
  }, [clients, activeSubByClient, activeSubExtraByClient]);

  // Avisos de facturación: frecuencia eliminada (soft-delete) y/o precio
  // desactualizado vs. lo que este alumno paga en su cobro recurrente de MP.
  const billingWarningsByClient = useMemo(() => {
    const map = new Map<string, { deleted: boolean; priceChanged: { current: number; paid: number } | null }>();
    for (const s of clients) {
      const planId = activeSubByClient.get(s.id);
      const planRow = planId ? plans.find((p) => p.id === planId) : undefined;
      if (!planRow) continue;
      const extra = activeSubExtraByClient.get(s.id);
      const effectivePrice = priceOverrides.get(planRow.id) ?? Number(planRow.price_ars);
      const priceChanged =
        extra?.mp_preapproval_id && extra.amount_ars != null && effectivePrice !== Number(extra.amount_ars)
          ? { current: effectivePrice, paid: Number(extra.amount_ars) }
          : null;
      map.set(s.id, { deleted: !!planRow.deleted_at, priceChanged });
    }
    return map;
  }, [clients, activeSubByClient, activeSubExtraByClient, plans, priceOverrides]);

  const markEvaluationCompleted = async (clientId: string) => {
    const row = evaluationByClient.get(clientId);
    if (!row) return;
    const { error } = await anyClient.from('evaluation_requests').update({ status: 'completed' }).eq('id', row.id);
    if (error) {
      showToast('error', 'No pudimos actualizar el estado de la reunión.');
      return;
    }
    setEvaluationByClient((prev) => {
      const next = new Map(prev);
      next.set(clientId, { ...row, status: 'completed' });
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

  const [inviteEmail, setInviteEmail] = useState('');
  const [sendingInvite, setSendingInvite] = useState(false);
  const sendInviteEmail = async () => {
    const email = inviteEmail.trim();
    if (!email || sendingInvite) return;
    setSendingInvite(true);
    const { error } = await supabase.functions.invoke('send-client-invite-email', { body: { email } });
    setSendingInvite(false);
    if (error) {
      showToast('error', 'No pudimos enviar la invitación.');
      return;
    }
    showToast('success', `Invitación enviada a ${email}`);
    setInviteEmail('');
  };

  const openManualPayment = (id: string) => {
    setManualPayClientId(id);
    setManualPayOpen(true);
  };

  const onManualPaymentSuccess = () => {
    if (!manualPayClientId) return;
    setClients((prev) => prev.map((s) => (
      s.id === manualPayClientId ? { ...s, client_status: 'active' } : s
    )));
    void refetch();
  };

  const removeClient = async (id: string) => {
    setDeletingId(id);
    setDeleteError(null);
    const result = await deleteClientAccount(id);
    if (result.ok) {
      setClients((prev) => prev.filter((s) => s.id !== id));
      setConfirmDeleteId(null);
      showToast('success', 'Cliente eliminado');
    } else {
      setDeleteError(result.message);
    }
    setDeletingId(null);
  };

  const clientToDelete = confirmDeleteId ? clients.find((s) => s.id === confirmDeleteId) : null;

  // "Activos" = aprobado por el entrenador Y tiene un plan real asignado
  // (no solo client_status='active'). Un cliente aprobado sin suscripción
  // real cae en "Sin plan activo" junto con los pending — evita que aparezca
  // en Activos con "—" en la columna Plan sin explicación.
  const hasRealPlan = (id: string) => (planByClient.get(id)?.kind ?? 'none') !== 'none';
  const active  = useMemo(
    () => clients.filter((s) => s.client_status === 'active' && hasRealPlan(s.id)),
    [clients, planByClient],
  );
  const pending = useMemo(
    () => clients.filter((s) => s.client_status === 'pending' || (s.client_status === 'active' && !hasRealPlan(s.id))),
    [clients, planByClient],
  );
  // Cualquier cliente (activo o pendiente) con una solicitud de Mentoría 1 a 1
  // sin resolver — incluye tanto al que recién se registra eligiendo Mentoría
  // como al que ya paga Plan Base y pide el upgrade desde el perfil. Se queda acá
  // aunque se marque "reunión hecha": solo sale de la lista cuando de verdad se
  // activa la suscripción de Mentoría (no antes, para no perderlo de vista).
  const mentoriaRequests = useMemo(
    () => clients.filter((s) => {
      const ev = evaluationByClient.get(s.id);
      if (!ev || ev.status === 'dismissed') return false;
      const planId = activeSubByClient.get(s.id);
      const planRow = planId ? plans.find((p) => p.id === planId) : undefined;
      return planRow?.plan_type !== 'mentoria';
    }),
    [clients, evaluationByClient, activeSubByClient, plans],
  );
  const current = tab === 'active' ? active : tab === 'pending' ? pending : mentoriaRequests;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return current;
    return current.filter(
      (s) => (s.full_name ?? '').toLowerCase().includes(q) || (s.goal ?? '').toLowerCase().includes(q)
    );
  }, [current, query]);

  return (
    <div>
      <div className="clients-page-header">
        <div>
          <h1 className="page-title">{t.web.clients}</h1>
          <p className="page-sub">{t.web.clients_sub}</p>
        </div>
      </div>

      {/* Add Client modal — look & feel: app.hevycoach.com/clients (+ Add Client) */}
      {addClientOpen && (
        <div className="invite-qr-backdrop" onClick={() => { setAddClientOpen(false); setShowQR(false); }}>
          <div className="add-client-modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 2 }}>Agregar cliente</div>
            <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 20 }}>
              Compartí tu link, mostrá el QR, o mandalo directo por email.
            </div>

            {inviteCode && inviteLink ? (
              <>
                <div className="add-client-section-label">Link de invitación</div>
                <div className="invite-banner-row" style={{ marginBottom: 14 }}>
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
                    <button type="button" className="btn secondary sm" onClick={() => setShowQR((v) => !v)}>
                      QR
                    </button>
                  </div>
                </div>

                {showQR && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 0', borderTop: '1px solid var(--border)', marginBottom: 14 }}>
                    <QRCodeSVG value={inviteLink} size={160} />
                    <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-tertiary)', wordBreak: 'break-all', textAlign: 'center', padding: '0 8px' }}>
                      {inviteLink}
                    </div>
                  </div>
                )}

                <div className="add-client-section-label" style={{ marginTop: 6 }}>Enviar invitación por email</div>
                <div className="add-client-email-row">
                  <input
                    type="email"
                    className="add-client-email-input"
                    placeholder="client@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') void sendInviteEmail(); }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
                  <button
                    type="button"
                    className="btn primary"
                    disabled={!inviteEmail.trim() || sendingInvite}
                    onClick={() => void sendInviteEmail()}
                  >
                    {sendingInvite ? 'Enviando…' : 'Enviar invitación'}
                  </button>
                </div>
              </>
            ) : (
              <p className="muted">Todavía no tenés un código de invitación configurado.</p>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="clients-tabs">
        <button
          className={`clients-tab${tab === 'active' ? ' active' : ''}`}
          onClick={() => setTab('active')}
        >
          Activos
          <span className="clients-tab-count">{active.length}</span>
        </button>
        <button
          className={`clients-tab${tab === 'pending' ? ' active' : ''}`}
          onClick={() => setTab('pending')}
        >
          Sin plan activo
          {pending.length > 0 && <span className="clients-tab-count pending">{pending.length}</span>}
        </button>
        <button
          className={`clients-tab${tab === 'mentoria' ? ' active' : ''}`}
          onClick={() => setTab('mentoria')}
        >
          Solicitudes de Mentoría
          {mentoriaRequests.length > 0 && <span className="clients-tab-count pending">{mentoriaRequests.length}</span>}
        </button>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-toolbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="search-field">
              <SearchIcon size={16} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar clientes…"
              />
            </div>
            <span className="row-count">
              {loading ? '…' : `${filtered.length} cliente${filtered.length === 1 ? '' : 's'}`}
            </span>
          </div>
          <button type="button" className="btn primary add-client-btn" onClick={() => setAddClientOpen(true)}>
            <PlusIcon size={15} /> Agregar cliente
          </button>
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
                ? (clients.length === 0 ? 'Todavía no hay alumnos' : 'Sin resultados')
                : tab === 'pending'
                  ? 'Sin clientes pendientes'
                  : 'Sin solicitudes de Mentoría 1 a 1'}
            </div>
            <p className="muted" style={{ margin: 0 }}>
              {tab === 'active' && clients.length === 0
                ? 'Compartí tu código de invitación para que se sumen al registrarse.'
                : tab === 'pending'
                  ? 'Cuando un alumno se registre aparecerá aquí para que lo apruebes.'
                  : tab === 'mentoria'
                    ? 'Cuando un alumno aplique a Mentoría 1 a 1 (nuevo o upgrade) aparecerá aquí.'
                    : 'Probá con otro término de búsqueda.'}
            </p>
          </div>
        ) : tab === 'active' ? (
          /* ── Active table (look & feel: app.hevycoach.com/clients) ── */
          <table>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Plan</th>
                <th>Últimos 7 días</th>
                <th>Se unió</th>
                <th>Vence</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => {
                const expiresAt = expiresByClient.get(s.id);
                return (
                  <tr key={s.id} className="row-clickable" onClick={() => navigate(`/clients/${s.id}`)}>
                    <td>
                      <div className="cell-user">
                        <ClientAvatar name={s.full_name} url={s.avatar_url} />
                        <div>
                          <div className="cell-name">{s.full_name ?? 'Alumno'}</div>
                          <div className="cell-sub">Acceso completo</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <PlanBadge plan={planByClient.get(s.id) ?? { kind: 'none' }} />
                      <BillingWarningIcons warnings={billingWarningsByClient.get(s.id)} t={t} i18n={i18n} />
                    </td>
                    <td><Last7Days activeDays={last7ByClient.get(s.id)} /></td>
                    <td className="muted">
                      {new Date(s.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="muted">
                      {expiresAt
                        ? new Date(expiresAt).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
                        : '—'}
                    </td>
                    <td>
                      <ClientRowMenu
                        open={menuOpenId === s.id}
                        onToggle={() => setMenuOpenId((prev) => (prev === s.id ? null : s.id))}
                        onAssignProgram={() => { setMenuOpenId(null); navigate(`/clients/${s.id}?tab=entrenos`); }}
                        onDelete={() => { setMenuOpenId(null); setDeleteError(null); setConfirmDeleteId(s.id); }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : tab === 'pending' ? (
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
                      <ClientAvatar name={s.full_name} url={s.avatar_url} style={!s.avatar_url ? { background: '#fef3c7', color: '#92400e' } : undefined} />
                      <div>
                        <div className="cell-name">{s.full_name ?? 'Nuevo alumno'}</div>
                        <div className="cell-sub">{s.client_status === 'active' ? 'Sin plan activo' : 'Esperando aprobación'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="muted">{s.goal ?? '—'}</td>
                  <td><PlanBadge plan={planByClient.get(s.id) ?? { kind: 'none' }} /></td>
                  <td className="muted">—</td>
                  <td className="muted">{timeAgo(s.created_at)}</td>
                  <td>
                    <div className="client-pending-actions">
                      {planByClient.get(s.id)?.kind === 'mentoria' && evaluationByClient.get(s.id)?.status !== 'completed' ? (
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
                      <ClientRowMenu
                        open={menuOpenId === s.id}
                        onToggle={() => setMenuOpenId((prev) => (prev === s.id ? null : s.id))}
                        onAssignProgram={() => { setMenuOpenId(null); navigate(`/clients/${s.id}?tab=entrenos`); }}
                        onDelete={() => { setMenuOpenId(null); setDeleteError(null); setConfirmDeleteId(s.id); }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          /* ── Mentoría 1 a 1 table (nuevos + upgrades de clientes activos) ── */
          <table>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Estado cuenta</th>
                <th>Solicitud</th>
                <th>Solicitó</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => {
                const ev = evaluationByClient.get(s.id);
                return (
                  <tr key={s.id}>
                    <td>
                      <div className="cell-user">
                        <ClientAvatar name={s.full_name} url={s.avatar_url} />
                        <div>
                          <div className="cell-name">{s.full_name ?? 'Alumno'}</div>
                          <div className="cell-sub">{s.client_status === 'active' ? 'Upgrade a Mentoría' : 'Nuevo alumno'}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`plan-badge${s.client_status === 'active' ? '' : ' mentoria'}`}>
                        {s.client_status === 'active' ? 'Activo (Base)' : 'Pendiente'}
                      </span>
                    </td>
                    <td className="muted">{MENTORIA_STATUS_LABEL[ev?.status ?? 'pending'] ?? ev?.status ?? '—'}</td>
                    <td className="muted">{timeAgo(s.created_at)}</td>
                    <td>
                      <div className="client-pending-actions">
                        {ev?.status !== 'completed' ? (
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
                          {s.client_status === 'active' ? 'Activar Mentoría' : 'Activar'}
                        </button>
                        <ClientRowMenu
                          open={menuOpenId === s.id}
                          onToggle={() => setMenuOpenId((prev) => (prev === s.id ? null : s.id))}
                          onAssignProgram={() => { setMenuOpenId(null); navigate(`/clients/${s.id}?tab=entrenos`); }}
                          onDelete={() => { setMenuOpenId(null); setDeleteError(null); setConfirmDeleteId(s.id); }}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
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

        .clients-page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 4px; }
        .clients-tabs { display: flex; gap: 0; margin-bottom: 16px; border-bottom: 2px solid var(--border); }
        .clients-tab {
          display: flex; align-items: center; gap: 7px;
          padding: 9px 18px; font-size: 13.5px; font-weight: 600;
          color: var(--text-tertiary); background: none; border: none; cursor: pointer;
          border-bottom: 2px solid transparent; margin-bottom: -2px;
          transition: color 150ms;
        }
        .clients-tab:hover { color: var(--text-primary); }
        .clients-tab.active { color: var(--text-primary); border-bottom-color: var(--primary); }
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

        /* Últimos 7 días — look & feel de app.hevycoach.com/clients */
        .last7-row { display: flex; gap: 4px; }
        .last7-cell {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 1px; width: 30px; height: 36px; border-radius: 8px;
          background: var(--surface-elevated); flex-shrink: 0;
        }
        .last7-letter { font-size: 9px; font-weight: 600; text-transform: uppercase; color: var(--text-tertiary); }
        .last7-num { font-size: 12px; font-weight: 600; color: var(--text-secondary); }
        .last7-cell.active { background: var(--primary); }
        .last7-cell.active .last7-letter { color: color-mix(in srgb, var(--primary-contrast, #fff) 80%, transparent); }
        .last7-cell.active .last7-num { color: var(--primary-contrast, #fff); }

        .client-pending-actions {
          display: flex; align-items: center; gap: 8px; justify-content: flex-end;
        }
      `}</style>

      <ManualPaymentModal
        open={manualPayOpen}
        onClose={() => setManualPayOpen(false)}
        clients={clients.filter((s) => s.id === manualPayClientId).map((s) => ({ id: s.id, full_name: s.full_name }))}
        plans={plans}
        initialClientId={manualPayClientId ?? undefined}
        onSuccess={onManualPaymentSuccess}
      />
    </div>
  );
}
