import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from '@/hooks/useTranslation';
import { MessageIcon, PlusIcon, DumbbellIcon } from '@/components/icons';
import { UserAvatar } from '@/components/UserAvatar';
import type {
  BodyMeasurementRow,
  MealLogRow,
  MessageRow,
  ProfileRow,
  ProgressPhotoRow,
  SubscriptionRow,
  UserProfileRow,
  WorkoutLogRow,
  PlanRow,
} from '@reset-fitness/shared/types/database';
import { supabase, anyClient } from '@/lib/supabase';
import { TERMS_VERSION, APP_TERMS_URL } from '@reset-fitness/shared';
import { ClientProgramPanel } from '@/components/ClientProgramPanel';
import { WorkoutFeed } from '@/components/WorkoutPost';
import { BodyMeasurementsPanel } from '@/components/BodyMeasurementsPanel';
import { ClientOverview } from '@/components/ClientOverview';
import { NutritionPanel } from '@/components/NutritionPanel';
import { ExerciseStatsPanel } from '@/components/ExerciseStatsPanel';
import { AdvancedStatsPanel } from '@/components/AdvancedStatsPanel';
import { ClientSettingsPanel } from '@/components/ClientSettingsPanel';
import { Lightbox, Spinner, ConfirmDialog } from '@/components/ui';
import { ManualPaymentModal } from '@/components/ManualPaymentModal';
import { formatMoney } from '@/lib/planPricing';
import { useToast } from '@/hooks/useToast';

interface WaiverSignature {
  id: string;
  full_name: string;
  signed_at: string;
  signature_data: string;
  document_snapshot: string;
  document_title: string;
}

interface ImageConsentAcceptance {
  id: string;
  full_name: string;
  accepted_at: string;
  document_snapshot: string;
  document_title: string;
  signature_data: string | null;
  status: 'accepted' | 'declined';
}

interface ConsultationResponseEntry {
  label: string;
  type: 'listbox' | 'dropdown' | 'textbox' | 'textarea';
  answer: string | string[];
}

interface ConsultationResponse {
  submitted_at: string;
  responses: ConsultationResponseEntry[];
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Profile = Pick<ProfileRow, 'id' | 'full_name' | 'goal' | 'phone' | 'avatar_url' | 'created_at' | 'assigned_program_key' | 'terms_accepted_at' | 'terms_version'> & {
  client_status?: 'pending' | 'active';
};

type ClientSubscription = Pick<SubscriptionRow, 'id' | 'status' | 'expires_at' | 'started_at' | 'mp_preapproval_id'> & {
  plan_name: string | null;
  /** La frecuencia de facturación elegida fue soft-deleted por el entrenador
   * — el alumno sigue renovando igual, pero ya no está en el catálogo activo. */
  plan_deleted: boolean;
  /** El precio de la frecuencia cambió desde que este alumno se suscribió
   * y el cobro es recurrente por MercadoPago — hay que actualizarlo ahí a mano. */
  price_changed: { current: number; paid: number } | null;
};

type SubscriptionCharge = {
  id: string;
  amount_ars: number | null;
  status: string | null;
  charged_at: string;
  mp_payment_id: string | null;
};

/** Días que faltan para el próximo vencimiento — negativo si ya venció. */
function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}

function subscriptionStatusLabel(status: SubscriptionRow['status']): string {
  if (status === 'active') return 'Activa';
  if (status === 'pending') return 'Pendiente';
  if (status === 'expired') return 'Vencida';
  if (status === 'cancelled') return 'Cancelada';
  return '—';
}

type Tab = 'resumen' | 'entrenos' | 'exstats' | 'avanzado' | 'nutricion' | 'medidas' | 'fotos' | 'engagement' | 'deslinde' | 'consulta' | 'facturacion' | 'config';

const TABS: { key: Tab; label: string }[] = [
  { key: 'resumen',     label: 'Resumen'      },
  { key: 'consulta',    label: 'Consulta'     },
  { key: 'entrenos',    label: 'Entrenamiento'},
  { key: 'exstats',     label: 'Estadísticas de ejercicios' },
  { key: 'avanzado',    label: 'Estadísticas avanzadas' },
  { key: 'nutricion',   label: 'Nutrición'    },
  { key: 'medidas',     label: 'Medidas'      },
  { key: 'fotos',       label: 'Fotos'        },
  { key: 'engagement',  label: 'Engagement'   },
  { key: 'facturacion', label: 'Facturación'  },
  { key: 'deslinde',    label: 'Legal'        },
  { key: 'config',      label: 'Configuración' },
];
const TAB_KEYS = new Set<Tab>(TABS.map((t) => t.key));

const POSITION_LABEL: Record<string, string> = { frente: 'Frente', perfil: 'Perfil', espalda: 'Espalda' };

function relativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86400000);
  if (d === 0) return 'Hoy';
  if (d === 1) return 'Ayer';
  if (d < 7) return `Hace ${d} días`;
  return new Date(iso).toLocaleDateString('es-AR');
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ClientDetailPage(): React.JSX.Element {
  const { id: clientId } = useParams<{ id: string }>();
  const { profile: trainerProfile } = useAuth();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab');
  const [tab, setTab] = useState<Tab>(
    initialTab && TAB_KEYS.has(initialTab as Tab) ? (initialTab as Tab) : 'resumen',
  );

  const [profile, setProfile]         = useState<Profile | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfileRow | null>(null);
  const [measurements, setMeasurements] = useState<BodyMeasurementRow[]>([]);
  const [workouts, setWorkouts]       = useState<WorkoutLogRow[]>([]);
  const [meals, setMeals]             = useState<MealLogRow[]>([]);
  const [messages, setMessages]       = useState<MessageRow[]>([]);
  const [waiverSig, setWaiverSig]     = useState<WaiverSignature | null | false>(null); // null=loading, false=not signed
  const [imageConsent, setImageConsent] = useState<ImageConsentAcceptance | null | false>(null);
  const [consultation, setConsultation] = useState<ConsultationResponse | null | false>(null); // null=loading, false=not submitted
  const [photos, setPhotos]           = useState<ProgressPhotoRow[]>([]);
  const [photoUrls, setPhotoUrls]     = useState<Record<string, string>>({});
  const [subscription, setSubscription] = useState<ClientSubscription | null>(null);
  const [lightbox, setLightbox]       = useState<{ src: string; caption: string } | null>(null);
  const [loading, setLoading]         = useState(true);
  const [manualPayOpen, setManualPayOpen] = useState(false);
  const [plans, setPlans]             = useState<PlanRow[]>([]);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [cancelling, setCancelling]   = useState(false);
  const [charges, setCharges]         = useState<SubscriptionCharge[]>([]);
  const [chargesLoading, setChargesLoading] = useState(false);

  useEffect(() => {
    if (!trainerProfile?.id) return;
    void (async () => {
      // Sin filtro de `active`: ManualPaymentModal necesita resolver cualquier
      // combinación de Plan × Frecuencia del catálogo.
      const { data: planRows } = await supabase.from('plans').select('*').order('duration_days');
      setPlans((planRows as PlanRow[] | null) ?? []);
    })();
  }, [trainerProfile?.id]);

  useEffect(() => {
    if (!clientId) return;
    let active = true;
    void (async () => {
      const [{ data: p }, { data: up }, { data: bm }, { data: wl }, { data: ml }, { data: msgs }, { data: ws }, { data: ic }, { data: cr }, { data: pp }, { data: sub }] = await Promise.all([
        supabase.from('profiles').select('id, full_name, goal, phone, avatar_url, created_at, client_status, assigned_program_key, terms_accepted_at, terms_version').eq('id', clientId).maybeSingle(),
        supabase.from('user_profiles').select('*').eq('user_id', clientId).maybeSingle(),
        supabase.from('body_measurements').select('*').eq('user_id', clientId).order('date', { ascending: false }).limit(10),
        supabase.from('workout_logs').select('*').eq('user_id', clientId).order('date', { ascending: false }).order('created_at', { ascending: false }).limit(20),
        supabase.from('meal_logs').select('*').eq('user_id', clientId).order('created_at', { ascending: false }).limit(20),
        supabase.from('messages').select('*').eq('client_id', clientId).order('created_at', { ascending: true }),
        anyClient.from('waiver_signatures').select('id, full_name, signed_at, signature_data, document_snapshot, document_title').eq('client_id', clientId).maybeSingle(),
        anyClient.from('image_consent_acceptances').select('id, full_name, accepted_at, document_snapshot, document_title, signature_data, status').eq('client_id', clientId).maybeSingle(),
        anyClient.from('consultation_responses').select('responses, submitted_at').eq('client_id', clientId).maybeSingle(),
        supabase.from('progress_photos').select('*').eq('user_id', clientId).order('created_at', { ascending: false }),
        supabase
          .from('subscriptions')
          .select('id, status, expires_at, started_at, plan_id, mp_preapproval_id, amount_ars')
          .eq('user_id', clientId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      if (!active) return;
      setProfile((p as Profile | null) ?? null);
      setUserProfile((up as UserProfileRow | null) ?? null);
      setMeasurements((bm as BodyMeasurementRow[] | null) ?? []);
      setWorkouts((wl as WorkoutLogRow[] | null) ?? []);
      setMeals((ml as MealLogRow[] | null) ?? []);
      setMessages((msgs as MessageRow[] | null) ?? []);
      setPhotos((pp as ProgressPhotoRow[] | null) ?? []);
      setWaiverSig((ws as WaiverSignature | null) ?? false);
      setImageConsent((ic as ImageConsentAcceptance | null) ?? false);
      setConsultation((cr as ConsultationResponse | null) ?? false);

      if (sub) {
        const row = sub as Pick<SubscriptionRow, 'id' | 'status' | 'expires_at' | 'started_at' | 'plan_id' | 'mp_preapproval_id' | 'amount_ars'>;
        let status = row.status;
        if (status === 'active' && row.expires_at && new Date(row.expires_at) < new Date()) {
          status = 'expired';
        }
        const [{ data: plan }, { data: override }] = await Promise.all([
          supabase
            .from('plans')
            .select('name, deleted_at, price_ars')
            .eq('id', row.plan_id)
            .maybeSingle(),
          // Precio propio del entrenador para un plan built-in: sin esto, se
          // comparaba contra el precio crudo del catálogo global en vez de lo
          // que este entrenador realmente cobra.
          trainerProfile?.id
            ? supabase
                .from('trainer_plan_prices')
                .select('price_ars')
                .eq('trainer_id', trainerProfile.id)
                .eq('plan_id', row.plan_id)
                .maybeSingle()
            : Promise.resolve({ data: null }),
        ]);
        const planRow = plan as { name: string; deleted_at: string | null; price_ars: number } | null;
        const effectivePrice = (override as { price_ars: number } | null)?.price_ars ?? planRow?.price_ars;
        // El cobro recurrente vive en MercadoPago, no se actualiza solo cuando
        // el entrenador edita el precio — flaggeamos para que lo arregle
        // manualmente allá, solo si hay algo que comparar (amount_ars viejo en
        // null no se flaggea, no hay dato confiable) y el cobro es recurrente.
        const priceChanged =
          status === 'active' &&
          row.mp_preapproval_id &&
          row.amount_ars != null &&
          effectivePrice != null &&
          Number(effectivePrice) !== Number(row.amount_ars)
            ? { current: Number(effectivePrice), paid: Number(row.amount_ars) }
            : null;
        setSubscription({
          id: row.id,
          status,
          expires_at: row.expires_at,
          started_at: row.started_at,
          mp_preapproval_id: row.mp_preapproval_id,
          plan_name: planRow?.name ?? null,
          plan_deleted: !!planRow?.deleted_at,
          price_changed: priceChanged,
        });
      } else {
        setSubscription(null);
      }
      setLoading(false);
    })();
    return () => { active = false; };
  }, [clientId]);

  // Bucket privado: firmamos las URLs de las fotos de progreso.
  useEffect(() => {
    const pending = photos.filter((p) => photoUrls[p.photo_url] === undefined);
    if (pending.length === 0) return;
    let active = true;
    void (async () => {
      const entries = await Promise.all(
        pending.map(async (p) => {
          const { data } = await supabase.storage.from('progress-photos').createSignedUrl(p.photo_url, 3600);
          return [p.photo_url, data?.signedUrl ?? null] as const;
        }),
      );
      if (!active) return;
      setPhotoUrls((prev) => {
        const next = { ...prev };
        for (const [path, url] of entries) if (url) next[path] = url;
        return next;
      });
    })();
    return () => { active = false; };
  }, [photos, photoUrls]);


  const completedW = workouts.filter((w) => w.completed).length;
  const latestM = measurements[0] ?? null;

  const stats = useMemo(() => {
    const completed = workouts.filter((w) => w.completed);
    const totalMin = completed.reduce((acc, w) => {
      const min = w.duration_min ?? (w.duration_seconds != null ? Math.round(w.duration_seconds / 60) : 0);
      return acc + min;
    }, 0);
    const withRpe = completed.filter((w) => w.rpe != null);
    const avgRpe = withRpe.length > 0
      ? (withRpe.reduce((acc, w) => acc + (w.rpe ?? 0), 0) / withRpe.length).toFixed(1)
      : null;
    const completionRate = workouts.length > 0 ? Math.round((completedW / workouts.length) * 100) : null;
    const unreadMsgs = messages.filter((m) => !m.read && m.sender_role === 'client').length;
    return { totalMin, avgRpe, completionRate, unreadMsgs };
  }, [workouts, completedW, messages]);

  const reloadSubscription = useCallback(async () => {
    if (!clientId) return;
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('id, status, expires_at, started_at, plan_id, mp_status, mp_preapproval_id, amount_ars')
      .eq('user_id', clientId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!sub) {
      setSubscription(null);
      return;
    }
    const row = sub as Pick<SubscriptionRow, 'id' | 'status' | 'expires_at' | 'started_at' | 'plan_id' | 'mp_status' | 'mp_preapproval_id' | 'amount_ars'>;
    let status = row.status;
    if (status === 'active' && row.expires_at && new Date(row.expires_at) < new Date()) {
      status = 'expired';
    }
    const [{ data: plan }, { data: override }] = await Promise.all([
      supabase.from('plans').select('name, deleted_at, price_ars').eq('id', row.plan_id).maybeSingle(),
      trainerProfile?.id
        ? supabase
            .from('trainer_plan_prices')
            .select('price_ars')
            .eq('trainer_id', trainerProfile.id)
            .eq('plan_id', row.plan_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    const planRow = plan as { name: string; deleted_at: string | null; price_ars: number } | null;
    const effectivePrice = (override as { price_ars: number } | null)?.price_ars ?? planRow?.price_ars;
    const priceChanged =
      status === 'active' &&
      row.mp_preapproval_id &&
      row.amount_ars != null &&
      effectivePrice != null &&
      Number(effectivePrice) !== Number(row.amount_ars)
        ? { current: Number(effectivePrice), paid: Number(row.amount_ars) }
        : null;
    setSubscription({
      id: row.id,
      status,
      expires_at: row.expires_at,
      started_at: row.started_at,
      mp_preapproval_id: row.mp_preapproval_id,
      plan_name: planRow?.name ?? null,
      plan_deleted: !!planRow?.deleted_at,
      price_changed: priceChanged,
    });
  }, [clientId, trainerProfile?.id]);

  // Facturación (por mes): se carga recién al entrar a esa pestaña, no hace
  // falta pedirla junto con el resto de los datos del cliente.
  useEffect(() => {
    if (tab !== 'facturacion' || !subscription?.id) return;
    let active = true;
    setChargesLoading(true);
    void supabase
      .from('subscription_charges')
      .select('id, amount_ars, status, charged_at, mp_payment_id')
      .eq('subscription_id', subscription.id)
      .order('charged_at', { ascending: false })
      .then(({ data }) => {
        if (!active) return;
        setCharges((data as SubscriptionCharge[] | null) ?? []);
        setChargesLoading(false);
      });
    return () => { active = false; };
  }, [tab, subscription?.id]);

  const onManualPaymentSuccess = useCallback(async () => {
    if (!clientId) return;
    setProfile((prev) => (prev ? { ...prev, client_status: 'active' } : prev));
    await reloadSubscription();
  }, [clientId, reloadSubscription]);

  const doCancelSubscription = useCallback(async () => {
    if (!subscription || cancelling) return;
    setCancelling(true);
    try {
      const { data, error } = await supabase.functions.invoke<{ ok?: boolean; error?: string }>(
        'mp-cancel-subscription',
        { body: { subscription_id: subscription.id } },
      );
      if (error || !data?.ok) throw new Error(data?.error ?? 'error');
      showToast('success', 'Suscripción cancelada.');
      setCancelConfirmOpen(false);
      await reloadSubscription();
    } catch {
      showToast('error', 'No pudimos cancelar la suscripción.');
    } finally {
      setCancelling(false);
    }
  }, [subscription, cancelling, showToast, reloadSubscription]);

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}>
      <Spinner size={28} />
    </div>
  );
  if (!profile) {
    return (
      <div>
        <Link to="/clients" className="back-link">← {t.web.back_to_clients}</Link>
        <div className="empty-state"><div className="t">Cliente no encontrado</div></div>
      </div>
    );
  }

  const isPending = profile.client_status === 'pending';

  // Atención recomendada: alertas accionables para el profesional.
  const alerts: { kind: 'warn' | 'info'; text: string }[] = [];
  if (isPending) alerts.push({ kind: 'warn', text: 'Cliente pendiente de activación.' });
  if (meals.length === 0) alerts.push({ kind: 'warn', text: 'No registró comidas todavía.' });
  if (stats.unreadMsgs > 0) alerts.push({ kind: 'info', text: `Tiene ${stats.unreadMsgs} mensaje${stats.unreadMsgs > 1 ? 's' : ''} sin leer.` });
  if (!latestM) {
    alerts.push({ kind: 'warn', text: 'Sin mediciones registradas.' });
  } else {
    const missing: string[] = [];
    if (latestM.waist_cm == null) missing.push('cintura');
    if (latestM.chest_cm == null) missing.push('pecho');
    if (missing.length > 0) alerts.push({ kind: 'info', text: `Faltan medidas: ${missing.join(' y ')}.` });
  }

  return (
    <div className="sd-page">
      {/* ── Back ── */}
      <Link to="/clients" className="back-link">← {t.web.back_to_clients}</Link>

      {/* ── Header ── */}
      <div className="sd-hero card">
        <div className="sd-hero-top">
          <div className="sd-hero-identity">
            <UserAvatar name={profile.full_name} url={profile.avatar_url} size="lg" className="sd-avatar" />
            <div className="sd-header-info">
              <div className="sd-name-row">
                <span className="sd-name">{profile.full_name ?? 'Alumno'}</span>
                <span className={`badge${isPending ? ' amber' : ' active'}`}>
                  <span className="dot" />{isPending ? 'Pendiente' : 'Activo'}
                </span>
              </div>
            </div>
          </div>

          <div className="sd-header-actions">
            {isPending ? (
              <button className="btn primary" onClick={() => setManualPayOpen(true)}>
                Activar con pago manual
              </button>
            ) : (
              <>
                <button className="btn secondary sd-action" onClick={() => navigate(`/messages?client=${clientId}`)}>
                  <MessageIcon size={15} /> Enviar mensaje
                </button>
                <button className="btn secondary sd-action" onClick={() => setTab('medidas')}>
                  <PlusIcon size={15} /> Registrar medición
                </button>
                <button className="btn primary sd-action" onClick={() => setTab('entrenos')}>
                  <DumbbellIcon size={15} /> Asignar entrenamiento
                </button>
              </>
            )}
          </div>
        </div>

        <div className="sd-stat-grid">
          <HeroStat label="Entrenos" value={workouts.length} sub={stats.completionRate != null ? `${stats.completionRate}% completados` : undefined} />
          <HeroStat label="Volumen" value={stats.totalMin > 0 ? `${stats.totalMin} min` : '—'} sub="tiempo total" />
          <HeroStat label="Peso" value={latestM?.weight_kg != null ? `${latestM.weight_kg} kg` : '—'} sub={latestM ? relativeDate(latestM.date) : 'sin medición'} />
          <HeroStat label="% Grasa" value={latestM?.body_fat_pct != null ? `${latestM.body_fat_pct}%` : '—'} sub={latestM?.body_fat_pct != null ? 'última medición' : undefined} />
          <HeroStat label="Comidas" value={meals.length} sub="registros" />
          <HeroStat label="Mensajes" value={messages.length} sub={stats.unreadMsgs > 0 ? `${stats.unreadMsgs} sin leer` : 'sin pendientes'} highlight={stats.unreadMsgs > 0} />
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="sd-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`sd-tab${tab === t.key ? ' active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      <div className="sd-content">

        {/* OVERVIEW / RESUMEN */}
        {tab === 'resumen' && clientId && (
          <ClientOverview
            clientId={clientId}
            goal={profile.goal ?? null}
            phone={profile.phone ?? null}
            createdAt={profile.created_at}
            level={userProfile?.level ?? null}
            planWeek={userProfile?.plan_current_week ?? null}
            planName={subscription?.plan_name ?? null}
            expiresAt={subscription?.status === 'active' ? (subscription.expires_at ?? null) : null}
            subLabel={subscription ? subscriptionStatusLabel(subscription.status) : null}
            onOpenTab={(tk) => setTab(tk as Tab)}
          />
        )}

        {/* ENTRENAMIENTO */}
        {tab === 'entrenos' && (
          <div className="sd-training-tab">
            <div className="sd-training-col">
              <div className="sd-col-head">
                <div className="section-title">Historial de entrenamientos</div>
                <div className="sd-section-sub">
                  {workouts.length > 0
                    ? `${completedW} completados · ${stats.totalMin > 0 ? `${stats.totalMin} min acumulados` : 'sin duración registrada'}${stats.avgRpe ? ` · RPE prom. ${stats.avgRpe}` : ''}`
                    : 'Sin actividad registrada todavía'}
                </div>
              </div>
              {clientId && (
                <WorkoutFeed
                  clientId={clientId}
                  author={{ name: profile.full_name ?? 'Alumno', avatarUrl: profile.avatar_url ?? null }}
                  viewer={{ name: trainerProfile?.full_name ?? 'Vos', avatarUrl: trainerProfile?.avatar_url ?? null }}
                />
              )}
            </div>

            <div className="sd-training-col">
              <div className="sd-col-head">
                <div className="section-title">Programa activo</div>
                <div className="sd-section-sub">El plan que el cliente está siguiendo hoy</div>
              </div>
              {clientId && <ClientProgramPanel clientId={clientId} />}
            </div>
          </div>
        )}

        {/* ESTADÍSTICAS DE EJERCICIOS */}
        {tab === 'exstats' && clientId && (
          <ExerciseStatsPanel clientId={clientId} />
        )}

        {/* ESTADÍSTICAS AVANZADAS */}
        {tab === 'avanzado' && clientId && (
          <AdvancedStatsPanel clientId={clientId} />
        )}

        {/* NUTRICIÓN */}
        {tab === 'nutricion' && clientId && (
          <NutritionPanel clientId={clientId} />
        )}

        {/* MEDIDAS */}
        {tab === 'medidas' && clientId && (
          <BodyMeasurementsPanel clientId={clientId} />
        )}

        {/* FOTOS */}
        {tab === 'fotos' && (
          <div className="card">
            <div className="section-title" style={{ marginBottom: 14 }}>Historial de fotos de progreso</div>
            {photos.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>Sin fotos de progreso todavía.</p>
            ) : (
              <div className="photo-gallery">
                {photos.map((ph) => {
                  const url = photoUrls[ph.photo_url];
                  const caption = `${POSITION_LABEL[ph.position] ?? ph.position} · ${new Date(ph.recorded_at).toLocaleDateString('es-AR')}`;
                  return (
                    <figure key={ph.id} className="photo-gallery-item">
                      {url ? (
                        <img
                          src={url}
                          alt={caption}
                          className="photo-gallery-img"
                          onClick={() => setLightbox({ src: url, caption: `${profile?.full_name ?? 'Alumno'} · ${caption}` })}
                        />
                      ) : (
                        <div className="photo-gallery-skeleton skeleton" />
                      )}
                      <figcaption className="photo-gallery-cap">{caption}</figcaption>
                    </figure>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* CONSULTA */}
        {tab === 'consulta' && (
          <ConsultationTab data={consultation} />
        )}

        {/* FACTURACIÓN */}
        {tab === 'facturacion' && (
          <BillingTab subscription={subscription} charges={charges} loading={chargesLoading} />
        )}

        {/* DESLINDE */}
        {tab === 'deslinde' && (
          <WaiverTab sig={waiverSig} imageConsent={imageConsent} profile={profile} />
        )}

        {/* CONFIGURACIÓN */}
        {tab === 'config' && clientId && (
          <ClientSettingsPanel
            clientId={clientId}
            fullName={profile.full_name}
            phone={profile.phone}
            clientStatus={profile.client_status ?? 'pending'}
            createdAt={profile.created_at}
            onSaved={(patch) => setProfile((p) => (p ? { ...p, ...patch } : p))}
          />
        )}

        {/* ENGAGEMENT */}
        {tab === 'engagement' && (
          <div className="sd-grid-3">
            <div className="card">
              <div className="section-title" style={{ marginBottom: 14 }}>Actividad</div>
              <dl className="data-list">
                <Datum label="Total entrenamientos" value={String(workouts.length)} />
                <Datum label="Completados" value={String(completedW)} />
                <Datum label="Tasa de completado" value={workouts.length > 0 ? `${Math.round((completedW / workouts.length) * 100)}%` : '—'} />
                <Datum label="Comidas registradas" value={String(meals.length)} />
                <Datum label="Mediciones" value={String(measurements.length)} />
              </dl>
            </div>
            <div className="card">
              <div className="section-title" style={{ marginBottom: 14 }}>Mensajes</div>
              <dl className="data-list">
                <Datum label="Total mensajes" value={String(messages.length)} />
                <Datum label="Del alumno" value={String(messages.filter((m) => m.sender_role === 'client').length)} />
                <Datum label="Del entrenador" value={String(messages.filter((m) => m.sender_role === 'trainer').length)} />
                <Datum label="Sin leer" value={String(messages.filter((m) => !m.read && m.sender_role === 'client').length)} />
              </dl>
            </div>
            <div className="card">
              <div className="section-title" style={{ marginBottom: 14 }}>Progreso físico</div>
              <dl className="data-list">
                <Datum label="Primer peso" value={measurements.length > 0 ? `${measurements[measurements.length - 1]?.weight_kg ?? '—'} kg` : '—'} />
                <Datum label="Último peso" value={latestM?.weight_kg != null ? `${latestM.weight_kg} kg` : '—'} />
                <Datum label="Variación" value={
                  measurements.length >= 2 && latestM?.weight_kg != null && measurements[measurements.length - 1]?.weight_kg != null
                    ? `${(latestM.weight_kg - measurements[measurements.length - 1]!.weight_kg!).toFixed(1)} kg`
                    : '—'
                } />
                <Datum label="% Grasa actual" value={latestM?.body_fat_pct != null ? `${latestM.body_fat_pct}%` : '—'} />
              </dl>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .sd-page { display: flex; flex-direction: column; gap: 0; }

        /* Hero header */
        .sd-hero {
          position: relative;
          overflow: hidden;
          padding: 0;
          margin-bottom: 20px;
        }
        .sd-hero-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          padding: 24px 24px 20px;
          flex-wrap: wrap;
        }
        .sd-hero-identity { display: flex; align-items: center; gap: 18px; min-width: 0; flex: 1; }
        .sd-avatar {
          width: 72px; height: 72px; border-radius: 50%; flex-shrink: 0;
          background: var(--surface-elevated);
          color: var(--text-secondary); font-size: 24px; font-weight: 600;
          display: flex; align-items: center; justify-content: center;
          border: 1px solid var(--border);
        }
        .sd-name-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .sd-name { font-size: 23px; font-weight: 700; color: var(--text-primary); letter-spacing: -0.025em; line-height: 1.2; }
        .sd-goal-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 5px; }
        .sd-goal { font-size: 14px; color: var(--text-secondary); }
        .sd-level {
          font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .04em;
          padding: 2px 9px; border-radius: 999px;
          background: var(--surface-elevated);
          border: 1px solid var(--border);
          color: var(--text-secondary);
        }
        .sd-meta { display: flex; align-items: center; gap: 7px; margin-top: 10px; flex-wrap: wrap; font-size: 12.5px; color: var(--text-tertiary); }
        .sd-meta-sep { opacity: .5; }
        .sd-header-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; flex-wrap: wrap; justify-content: flex-end; }
        .sd-action { display: inline-flex; align-items: center; gap: 7px; }
        .sd-action svg { opacity: .85; }

        .sd-stat-grid {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 1px;
          background: var(--border);
          border-top: 1px solid var(--border);
        }
        .sd-hero-stat {
          background: var(--surface);
          padding: 16px 18px;
          display: flex; flex-direction: column; gap: 3px;
          min-width: 0;
        }
        .sd-hero-stat-val { font-size: 21px; font-weight: 700; color: var(--text-primary); letter-spacing: -0.03em; line-height: 1.1; font-variant-numeric: tabular-nums; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .sd-hero-stat.highlight .sd-hero-stat-val { color: var(--primary); }
        .sd-hero-stat-lbl { font-size: 10px; font-weight: 600; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: .07em; }
        .sd-hero-stat-sub { font-size: 11px; color: var(--text-tertiary); margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

        .sd-last-workout {
          display: flex;
          gap: 16px;
          align-items: flex-start;
          padding: 16px 24px 18px;
          border-top: 1px solid var(--border);
        }
        .sd-last-workout-label {
          font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em;
          color: var(--text-tertiary); white-space: nowrap; padding-top: 3px; min-width: 88px;
        }
        .sd-last-workout-name { font-size: 15px; font-weight: 600; color: var(--text-primary); }
        .sd-last-workout-meta {
          display: flex; align-items: center; flex-wrap: wrap; gap: 4px;
          font-size: 12.5px; color: var(--text-tertiary); margin-top: 4px;
        }
        .sd-dot-sep { opacity: .5; }
        .sd-last-workout-comment {
          margin-top: 8px; font-size: 12.5px; color: var(--text-secondary); font-style: italic;
          padding: 8px 12px; border-radius: 8px; background: var(--surface-elevated); border: 1px solid var(--border);
          max-width: 640px;
        }

        .sd-section-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; gap: 12px; }
        .sd-section-sub { font-size: 12.5px; color: var(--text-tertiary); margin-top: 4px; }

        .sd-table-wrap { overflow-x: auto; margin: 0 -4px; }
        .sd-workout-table { width: 100%; border-collapse: collapse; min-width: 720px; }
        .sd-workout-table th {
          text-align: left; font-size: 11px; font-weight: 600; text-transform: uppercase;
          letter-spacing: .06em; color: var(--text-tertiary); padding: 10px 12px;
          border-bottom: 1px solid var(--border); white-space: nowrap;
        }
        .sd-workout-table td {
          padding: 12px; border-bottom: 1px solid var(--border); vertical-align: top;
          font-size: 13.5px; color: var(--text-primary);
        }
        .sd-workout-table tr:last-child td { border-bottom: none; }
        .sd-workout-table tr:hover td { background: var(--surface-hover); }
        .sd-workout-name { font-weight: 600; color: var(--text-primary); }
        .sd-workout-comment {
          font-size: 12px; color: var(--text-tertiary); margin-top: 4px; font-style: italic;
          max-width: 280px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .sd-workout-lines {
          margin: 6px 0 0;
          padding: 0;
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        .sd-workout-lines li {
          font-size: 12px;
          color: var(--text-secondary);
          line-height: 1.35;
        }
        .badge.sm { font-size: 11px; padding: 2px 8px; }

        @media (max-width: 1100px) { .sd-stat-grid { grid-template-columns: repeat(3, 1fr); } }
        @media (max-width: 640px) {
          .sd-stat-grid { grid-template-columns: repeat(2, 1fr); }
          .sd-hero-top { padding: 16px; }
          .sd-last-workout { flex-direction: column; padding: 14px 16px 16px; }
        }

        /* Tabs — underlined nav (look & feel: app.hevycoach.com/clients/:id) */
        .sd-tabs {
          display: flex; gap: 22px; margin-bottom: 24px;
          overflow-x: auto; overflow-y: hidden;
          border-bottom: 1px solid var(--border); max-width: 100%;
          scrollbar-width: none;
        }
        .sd-tabs::-webkit-scrollbar { display: none; height: 0; }
        .sd-tab {
          display: flex; align-items: center; gap: 6px;
          padding: 10px 2px; font-size: 13.5px; font-weight: 600;
          color: var(--text-tertiary); background: none; border: none; cursor: pointer;
          white-space: nowrap; flex-shrink: 0;
          border-bottom: 2px solid transparent; margin-bottom: -1px;
          transition: color 150ms, border-color 150ms;
        }
        .sd-tab:hover { color: var(--text-primary); }
        .sd-tab.active { color: var(--text-primary); border-bottom-color: var(--text-primary); }

        .sd-content { min-height: 300px; }
        .sd-grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
        @media (max-width: 900px) { .sd-grid-3 { grid-template-columns: 1fr; } }

        /* Resumen 2×2 grid */
        .sd-summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; align-items: start; }
        @media (max-width: 900px) { .sd-summary-grid { grid-template-columns: 1fr; } }
        .sd-panel-head-row { flex-direction: row; align-items: flex-start; justify-content: space-between; gap: 12px; }
        .sd-panel-link {
          display: inline-flex; align-items: center; gap: 3px; flex-shrink: 0;
          font-size: 12.5px; font-weight: 600; color: var(--primary);
          background: none; border: none; cursor: pointer; padding: 2px 0;
        }
        .sd-panel-link:hover { opacity: .75; }
        .sd-panel-link svg { opacity: .8; }

        /* Último entrenamiento card */
        .sd-workout-card { display: flex; flex-direction: column; gap: 14px; }
        .sd-workout-card-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
        .sd-workout-card-name { font-size: 15px; font-weight: 600; color: var(--text-primary); }
        .sd-workout-card-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
        .sd-workout-card-stats > div { display: flex; flex-direction: column; gap: 2px; }
        .sd-wc-val { font-size: 18px; font-weight: 700; color: var(--text-primary); letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
        .sd-wc-lbl { font-size: 11px; color: var(--text-tertiary); }
        .sd-rpe-track { height: 6px; border-radius: 999px; background: var(--surface-elevated); overflow: hidden; }
        .sd-rpe-fill { height: 100%; border-radius: 999px; background: var(--primary); }
        .sd-workout-card-comment { font-size: 12.5px; color: var(--text-secondary); font-style: italic; padding-top: 2px; }

        /* Atención recomendada */
        .sd-alert-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
        .sd-alert { display: flex; align-items: flex-start; gap: 10px; padding: 11px 0; font-size: 13.5px; color: var(--text-primary); border-bottom: 1px solid var(--border); }
        .sd-alert:last-child { border-bottom: none; }
        .sd-alert-dot { width: 7px; height: 7px; border-radius: 50%; margin-top: 6px; flex-shrink: 0; }
        .sd-alert-warn .sd-alert-dot { background: var(--warning, #f59e0b); }
        .sd-alert-info .sd-alert-dot { background: var(--text-tertiary); }
        .sd-all-good { display: flex; align-items: center; gap: 10px; padding: 8px 0; font-size: 13.5px; color: var(--text-secondary); }
        .sd-all-good-check {
          width: 24px; height: 24px; border-radius: 50%; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          font-size: 12px; font-weight: 700; background: var(--green-soft); color: var(--green-strong);
        }

        /* Resumen panels */
        .sd-panel { padding: 20px 22px; display: flex; flex-direction: column; gap: 18px; }
        .sd-panel-head { display: flex; flex-direction: column; gap: 2px; }
        .sd-panel-sub { font-size: 12.5px; color: var(--text-tertiary); }
        .sd-panel-empty {
          padding: 28px 16px; text-align: center; font-size: 13px; color: var(--text-tertiary);
        }
        .sd-goal-assign-list {
          list-style: none; margin: 0 0 12px; padding: 0;
          display: flex; flex-direction: column; gap: 8px;
        }
        .sd-goal-assign-item {
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
          padding: 10px 12px; border-radius: 10px; background: var(--surface-elevated);
          border: 1px solid var(--border); font-size: 13px;
        }
        .sd-goal-preset-row { display: flex; flex-wrap: wrap; gap: 8px; }
        .sd-info-grid {
          display: grid; grid-template-columns: 1fr 1fr;
          column-gap: 20px; row-gap: 16px;
        }
        .sd-info-tile { min-width: 0; }
        .sd-info-tile.full { grid-column: 1 / -1; }
        .sd-info-tile-lbl { font-size: 10.5px; font-weight: 600; text-transform: uppercase; letter-spacing: .06em; color: var(--text-tertiary); margin-bottom: 5px; }
        .sd-info-tile-val { font-size: 14px; font-weight: 500; color: var(--text-primary); }
        .sd-plan-warning {
          margin-top: 12px; padding: 9px 12px; border-radius: var(--radius-sm);
          border: 1px solid rgba(217,119,6,0.3); background: rgba(217,119,6,0.08);
          color: #b45309; font-size: 12.5px; line-height: 1.4;
        }

        .sd-measure-grid { display: grid; grid-template-columns: 1fr 1fr; column-gap: 20px; row-gap: 18px; }
        .sd-measure-tile { min-width: 0; }
        .sd-measure-tile-val { font-size: 26px; font-weight: 700; letter-spacing: -0.03em; color: var(--text-primary); line-height: 1; font-variant-numeric: tabular-nums; }
        .sd-measure-tile.accent .sd-measure-tile-val { color: var(--primary); }
        .sd-measure-tile-unit { font-size: 13px; font-weight: 500; color: var(--text-tertiary); }
        .sd-measure-tile-lbl { font-size: 11.5px; color: var(--text-tertiary); margin-top: 7px; font-weight: 500; }

        .sd-activity-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
        .sd-activity-item {
          display: flex; align-items: center; gap: 12px;
          padding: 12px 0; border-bottom: 1px solid var(--border);
        }
        .sd-activity-item:last-child { border-bottom: none; }
        .sd-activity-icon {
          width: 26px; height: 26px; border-radius: 50%; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          font-size: 12px; font-weight: 700;
          background: var(--green-soft); color: var(--green-strong);
        }
        .sd-activity-item:has(.badge.amber) .sd-activity-icon {
          background: var(--surface-elevated); color: var(--text-tertiary);
        }
        .sd-activity-body { flex: 1; min-width: 0; }
        .sd-activity-title { font-size: 13.5px; font-weight: 600; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .sd-activity-meta { font-size: 12px; color: var(--text-tertiary); margin-top: 2px; }

        .photo-gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 14px; }
        .photo-gallery-item { margin: 0; display: flex; flex-direction: column; gap: 6px; }
        .photo-gallery-img {
          width: 100%; aspect-ratio: 3 / 4; object-fit: cover;
          border-radius: var(--radius-sm); border: 1px solid var(--border);
          cursor: zoom-in; transition: transform 160ms var(--ease), box-shadow 160ms var(--ease);
        }
        .photo-gallery-img:hover { transform: translateY(-2px); box-shadow: var(--shadow); }
        .photo-gallery-skeleton { width: 100%; aspect-ratio: 3 / 4; border-radius: var(--radius-sm); }
        .photo-gallery-cap { font-size: 12px; color: var(--text-tertiary); text-transform: capitalize; }
      `}</style>

      {profile ? (
        <ManualPaymentModal
          open={manualPayOpen}
          onClose={() => setManualPayOpen(false)}
          clients={[{ id: profile.id, full_name: profile.full_name }]}
          plans={plans}
          initialClientId={profile.id}
          onSuccess={() => void onManualPaymentSuccess()}
        />
      ) : null}

      <Lightbox src={lightbox?.src ?? null} caption={lightbox?.caption} onClose={() => setLightbox(null)} />

      <ConfirmDialog
        open={cancelConfirmOpen}
        title="Cancelar suscripción"
        message="Se corta el cobro automático en MercadoPago. El alumno mantiene el acceso hasta el final del período ya pagado."
        confirmLabel={cancelling ? 'Cancelando…' : 'Cancelar suscripción'}
        cancelLabel="Volver"
        onConfirm={() => void doCancelSubscription()}
        onCancel={() => setCancelConfirmOpen(false)}
        danger
      />
    </div>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function HeroStat({
  label,
  value,
  sub,
  highlight = false,
}: {
  label: string;
  value: string | number;
  sub?: string;
  highlight?: boolean;
}): React.JSX.Element {
  return (
    <div className={`sd-hero-stat${highlight ? ' highlight' : ''}`}>
      <div className="sd-hero-stat-lbl">{label}</div>
      <div className="sd-hero-stat-val">{value}</div>
      {sub ? <div className="sd-hero-stat-sub">{sub}</div> : null}
    </div>
  );
}


function Datum({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="datum">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

// ── WaiverTab ─────────────────────────────────────────────────────────────────

function strokesToSvgPaths(sigData: string): React.ReactNode {
  try {
    if (sigData.startsWith('[')) {
      const strokes = JSON.parse(sigData) as number[][][];
      return strokes.map((stroke, i) =>
        stroke.length < 2 ? null : (
          <path
            key={i}
            d={stroke.map((pt, j) => `${j === 0 ? 'M' : 'L'}${pt[0]},${pt[1]}`).join(' ')}
            fill="none" stroke="#1e293b" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round"
          />
        )
      );
    }
  } catch { /* ignore */ }
  return <text x="10" y="40" fontSize="13" fill="#94a3b8">Firma guardada</text>;
}

/** Generates an SVG data-URL from strokes for embedding in the print window */
function strokesToSvgDataUrl(sigData: string): string {
  try {
    const strokes = JSON.parse(sigData) as number[][][];
    const paths = strokes.map((stroke) =>
      stroke.length < 2 ? '' :
        `<path d="${stroke.map((pt, j) => `${j === 0 ? 'M' : 'L'}${pt[0]},${pt[1]}`).join(' ')}" fill="none" stroke="#1e293b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`
    ).join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 120" width="320" height="120">${paths}</svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  } catch {
    return '';
  }
}

function openEvidencePDF(ws: WaiverSignature, clientName: string): void {
  const sigUrl  = strokesToSvgDataUrl(ws.signature_data);
  const dateStr = new Date(ws.signed_at).toLocaleString('es-AR', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
  });
  const docTitle = ws.document_title || 'Deslinde de Responsabilidad';
  const docBody  = (ws.document_snapshot || '(sin texto guardado)').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const recordId = ws.id;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8"/>
  <title>${docTitle} — ${clientName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    @page { size: A4; margin: 20mm 20mm 24mm; }
    body { font-family: 'Times New Roman', Times, serif; font-size: 11pt; color: #1a1a1a; line-height: 1.6; }
    .header { border-bottom: 2pt solid #1a1a1a; padding-bottom: 10pt; margin-bottom: 18pt; display: flex; justify-content: space-between; align-items: flex-start; }
    .header-title { font-size: 16pt; font-weight: bold; letter-spacing: .02em; }
    .header-meta { font-size: 8.5pt; color: #555; text-align: right; line-height: 1.8; font-family: Arial, sans-serif; }
    .section-label { font-size: 7.5pt; font-family: Arial, sans-serif; font-weight: bold; text-transform: uppercase; letter-spacing: .1em; color: #666; margin-bottom: 4pt; }
    .doc-body { white-space: pre-wrap; font-size: 10.5pt; line-height: 1.75; margin-bottom: 24pt; }
    .divider { border: none; border-top: 1pt solid #ccc; margin: 20pt 0; }
    .sig-section { display: flex; gap: 40pt; align-items: flex-start; }
    .sig-box { flex: 1; }
    .sig-canvas { border: 1pt solid #888; border-radius: 4pt; background: #fafafa; width: 260pt; height: 80pt; display: flex; align-items: center; justify-content: center; overflow: hidden; }
    .sig-canvas img { max-width: 100%; max-height: 100%; object-fit: contain; }
    .meta-box { flex: 1; font-size: 9.5pt; font-family: Arial, sans-serif; }
    .meta-row { display: flex; margin-bottom: 6pt; }
    .meta-key { font-weight: bold; width: 120pt; flex-shrink: 0; color: #444; }
    .meta-val { color: #1a1a1a; word-break: break-all; }
    .footer { position: fixed; bottom: 0; left: 0; right: 0; border-top: 1pt solid #ccc; padding-top: 6pt; font-size: 7.5pt; font-family: Arial, sans-serif; color: #888; display: flex; justify-content: space-between; }
    .legal-notice { margin-top: 24pt; padding: 10pt 14pt; border: 1pt solid #ccc; border-radius: 4pt; background: #f9f9f9; font-size: 8.5pt; font-family: Arial, sans-serif; color: #555; line-height: 1.6; }
    @media print { .no-print { display: none; } }
  </style>
</head>
<body>

<div class="no-print" style="background:#1e293b;color:#fff;padding:12px 20px;display:flex;align-items:center;justify-content:space-between;font-family:Arial,sans-serif;font-size:13px;">
  <span>📄 Documento de evidencia — <strong>${docTitle}</strong></span>
  <button onclick="window.print()" style="background:#3b82f6;color:#fff;border:none;padding:8px 18px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600;">Guardar como PDF</button>
</div>

<div class="header">
  <div>
    <div class="header-title">${docTitle}</div>
    <div style="font-size:9.5pt;font-family:Arial,sans-serif;color:#555;margin-top:4pt;">Documento firmado digitalmente · Evidencia legal</div>
  </div>
  <div class="header-meta">
    ID Firma: ${recordId}<br/>
    Firmado: ${dateStr}
  </div>
</div>

<div class="section-label">Texto del documento al momento de la firma</div>
<div class="doc-body">${docBody}</div>

<hr class="divider"/>

<div class="section-label" style="margin-bottom:14pt;">Información de la firma</div>
<div class="sig-section">
  <div class="sig-box">
    <div class="section-label" style="margin-bottom:6pt;">Firma manuscrita digital</div>
    <div class="sig-canvas">
      ${sigUrl ? `<img src="${sigUrl}" alt="Firma digital"/>` : '<span style="font-size:9pt;color:#aaa;font-family:Arial">Sin trazado</span>'}
    </div>
    <div style="margin-top:8pt;font-size:9pt;font-family:Arial,sans-serif;color:#666;">Firmante: <strong>${ws.full_name}</strong></div>
  </div>
  <div class="meta-box">
    <div class="section-label" style="margin-bottom:8pt;">Datos registrados</div>
    <div class="meta-row"><span class="meta-key">Nombre completo:</span><span class="meta-val">${ws.full_name}</span></div>
    <div class="meta-row"><span class="meta-key">Cliente (ID):</span><span class="meta-val">${ws.id}</span></div>
    <div class="meta-row"><span class="meta-key">Fecha y hora:</span><span class="meta-val">${dateStr}</span></div>
    <div class="meta-row"><span class="meta-key">Documento:</span><span class="meta-val">${docTitle}</span></div>
    <div class="meta-row"><span class="meta-key">Método:</span><span class="meta-val">Firma digital con dedo / mouse en app Reset Fit</span></div>
  </div>
</div>

<div class="legal-notice">
  <strong>Nota legal:</strong> Este documento constituye evidencia de que el firmante aceptó los términos del deslinde de responsabilidad descritos arriba. La firma fue capturada digitalmente mediante la aplicación Reset Fit, con registro de identidad (nombre completo), fecha y hora UTC. El texto guardado corresponde exactamente al documento presentado al firmante al momento de la aceptación (snapshot inmutable). Este registro puede ser utilizado como evidencia ante reclamaciones.
</div>

<div class="footer">
  <span>Generado por Reset Fit · ${new Date().toLocaleDateString('es-AR')}</span>
  <span>ID: ${recordId}</span>
</div>

</body>
</html>`;

  const w = window.open('', '_blank', 'width=900,height=1100');
  if (w) { w.document.write(html); w.document.close(); }
}

const CHARGE_STATUS_LABEL: Record<string, string> = {
  approved: 'Pagada',
  processed: 'Pagada',
  pending: 'Pendiente',
  rejected: 'Rechazada',
  cancelled: 'Cancelada',
};

function BillingTab({
  subscription,
  charges,
  loading,
}: {
  subscription: ClientSubscription | null;
  charges: SubscriptionCharge[];
  loading: boolean;
}): React.JSX.Element {
  const daysLeft = daysUntil(subscription?.expires_at ?? null);
  // La alerta de "actualizá el precio en MP" solo importa mientras el ciclo
  // sigue activo — si ya no hay price_changed no hay nada que avisar acá.
  const showPriceAlert = !!subscription?.price_changed;
  const urgent = showPriceAlert && daysLeft != null && daysLeft < 10;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {showPriceAlert ? (
        <div
          className="card"
          style={{
            borderColor: urgent ? '#dc2626' : '#d97706',
            background: urgent ? '#fef2f2' : '#fffbeb',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <span style={{ fontSize: 20 }}>{urgent ? '🔴' : '⚠️'}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14.5, color: urgent ? '#991b1b' : '#92400e', marginBottom: 4 }}>
                El precio de esta frecuencia cambió
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                Este cliente paga {formatMoney(subscription!.price_changed!.paid, 'es')} por mes, pero el precio actual
                de esta frecuencia es {formatMoney(subscription!.price_changed!.current, 'es')}. Debe actualizarse el
                monto de la suscripción en Mercado Pago
                {daysLeft != null ? (
                  <> antes de que renueve{daysLeft >= 0 ? ` en ${daysLeft} día${daysLeft === 1 ? '' : 's'}` : ' — ya venció'}.</>
                ) : (
                  <> al finalizar el período actual.</>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '18px 20px 4px' }}>
          <div className="section-title">Facturas</div>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: 12.5 }}>
            Un cobro por mes de la suscripción recurrente de Mercado Pago. El PDF de la factura se va a generar
            automáticamente acá ni bien esté listo el conector con el facturador electrónico.
          </p>
        </div>
        {loading ? (
          <div style={{ padding: 20 }}><Spinner /></div>
        ) : charges.length === 0 ? (
          <div className="empty-state">
            <div className="t">Todavía no hay cobros registrados</div>
            <p className="muted" style={{ margin: 0 }}>Van a aparecer acá a medida que Mercado Pago confirme cada cobro mensual.</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Mes</th>
                <th>Monto</th>
                <th>Estado</th>
                <th>PDF</th>
              </tr>
            </thead>
            <tbody>
              {charges.map((c) => (
                <tr key={c.id}>
                  <td>{new Date(c.charged_at).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}</td>
                  <td className="muted">{c.amount_ars != null ? formatMoney(c.amount_ars, 'es') : '—'}</td>
                  <td className="muted">{CHARGE_STATUS_LABEL[c.status ?? ''] ?? c.status ?? '—'}</td>
                  <td><span className="muted" style={{ fontSize: 12.5 }}>No disponible aún</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function WaiverTab({
  sig,
  imageConsent,
  profile,
}: {
  sig: WaiverSignature | null | false;
  imageConsent: ImageConsentAcceptance | null | false;
  profile: Profile | null;
}): React.JSX.Element {
  const isSigned = sig !== null && sig !== false;
  const ws = isSigned ? (sig as WaiverSignature) : null;
  const icRow = imageConsent !== null && imageConsent !== false ? (imageConsent as ImageConsentAcceptance) : null;
  const ic = icRow?.status === 'accepted' ? icRow : null;
  const icDeclined = icRow?.status === 'declined' ? icRow : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

    {/* Términos y condiciones */}
    <div className="card">
      <div className="section-title" style={{ marginBottom: 16 }}>Términos y condiciones</div>
      {profile?.terms_accepted_at ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 34, height: 34, borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>✓</span>
          <div>
            <div style={{ fontWeight: 700, color: '#16a34a', fontSize: 15 }}>Aceptados</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>
              {new Date(profile.terms_accepted_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              {' · '}
              <a href={APP_TERMS_URL} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>
                Ver documento{profile.terms_version ? ` (v. ${profile.terms_version})` : ''}
              </a>
              {profile.terms_version && profile.terms_version !== TERMS_VERSION ? (
                <span style={{ color: '#ca8a04' }}> · hay una versión más nueva</span>
              ) : null}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 34, height: 34, borderRadius: '50%', background: '#fef9c3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>!</span>
          <div>
            <div style={{ fontWeight: 700, color: '#ca8a04', fontSize: 15 }}>No registrado</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>
              Esta cuenta se creó antes de que empezáramos a registrar la aceptación de Términos y Condiciones.
            </div>
          </div>
        </div>
      )}
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20 }}>

      {/* Status card */}
      <div className="card">
        <div className="section-title" style={{ marginBottom: 16 }}>Estado del deslinde</div>
        {ws ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <span style={{ width: 34, height: 34, borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>✓</span>
              <div>
                <div style={{ fontWeight: 700, color: '#16a34a', fontSize: 15 }}>Firmado</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>
                  {new Date(ws.signed_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
            <dl className="data-list" style={{ marginBottom: 20 }}>
              <Datum label="Nombre registrado" value={ws.full_name || '—'} />
              <Datum label="Documento"         value={ws.document_title || 'Deslinde de Responsabilidad'} />
              <Datum label="Firmado el"        value={new Date(ws.signed_at).toLocaleDateString('es-AR')} />
              <Datum label="ID de firma"       value={ws.id.slice(0, 8) + '…'} />
            </dl>

            {/* Download evidence button */}
            <button
              className="btn"
              style={{ width: '100%', justifyContent: 'center', gap: 8, display: 'flex', alignItems: 'center' }}
              onClick={() => openEvidencePDF(ws, ws.full_name)}
            >
              <span style={{ fontSize: 15 }}>⬇</span> Descargar documento firmado (PDF)
            </button>
            <p style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 10, lineHeight: 1.5 }}>
              El PDF incluye el texto exacto al momento de la firma, la firma manuscrita digital, fecha/hora y el ID único del registro — válido como evidencia legal.
            </p>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 34, height: 34, borderRadius: '50%', background: '#fef9c3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>!</span>
              <div>
                <div style={{ fontWeight: 700, color: '#ca8a04', fontSize: 15 }}>Pendiente</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>El alumno todavía no firmó el deslinde</div>
              </div>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.6, padding: '12px 14px', borderRadius: 8, background: 'var(--surface-elevated)', border: '1px solid var(--border)' }}>
              La firma se solicitará automáticamente al alumno la próxima vez que abra la app mobile, si tenés el deslinde configurado y activo en{' '}
              <a href="/settings/waiver" style={{ color: 'var(--primary)' }}>Settings → Deslinde</a>.
            </div>
          </div>
        )}
      </div>

      {/* Signature preview */}
      <div className="card">
        <div className="section-title" style={{ marginBottom: 16 }}>Firma digital</div>
        {ws ? (
          <>
            <div style={{ border: '1.5px solid var(--border)', borderRadius: 8, overflow: 'hidden', background: '#f8fafc', minHeight: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg viewBox="0 0 320 120" width="100%" height={120} style={{ display: 'block' }}>
                {strokesToSvgPaths(ws.signature_data)}
              </svg>
            </div>
            <div style={{ marginTop: 10, fontSize: 11.5, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
              Trazado manuscrito digital · capturado en {new Date(ws.signed_at).toLocaleDateString('es-AR')}
            </div>
            {ws.document_snapshot && (
              <details style={{ marginTop: 14 }}>
                <summary style={{ fontSize: 12.5, color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600 }}>Ver texto firmado</summary>
                <div style={{ marginTop: 10, padding: '12px 14px', background: 'var(--surface-elevated)', borderRadius: 8, fontSize: 12, lineHeight: 1.7, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', maxHeight: 220, overflowY: 'auto', border: '1px solid var(--border)' }}>
                  {ws.document_snapshot}
                </div>
              </details>
            )}
          </>
        ) : (
          <div style={{ border: '1.5px dashed #cbd5e1', borderRadius: 8, minHeight: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 13.5 }}>
            Sin firma registrada
          </div>
        )}
      </div>
    </div>

    <div className="card">
      <div className="section-title" style={{ marginBottom: 16 }}>Consentimiento de imágenes</div>
      {ic ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <span style={{ width: 34, height: 34, borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>✓</span>
            <div>
              <div style={{ fontWeight: 700, color: '#16a34a', fontSize: 15 }}>Aceptado</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>
                {new Date(ic.accepted_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
          <dl className="data-list" style={{ marginBottom: 16 }}>
            <Datum label="Nombre registrado" value={ic.full_name || '—'} />
            <Datum label="Documento"         value={ic.document_title || 'Consentimiento de uso de imágenes'} />
            <Datum label="Aceptado el"       value={new Date(ic.accepted_at).toLocaleDateString('es-AR')} />
            <Datum label="ID de registro"    value={ic.id.slice(0, 8) + '…'} />
          </dl>
          {ic.document_snapshot ? (
            <details>
              <summary style={{ fontSize: 12.5, color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600 }}>Ver texto aceptado</summary>
              <div style={{ marginTop: 10, padding: '12px 14px', background: 'var(--surface-elevated)', borderRadius: 8, fontSize: 12, lineHeight: 1.7, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', maxHeight: 220, overflowY: 'auto', border: '1px solid var(--border)' }}>
                {ic.document_snapshot}
              </div>
            </details>
          ) : null}
        </>
      ) : icDeclined ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <span style={{ width: 34, height: 34, borderRadius: '50%', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>✕</span>
            <div>
              <div style={{ fontWeight: 700, color: '#dc2626', fontSize: 15 }}>Rechazado</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>
                {new Date(icDeclined.accepted_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.6, padding: '12px 14px', borderRadius: 8, background: 'var(--surface-elevated)', border: '1px solid var(--border)' }}>
            El alumno eligió "Ahora no" para el consentimiento de uso de imágenes. Puede cambiar su respuesta en cualquier momento desde su Perfil en la app.
          </div>
        </>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 34, height: 34, borderRadius: '50%', background: '#fef9c3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>!</span>
          <div>
            <div style={{ fontWeight: 700, color: '#ca8a04', fontSize: 15 }}>Pendiente</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>
              El alumno todavía no respondió al consentimiento de imágenes
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  );
}

// ── ConsultationTab ───────────────────────────────────────────────────────────

function ConsultationTab({ data }: { data: ConsultationResponse | null | false }): React.JSX.Element {
  if (!data) {
    return (
      <div className="card" style={{ maxWidth: 560 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <span style={{ width: 34, height: 34, borderRadius: '50%', background: '#fef9c3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>!</span>
          <div>
            <div style={{ fontWeight: 700, color: '#ca8a04', fontSize: 15 }}>Pendiente</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>El alumno todavía no completó el formulario de consulta</div>
          </div>
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.6, padding: '12px 14px', borderRadius: 8, background: 'var(--surface-elevated)', border: '1px solid var(--border)' }}>
          La próxima vez que el alumno abra la app, se le solicitará completar el formulario —
          siempre que hayas configurado uno en{' '}
          <a href="/settings/consultation" style={{ color: 'var(--primary)' }}>Settings → Formulario de consulta</a>.
        </div>
      </div>
    );
  }

  const submittedDate = new Date(data.submitted_at).toLocaleDateString('es-AR', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 680 }}>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'var(--surface-elevated)', borderRadius: 8, border: '1px solid var(--border)' }}>
        <span style={{ width: 28, height: 28, borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>✓</span>
        <div>
          <span style={{ fontWeight: 700, color: '#16a34a', fontSize: 13.5 }}>Completado</span>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)', marginLeft: 8 }}>· {submittedDate}</span>
        </div>
      </div>

      {data.responses.map((entry, idx) => (
        <div key={idx} className="card" style={{ padding: '14px 18px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8, lineHeight: 1.5 }}>
            {entry.label}
          </div>
          {Array.isArray(entry.answer) ? (
            entry.answer.length === 0 ? (
              <span style={{ fontSize: 13, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>Sin respuesta</span>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {entry.answer.map((a) => (
                  <span key={a} style={{
                    fontSize: 12.5, fontWeight: 500, color: 'var(--text-primary)',
                    background: 'color-mix(in srgb, var(--primary) 12%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--primary) 30%, transparent)',
                    borderRadius: 6, padding: '3px 10px',
                  }}>
                    {a}
                  </span>
                ))}
              </div>
            )
          ) : (
            <span style={{ fontSize: 13.5, color: entry.answer ? 'var(--text-primary)' : 'var(--text-tertiary)', fontStyle: entry.answer ? undefined : 'italic' }}>
              {entry.answer || 'Sin respuesta'}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
