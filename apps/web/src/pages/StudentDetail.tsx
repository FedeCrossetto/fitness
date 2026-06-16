import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type {
  BodyMeasurementRow,
  MessageRow,
  ProfileRow,
  UserProfileRow,
  WorkoutLogRow,
} from '@habito/shared/types/database';
import { supabase } from '@/lib/supabase';
import { RoutineManager } from '@/components/RoutineManager';

type Profile = Pick<ProfileRow, 'id' | 'full_name' | 'goal' | 'phone' | 'created_at'>;

function initials(name: string | null): string {
  if (!name) return 'A';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

function asWrite<T>(payload: Partial<T>): never {
  return payload as never;
}

export function StudentDetailPage(): React.JSX.Element {
  const { id: studentId } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfileRow | null>(null);
  const [measurement, setMeasurement] = useState<BodyMeasurementRow | null>(null);
  const [workouts, setWorkouts] = useState<WorkoutLogRow[]>([]);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!studentId) return;
    let active = true;
    void (async () => {
      const [{ data: p }, { data: up }, { data: bm }, { data: wl }, { data: msgs }] = await Promise.all([
        supabase.from('profiles').select('id, full_name, goal, phone, created_at').eq('id', studentId).maybeSingle(),
        supabase.from('user_profiles').select('*').eq('user_id', studentId).maybeSingle(),
        supabase.from('body_measurements').select('*').eq('user_id', studentId).order('date', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('workout_logs').select('*').eq('user_id', studentId).order('date', { ascending: false }).limit(5),
        supabase.from('messages').select('*').eq('client_id', studentId).order('created_at', { ascending: true }),
      ]);
      if (!active) return;
      setProfile((p as Profile | null) ?? null);
      setUserProfile((up as UserProfileRow | null) ?? null);
      setMeasurement((bm as BodyMeasurementRow | null) ?? null);
      setWorkouts((wl as WorkoutLogRow[] | null) ?? []);
      setMessages((msgs as MessageRow[] | null) ?? []);
      setLoading(false);
      await supabase
        .from('messages')
        .update(asWrite<MessageRow>({ read: true }))
        .eq('client_id', studentId)
        .eq('sender_role', 'client')
        .eq('read', false);
    })();
    return () => {
      active = false;
    };
  }, [studentId]);

  useEffect(() => {
    if (!studentId) return;
    const channel = supabase
      .channel(`web-messages-${studentId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `client_id=eq.${studentId}` },
        (payload) => {
          const incoming = payload.new as MessageRow;
          setMessages((prev) => (prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming]));
          if (incoming.sender_role === 'client') {
            void supabase.from('messages').update(asWrite<MessageRow>({ read: true })).eq('id', incoming.id);
          }
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [studentId]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const onSend = useCallback(async () => {
    const content = draft.trim();
    if (!content || !studentId || sending) return;
    setSending(true);
    const temp: MessageRow = {
      id: `temp-${Date.now()}`,
      client_id: studentId,
      content,
      sender_role: 'trainer',
      read: false,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, temp]);
    setDraft('');
    const { data, error } = await supabase
      .from('messages')
      .insert(asWrite<MessageRow>({ client_id: studentId, content, sender_role: 'trainer' }))
      .select()
      .single();
    if (error || !data) {
      setMessages((prev) => prev.filter((m) => m.id !== temp.id));
      setDraft(content);
    } else {
      const saved = data as MessageRow;
      setMessages((prev) => prev.map((m) => (m.id === temp.id ? saved : m)));
    }
    setSending(false);
  }, [draft, studentId, sending]);

  if (loading) return <div className="muted">Cargando…</div>;
  if (!profile) {
    return (
      <div>
        <Link to="/students" className="back-link">← Volver a alumnos</Link>
        <div className="empty-state">
          <div className="t">Alumno no encontrado</div>
          <p className="muted" style={{ margin: 0 }}>Puede que no esté vinculado a tu marca.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Link to="/students" className="back-link">← Volver a alumnos</Link>

      <div className="detail-header">
        <span className="avatar lg">{initials(profile.full_name)}</span>
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>{profile.full_name ?? 'Alumno'}</h1>
          <p className="page-sub" style={{ margin: '4px 0 0' }}>
            {profile.goal ?? 'Sin objetivo definido'}
          </p>
        </div>
      </div>

      <div className="detail-grid">
        <div className="detail-col">
          {studentId ? <RoutineManager studentId={studentId} /> : null}

          <div className="card">
            <h2 className="section-title" style={{ marginBottom: 14 }}>Datos</h2>
            <dl className="data-list">
              <Datum label="Nivel" value={userProfile?.level ?? '—'} />
              <Datum label="Plan" value={userProfile?.plan_name ?? '—'} />
              <Datum
                label="Semana del plan"
                value={userProfile ? `${userProfile.plan_current_week}${userProfile.plan_duration_weeks ? ` / ${userProfile.plan_duration_weeks}` : ''}` : '—'}
              />
              <Datum label="Teléfono" value={profile.phone ?? '—'} />
              <Datum label="Se unió" value={new Date(profile.created_at).toLocaleDateString('es-AR')} />
            </dl>
          </div>

          <div className="card">
            <h2 className="section-title" style={{ marginBottom: 14 }}>Última medición</h2>
            {measurement ? (
              <>
                <div className="measure-grid">
                  <Measure label="Peso" value={measurement.weight_kg} unit="kg" />
                  <Measure label="Grasa" value={measurement.body_fat_pct} unit="%" />
                  <Measure label="Cintura" value={measurement.waist_cm} unit="cm" />
                  <Measure label="Pecho" value={measurement.chest_cm} unit="cm" />
                </div>
                <div className="stat-foot" style={{ marginTop: 12 }}>
                  {new Date(measurement.date).toLocaleDateString('es-AR')}
                </div>
              </>
            ) : (
              <p className="muted" style={{ margin: 0 }}>Sin mediciones registradas.</p>
            )}
          </div>

          <div className="card">
            <h2 className="section-title" style={{ marginBottom: 14 }}>Entrenamientos recientes</h2>
            {workouts.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>Sin entrenamientos registrados.</p>
            ) : (
              <ul className="log-list">
                {workouts.map((w) => (
                  <li key={w.id} className="log-row">
                    <div>
                      <div className="cell-name">{w.workout_name}</div>
                      <div className="stat-foot">{new Date(w.date).toLocaleDateString('es-AR')}</div>
                    </div>
                    <span className={`badge${w.completed ? ' active' : ''}`}>
                      <span className="dot" />{w.completed ? 'Completado' : 'Pendiente'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="card chat-card">
          <h2 className="section-title" style={{ marginBottom: 0 }}>Chat</h2>
          <div className="chat-scroll" ref={scrollRef}>
            {messages.length === 0 ? (
              <p className="muted" style={{ textAlign: 'center', margin: 'auto' }}>
                Todavía no hay mensajes. Escribí el primero.
              </p>
            ) : (
              messages.map((m) => {
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
            )}
          </div>
          <div className="composer">
            <input
              className="field-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void onSend();
                }
              }}
              placeholder="Escribile a tu alumno…"
            />
            <button className="btn" onClick={() => void onSend()} disabled={sending || !draft.trim()}>
              Enviar
            </button>
          </div>
        </div>
      </div>
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
      <div className="measure-val">{value != null ? `${value}` : '—'}{value != null ? <span className="measure-unit"> {unit}</span> : null}</div>
      <div className="measure-label">{label}</div>
    </div>
  );
}
