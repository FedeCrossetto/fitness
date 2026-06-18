import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import type {
  BodyMeasurementRow,
  MealLogRow,
  MessageRow,
  ProfileRow,
  UserProfileRow,
  WorkoutLogRow,
} from '@habito/shared/types/database';
import { supabase } from '@/lib/supabase';
import { RoutineManager } from '@/components/RoutineManager';

const anyClient = supabase as unknown as { from: (t: string) => ReturnType<typeof supabase.from> };

interface WaiverSignature {
  id: string;
  full_name: string;
  signed_at: string;
  signature_data: string;
  document_snapshot: string;
  document_title: string;
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

type Profile = Pick<ProfileRow, 'id' | 'full_name' | 'goal' | 'phone' | 'avatar_url' | 'created_at'> & {
  client_status?: 'pending' | 'active';
};

type Tab = 'resumen' | 'entrenos' | 'nutricion' | 'medidas' | 'mensajes' | 'engagement' | 'deslinde' | 'consulta';

const TABS: { key: Tab; label: string }[] = [
  { key: 'resumen',    label: 'Resumen'    },
  { key: 'consulta',   label: 'Consulta'   },
  { key: 'entrenos',   label: 'Entrenos'   },
  { key: 'nutricion',  label: 'Nutrición'  },
  { key: 'medidas',    label: 'Medidas'    },
  { key: 'mensajes',   label: 'Mensajes'   },
  { key: 'engagement', label: 'Engagement' },
  { key: 'deslinde',   label: 'Deslinde'   },
];

function initials(name: string | null): string {
  if (!name) return 'A';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

// ── Component ─────────────────────────────────────────────────────────────────

export function StudentDetailPage(): React.JSX.Element {
  const { id: studentId } = useParams<{ id: string }>();
  const { profile: trainerProfile } = useAuth();
  const { showToast } = useToast();
  const [tab, setTab] = useState<Tab>('resumen');

  const [profile, setProfile]         = useState<Profile | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfileRow | null>(null);
  const [measurements, setMeasurements] = useState<BodyMeasurementRow[]>([]);
  const [workouts, setWorkouts]       = useState<WorkoutLogRow[]>([]);
  const [meals, setMeals]             = useState<MealLogRow[]>([]);
  const [messages, setMessages]       = useState<MessageRow[]>([]);
  const [waiverSig, setWaiverSig]     = useState<WaiverSignature | null | false>(null); // null=loading, false=not signed
  const [consultation, setConsultation] = useState<ConsultationResponse | null | false>(null); // null=loading, false=not submitted
  const [draft, setDraft]             = useState('');
  const [sending, setSending]         = useState(false);
  const [loading, setLoading]         = useState(true);
  const [activating, setActivating]   = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!studentId) return;
    let active = true;
    void (async () => {
      const [{ data: p }, { data: up }, { data: bm }, { data: wl }, { data: ml }, { data: msgs }, { data: ws }, { data: cr }] = await Promise.all([
        supabase.from('profiles').select('id, full_name, goal, phone, avatar_url, created_at, client_status').eq('id', studentId).maybeSingle(),
        supabase.from('user_profiles').select('*').eq('user_id', studentId).maybeSingle(),
        supabase.from('body_measurements').select('*').eq('user_id', studentId).order('date', { ascending: false }).limit(10),
        supabase.from('workout_logs').select('*').eq('user_id', studentId).order('date', { ascending: false }).limit(20),
        supabase.from('meal_logs').select('*').eq('user_id', studentId).order('created_at', { ascending: false }).limit(20),
        supabase.from('messages').select('*').eq('client_id', studentId).order('created_at', { ascending: true }),
        anyClient.from('waiver_signatures').select('id, full_name, signed_at, signature_data, document_snapshot, document_title').eq('client_id', studentId).maybeSingle(),
        anyClient.from('consultation_responses').select('responses, submitted_at').eq('client_id', studentId).maybeSingle(),
      ]);
      if (!active) return;
      setProfile((p as Profile | null) ?? null);
      setUserProfile((up as UserProfileRow | null) ?? null);
      setMeasurements((bm as BodyMeasurementRow[] | null) ?? []);
      setWorkouts((wl as WorkoutLogRow[] | null) ?? []);
      setMeals((ml as MealLogRow[] | null) ?? []);
      setMessages((msgs as MessageRow[] | null) ?? []);
      setWaiverSig((ws as WaiverSignature | null) ?? false);
      setConsultation((cr as ConsultationResponse | null) ?? false);
      setLoading(false);
      await supabase.from('messages').update({ read: true })
        .eq('client_id', studentId).eq('sender_role', 'client').eq('read', false);
    })();
    return () => { active = false; };
  }, [studentId]);

  // Realtime messages
  useEffect(() => {
    if (!studentId) return;
    const channel = supabase
      .channel(`web-messages-${studentId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `client_id=eq.${studentId}` },
        (payload) => {
          const msg = payload.new as MessageRow;
          setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]);
          if (msg.sender_role === 'client')
            void supabase.from('messages').update({ read: true }).eq('id', msg.id);
        }
      ).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [studentId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const onSend = useCallback(async () => {
    const content = draft.trim();
    if (!content || !studentId || sending) return;
    setSending(true);
    const temp: MessageRow = { id: `temp-${Date.now()}`, client_id: studentId, content, sender_role: 'trainer', read: false, created_at: new Date().toISOString() };
    setMessages((prev) => [...prev, temp]);
    setDraft('');
    const { data, error } = await supabase.from('messages').insert({ client_id: studentId, content, sender_role: 'trainer' }).select().single();
    if (error || !data) {
      setMessages((prev) => prev.filter((m) => m.id !== temp.id));
      setDraft(content);
      showToast('error', 'No se pudo enviar el mensaje. Probá de nuevo.');
    } else {
      setMessages((prev) => prev.map((m) => m.id === temp.id ? data as MessageRow : m));
    }
    setSending(false);
  }, [draft, studentId, sending, showToast]);

  const activate = async () => {
    if (!studentId || activating) return;
    setActivating(true);
    const { error } = await supabase.from('profiles').update({ client_status: 'active' }).eq('id', studentId);
    if (error) {
      showToast('error', 'No pudimos activar al cliente.');
    } else {
      setProfile((prev) => prev ? { ...prev, client_status: 'active' } : prev);
      showToast('success', 'Cliente activado');
    }
    setActivating(false);
  };

  if (loading) return <div className="muted" style={{ padding: 32 }}>Cargando…</div>;
  if (!profile) {
    return (
      <div>
        <Link to="/students" className="back-link">← Volver a clientes</Link>
        <div className="empty-state"><div className="t">Cliente no encontrado</div></div>
      </div>
    );
  }

  const isPending = profile.client_status === 'pending';
  const latestM   = measurements[0] ?? null;
  const completedW = workouts.filter((w) => w.completed).length;

  return (
    <div className="sd-page">
      {/* ── Back ── */}
      <Link to="/students" className="back-link">← Volver a clientes</Link>

      {/* ── Header ── */}
      <div className="sd-header card">
        <div className="sd-header-left">
          <div className="sd-avatar" style={profile.avatar_url ? { padding: 0, overflow: 'hidden' } : undefined}>
            {profile.avatar_url
              ? <img src={profile.avatar_url} alt={profile.full_name ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
              : initials(profile.full_name)
            }
          </div>
          <div className="sd-header-info">
            <div className="sd-name">{profile.full_name ?? 'Alumno'}</div>
            <div className="sd-goal">{profile.goal ?? 'Sin objetivo definido'}</div>
            <div className="sd-meta">
              {userProfile?.plan_name && <span className="sd-chip">{userProfile.plan_name}</span>}
              <span className={`badge${isPending ? '' : ' active'}`}>
                <span className="dot" />{isPending ? 'Pendiente' : 'Activo'}
              </span>
              <span className="sd-since">Desde {new Date(profile.created_at).toLocaleDateString('es-AR')}</span>
            </div>
          </div>
        </div>
        <div className="sd-header-right">
          <div className="sd-header-stats">
            <StatPill label="Entrenos" value={workouts.length} />
            <StatPill label="Completados" value={completedW} />
            <StatPill label="Peso actual" value={latestM?.weight_kg != null ? `${latestM.weight_kg} kg` : '—'} />
            <StatPill label="% Grasa" value={latestM?.body_fat_pct != null ? `${latestM.body_fat_pct}%` : '—'} />
          </div>
          {isPending && (
            <div className="sd-header-actions">
              <button className="btn primary sm" onClick={() => void activate()} disabled={activating}>
                {activating ? '…' : 'Activar cliente'}
              </button>
            </div>
          )}
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
            {t.key === 'mensajes' && messages.filter((m) => !m.read && m.sender_role === 'client').length > 0 && (
              <span className="sd-tab-dot" />
            )}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      <div className="sd-content">

        {/* RESUMEN */}
        {tab === 'resumen' && (
          <div className="sd-grid-3">
            <div className="card">
              <div className="section-title" style={{ marginBottom: 14 }}>Datos personales</div>
              <dl className="data-list">
                <Datum label="Nivel"       value={userProfile?.level ?? '—'} />
                <Datum label="Plan"        value={userProfile?.plan_name ?? '—'} />
                <Datum label="Semana"      value={userProfile ? `${userProfile.plan_current_week ?? 0}${userProfile.plan_duration_weeks ? ` / ${userProfile.plan_duration_weeks}` : ''}` : '—'} />
                <Datum label="Teléfono"    value={profile.phone ?? '—'} />
                <Datum label="Se unió"     value={new Date(profile.created_at).toLocaleDateString('es-AR')} />
              </dl>
            </div>

            <div className="card">
              <div className="section-title" style={{ marginBottom: 14 }}>Última medición</div>
              {latestM ? (
                <>
                  <div className="measure-grid">
                    <Measure label="Peso"    value={latestM.weight_kg}    unit="kg" />
                    <Measure label="Grasa"   value={latestM.body_fat_pct} unit="%" />
                    <Measure label="Cintura" value={latestM.waist_cm}     unit="cm" />
                    <Measure label="Pecho"   value={latestM.chest_cm}     unit="cm" />
                  </div>
                  <div className="stat-foot" style={{ marginTop: 10 }}>{new Date(latestM.date).toLocaleDateString('es-AR')}</div>
                </>
              ) : <p className="muted" style={{ margin: 0 }}>Sin mediciones.</p>}
            </div>

            <div className="card">
              <div className="section-title" style={{ marginBottom: 14 }}>Entrenos recientes</div>
              {workouts.length === 0
                ? <p className="muted" style={{ margin: 0 }}>Sin entrenamientos.</p>
                : <ul className="log-list">
                    {workouts.slice(0, 5).map((w) => (
                      <li key={w.id} className="log-row">
                        <div>
                          <div className="cell-name">{w.workout_name}</div>
                          <div className="stat-foot">{new Date(w.date).toLocaleDateString('es-AR')}</div>
                        </div>
                        <span className={`badge${w.completed ? ' active' : ''}`}>
                          <span className="dot" />{w.completed ? 'Hecho' : 'Pendiente'}
                        </span>
                      </li>
                    ))}
                  </ul>
              }
            </div>
          </div>
        )}

        {/* ENTRENOS */}
        {tab === 'entrenos' && (
          <div>
            {studentId && <RoutineManager studentId={studentId} />}
            <div className="card" style={{ marginTop: 16 }}>
              <div className="section-title" style={{ marginBottom: 14 }}>Historial de entrenamientos</div>
              {workouts.length === 0
                ? <p className="muted" style={{ margin: 0 }}>Sin entrenamientos registrados.</p>
                : <table>
                    <thead>
                      <tr><th>Entreno</th><th>Fecha</th><th>Estado</th></tr>
                    </thead>
                    <tbody>
                      {workouts.map((w) => (
                        <tr key={w.id}>
                          <td>{w.workout_name}</td>
                          <td className="muted">{new Date(w.date).toLocaleDateString('es-AR')}</td>
                          <td>
                            <span className={`badge${w.completed ? ' active' : ''}`}>
                              <span className="dot" />{w.completed ? 'Completado' : 'Pendiente'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
              }
            </div>
          </div>
        )}

        {/* NUTRICIÓN */}
        {tab === 'nutricion' && (
          <div className="card">
            <div className="section-title" style={{ marginBottom: 14 }}>Registros de comidas</div>
            {meals.length === 0
              ? <p className="muted" style={{ margin: 0 }}>Sin comidas registradas.</p>
              : <table>
                  <thead>
                    <tr><th>Comida</th><th>Tipo</th><th>Calorías</th><th>Fecha</th></tr>
                  </thead>
                  <tbody>
                    {meals.map((m) => (
                      <tr key={m.id}>
                        <td>{m.title ?? '—'}</td>
                        <td className="muted" style={{ textTransform: 'capitalize' }}>{m.meal_type ?? '—'}</td>
                        <td className="muted">{m.energy_kcal != null ? `${m.energy_kcal} kcal` : '—'}</td>
                        <td className="muted">{new Date(m.created_at).toLocaleDateString('es-AR')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
            }
          </div>
        )}

        {/* MEDIDAS */}
        {tab === 'medidas' && (
          <div className="card">
            <div className="section-title" style={{ marginBottom: 14 }}>Historial de mediciones</div>
            {measurements.length === 0
              ? <p className="muted" style={{ margin: 0 }}>Sin mediciones registradas.</p>
              : <table>
                  <thead>
                    <tr><th>Fecha</th><th>Peso</th><th>% Grasa</th><th>Cintura</th><th>Pecho</th><th>Cadera</th></tr>
                  </thead>
                  <tbody>
                    {measurements.map((m) => (
                      <tr key={m.id}>
                        <td>{new Date(m.date).toLocaleDateString('es-AR')}</td>
                        <td>{m.weight_kg != null ? `${m.weight_kg} kg` : '—'}</td>
                        <td>{m.body_fat_pct != null ? `${m.body_fat_pct}%` : '—'}</td>
                        <td className="muted">{m.waist_cm != null ? `${m.waist_cm} cm` : '—'}</td>
                        <td className="muted">{m.chest_cm != null ? `${m.chest_cm} cm` : '—'}</td>
                        <td className="muted">{m.hips_cm != null ? `${m.hips_cm} cm` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
            }
          </div>
        )}

        {/* MENSAJES */}
        {tab === 'mensajes' && (
          <div className="card chat-card" style={{ height: 560 }}>
            <div className="chat-scroll" ref={scrollRef}>
              {messages.length === 0
                ? <p className="muted" style={{ textAlign: 'center', margin: 'auto' }}>Todavía no hay mensajes.</p>
                : messages.map((m) => {
                    const own = m.sender_role === 'trainer';
                    return (
                      <div key={m.id} className={`bubble-row${own ? ' own' : ''}`}>
                        <div className={`bubble${own ? ' own' : ''}`}>{m.content}</div>
                        <span className="bubble-time">
                          {new Date(m.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    );
                  })
              }
            </div>
            <div className="composer">
              <input
                className="field-input"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void onSend(); } }}
                placeholder="Escribile a tu alumno…"
              />
              <button className="btn" onClick={() => void onSend()} disabled={sending || !draft.trim()}>Enviar</button>
            </div>
          </div>
        )}

        {/* CONSULTA */}
        {tab === 'consulta' && (
          <ConsultationTab data={consultation} />
        )}

        {/* DESLINDE */}
        {tab === 'deslinde' && (
          <WaiverTab sig={waiverSig} trainerId={trainerProfile?.id} />
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
        /* Header */
        .sd-header { display: flex; align-items: center; justify-content: space-between; gap: 20px; margin-bottom: 0; flex-wrap: wrap; padding: 20px 24px; }
        .sd-header-left { display: flex; align-items: center; gap: 16px; }
        .sd-avatar {
          width: 56px; height: 56px; border-radius: 50%;
          background: color-mix(in srgb, var(--primary) 15%, transparent);
          color: var(--primary); font-size: 20px; font-weight: 700;
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .sd-name { font-size: 20px; font-weight: 700; color: var(--text-primary); }
        .sd-goal { font-size: 13px; color: var(--text-tertiary); margin-top: 2px; }
        .sd-meta { display: flex; align-items: center; gap: 8px; margin-top: 8px; flex-wrap: wrap; }
        .sd-chip { font-size: 11.5px; font-weight: 600; padding: 3px 9px; border-radius: 4px; background: var(--surface-elevated); color: var(--text-secondary); border: 1px solid var(--border); }
        .sd-since { font-size: 12px; color: var(--text-tertiary); }
        .sd-header-right { display: flex; flex-direction: column; align-items: flex-end; gap: 12px; }
        .sd-header-stats { display: flex; gap: 4px; flex-wrap: wrap; justify-content: flex-end; }
        .sd-header-actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }

        /* Stat pills in header */
        .sd-stat-pill { display: flex; flex-direction: column; align-items: center; padding: 8px 16px; border-radius: 8px; background: var(--surface-elevated); min-width: 70px; }
        .sd-stat-val { font-size: 17px; font-weight: 700; color: var(--text-primary); }
        .sd-stat-lbl { font-size: 10.5px; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: .06em; margin-top: 2px; }

        /* Tabs */
        .sd-tabs { display: flex; border-bottom: 2px solid var(--border); margin-bottom: 20px; overflow-x: auto; }
        .sd-tab {
          display: flex; align-items: center; gap: 6px;
          padding: 10px 18px; font-size: 13.5px; font-weight: 600;
          color: var(--text-tertiary); background: none; border: none; cursor: pointer;
          border-bottom: 2px solid transparent; margin-bottom: -2px; white-space: nowrap;
          transition: color 150ms;
        }
        .sd-tab:hover { color: var(--text-primary); }
        .sd-tab.active { color: var(--text-primary); border-bottom-color: var(--primary); }
        .sd-tab-dot { width: 7px; height: 7px; border-radius: 50%; background: #ef4444; flex-shrink: 0; }

        .sd-content { min-height: 300px; }
        .sd-grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
        @media (max-width: 900px) { .sd-grid-3 { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function StatPill({ label, value }: { label: string; value: string | number }): React.JSX.Element {
  return (
    <div className="sd-stat-pill">
      <div className="sd-stat-val">{value}</div>
      <div className="sd-stat-lbl">{label}</div>
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

function Measure({ label, value, unit }: { label: string; value: number | null; unit: string }): React.JSX.Element {
  return (
    <div className="measure">
      <div className="measure-val">{value != null ? `${value}` : '—'}{value != null && <span className="measure-unit"> {unit}</span>}</div>
      <div className="measure-label">{label}</div>
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
    <div class="meta-row"><span class="meta-key">Método:</span><span class="meta-val">Firma digital con dedo / mouse en app Habito</span></div>
  </div>
</div>

<div class="legal-notice">
  <strong>Nota legal:</strong> Este documento constituye evidencia de que el firmante aceptó los términos del deslinde de responsabilidad descritos arriba. La firma fue capturada digitalmente mediante la aplicación Habito, con registro de identidad (nombre completo), fecha y hora UTC. El texto guardado corresponde exactamente al documento presentado al firmante al momento de la aceptación (snapshot inmutable). Este registro puede ser utilizado como evidencia ante reclamaciones.
</div>

<div class="footer">
  <span>Generado por Habito · ${new Date().toLocaleDateString('es-AR')}</span>
  <span>ID: ${recordId}</span>
</div>

</body>
</html>`;

  const w = window.open('', '_blank', 'width=900,height=1100');
  if (w) { w.document.write(html); w.document.close(); }
}

function WaiverTab({ sig }: { sig: WaiverSignature | null | false; trainerId?: string }): React.JSX.Element {
  const isSigned = sig !== null && sig !== false;
  const ws = isSigned ? (sig as WaiverSignature) : null;

  return (
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
