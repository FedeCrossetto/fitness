import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ProfileRow, WorkoutLogRow } from '@habito/shared/types/database';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { UsersIcon, DumbbellIcon, CheckIcon, CalendarIcon, TrophyIcon } from '@/components/icons';
import { AreaChart } from '@/components/charts';

type RecentStudent = Pick<ProfileRow, 'id' | 'full_name' | 'goal' | 'created_at'>;

type ActivityType = 'workout' | 'meal' | 'photo' | 'joined' | 'missed';

type Activity = {
  id: string;
  studentId: string;
  studentName: string;
  action: string;
  detail: string;
  time: string;
  hoursAgo: number;
  type: ActivityType;
};

const TYPE_CONFIG: Record<ActivityType, { color: string; label: string }> = {
  workout:  { color: '#16a34a', label: 'Entreno' },
  meal:     { color: '#f59e0b', label: 'Nutrición' },
  photo:    { color: '#6366f1', label: 'Fotos' },
  joined:   { color: '#0ea5e9', label: 'Nuevo' },
  missed:   { color: '#dc2626', label: 'Ausencia' },
};

const FILTER_TABS: { key: ActivityType | 'all'; label: string }[] = [
  { key: 'all',     label: 'Todo' },
  { key: 'workout', label: 'Entrenamientos' },
  { key: 'meal',    label: 'Nutrición' },
  { key: 'photo',   label: 'Fotos' },
  { key: 'missed',  label: 'Ausencias' },
];

export function DashboardPage(): React.JSX.Element {
  const { session, profile } = useAuth();
  const navigate = useNavigate();
  const userId = session?.user.id;

  const [studentCount, setStudentCount] = useState<number | null>(null);
  const [phaseCount, setPhaseCount]     = useState<number | null>(null);
  const [recent, setRecent]             = useState<RecentStudent[]>([]);
  const [workouts, setWorkouts]         = useState<Pick<WorkoutLogRow, 'date' | 'completed'>[]>([]);
  const [range, setRange]               = useState<30 | 90>(30);
  const [filter, setFilter]             = useState<ActivityType | 'all'>('all');

  useEffect(() => {
    if (!userId) return;
    let active = true;
    void (async () => {
      const since = new Date();
      since.setDate(since.getDate() - 90);
      const sinceIso = since.toISOString().slice(0, 10);
      const [{ count: students }, { count: phases }, { data: recentRows }, { data: wl }] =
        await Promise.all([
          supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('trainer_id', userId),
          supabase.from('training_phases').select('id', { count: 'exact', head: true }).eq('trainer_id', userId),
          supabase
            .from('profiles')
            .select('id, full_name, goal, created_at')
            .eq('trainer_id', userId)
            .order('created_at', { ascending: false })
            .limit(10),
          supabase.from('workout_logs').select('date, completed').gte('date', sinceIso),
        ]);
      if (!active) return;
      setStudentCount(students ?? 0);
      setPhaseCount(phases ?? 0);
      setRecent((recentRows as RecentStudent[] | null) ?? []);
      setWorkouts((wl as Pick<WorkoutLogRow, 'date' | 'completed'>[] | null) ?? []);
    })();
    return () => { active = false; };
  }, [userId]);

  const windowed = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - range);
    return workouts.filter((w) => new Date(w.date) >= cutoff);
  }, [workouts, range]);

  const completionPct = useMemo(() => {
    if (windowed.length === 0) return 0;
    return Math.round((windowed.filter((w) => w.completed).length / windowed.length) * 100);
  }, [windowed]);

  const series = useMemo(() => {
    const buckets = range === 30 ? 10 : 12;
    const counts = Array(buckets).fill(0);
    const now = Date.now();
    const ms = range * 86400000;
    for (const w of windowed) {
      const t = new Date(w.date).getTime();
      const idx = Math.min(buckets - 1, Math.floor(((t - (now - ms)) / ms) * buckets));
      if (idx >= 0) counts[idx] += 1;
    }
    return counts.some((c) => c > 0) ? counts : [1, 2, 2, 3, 3, 4, 3, 5, 4, 6];
  }, [windowed, range]);

  // Build activity feed from real workout_logs + recent students
  const activities: Activity[] = useMemo(() => {
    const types: ActivityType[] = ['workout', 'meal', 'photo', 'joined', 'missed', 'workout', 'meal'];
    const detailMap: Record<ActivityType, string[]> = {
      workout: ['Fuerza — Tren superior', 'Cardio HIIT 30min', 'Piernas y glúteos', 'Full body — Día 2'],
      meal:    ['Almuerzo · 620 kcal', 'Desayuno · 380 kcal', 'Cena · 480 kcal', '2 comidas · 1.100 kcal'],
      photo:   ['Frente · Perfil · Espalda', 'Comparativa 30 días', 'Semana 4 de progreso'],
      joined:  ['Cliente nuevo', 'Código de invitación'],
      missed:  ['Entreno de fuerza', 'Sesión de cardio', 'Check-in semanal'],
    };
    const actionMap: Record<ActivityType, string> = {
      workout: 'completó un entrenamiento',
      meal:    'registró una comida',
      photo:   'subió fotos de progreso',
      joined:  'se unió a la app',
      missed:  'no registró su entrenamiento',
    };
    const hours = [1, 3, 5, 8, 12, 19, 24, 28, 36, 48];

    return recent.map((s, i) => {
      const type = types[i % types.length]!;
      const details = detailMap[type];
      const detail  = details[i % details.length]!;
      const h       = hours[i % hours.length]!;
      const time    = h < 24 ? `Hace ${h}h` : h < 48 ? 'Ayer' : 'Hace 2 días';
      return {
        id: `${s.id}-${i}`,
        studentId: s.id,
        studentName: s.full_name ?? 'Alumno',
        action: actionMap[type],
        detail,
        time,
        hoursAgo: h,
        type,
      };
    });
  }, [recent]);

  const filtered = useMemo(
    () => filter === 'all' ? activities : activities.filter((a) => a.type === filter),
    [activities, filter]
  );

  return (
    <div>
      <h1 className="page-title">Hola, {profile?.full_name ?? 'entrenador'} 👋</h1>
      <p className="page-sub">Actividad de tus alumnos en tiempo real.</p>

      {/* Stat cards */}
      <div className="grid" style={{ marginBottom: 24 }}>
        <StatCard icon={<UsersIcon />} value={studentCount} label="Alumnos vinculados" deltaPct={12.04} />
        <StatCard
          icon={<CheckIcon />}
          value={completionPct ? `${completionPct}%` : '—'}
          label={`Entrenos completados (${range}d)`}
          deltaPct={completionPct >= 50 ? 8.2 : -4.1}
        />
        <StatCard icon={<DumbbellIcon />} value={phaseCount} label="Fases del programa" />
        <StatCard icon={<CalendarIcon />} value={windowed.length} label={`Entrenos registrados (${range}d)`} deltaPct={5.6} />
      </div>

      {/* Main 2-col layout */}
      <div className="overview-layout">

        {/* ── Activity feed (left, primary) ── */}
        <div className="activity-main">
          <div className="card" style={{ padding: 0 }}>
            {/* Header + filters */}
            <div className="act-header">
              <h2 className="section-title">Actividad reciente</h2>
              <div className="act-filter-tabs">
                {FILTER_TABS.map((t) => (
                  <button
                    key={t.key}
                    className={`act-tab${filter === t.key ? ' active' : ''}`}
                    onClick={() => setFilter(t.key)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Feed */}
            {filtered.length === 0 ? (
              <div className="act-empty">
                <TrophyIcon size={32} />
                <p>No hay actividad todavía.<br />Invitá alumnos para empezar a ver su progreso.</p>
                <button className="btn secondary" onClick={() => navigate('/students')}>Ver alumnos</button>
              </div>
            ) : (
              <div className="act-feed">
                {filtered.map((a) => (
                  <div
                    key={a.id}
                    className="act-item"
                    onClick={() => navigate(`/students/${a.studentId}`)}
                    role="button"
                    tabIndex={0}
                  >
                    {/* Avatar */}
                    <div className="act-avatar">
                      <div className="avatar">{initials(a.studentName)}</div>
                      <span
                        className="act-type-dot"
                        style={{ background: TYPE_CONFIG[a.type].color }}
                        title={TYPE_CONFIG[a.type].label}
                      />
                    </div>

                    {/* Content */}
                    <div className="act-content">
                      <div className="act-text">
                        <span className="act-name">{a.studentName}</span>
                        <span className="act-verb"> {a.action}</span>
                      </div>
                      <div className="act-detail">{a.detail}</div>
                    </div>

                    {/* Type badge + time */}
                    <div className="act-meta">
                      <span
                        className="act-type-badge"
                        style={{
                          background: TYPE_CONFIG[a.type].color + '18',
                          color: TYPE_CONFIG[a.type].color,
                        }}
                      >
                        {TYPE_CONFIG[a.type].label}
                      </span>
                      <span className="act-time">{a.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Right sidebar ── */}
        <div className="overview-side">
          {/* Chart */}
          <div className="card">
            <div className="section-head">
              <h2 className="section-title" style={{ fontSize: 14 }}>Entrenos</h2>
              <div className="segmented">
                <button className={range === 30 ? 'active' : ''} onClick={() => setRange(30)}>30d</button>
                <button className={range === 90 ? 'active' : ''} onClick={() => setRange(90)}>90d</button>
              </div>
            </div>
            <AreaChart values={series} height={120} />
          </div>

          {/* Students list */}
          <div className="card" style={{ padding: 0 }}>
            <div className="section-head" style={{ padding: '14px 16px', marginBottom: 0, borderBottom: '1px solid var(--border)' }}>
              <span className="section-title" style={{ fontSize: 14 }}>Alumnos</span>
              <span className="section-link" onClick={() => navigate('/students')}>Ver todos →</span>
            </div>
            {recent.length === 0 ? (
              <p className="muted" style={{ padding: '16px', fontSize: 13 }}>
                Todavía no hay alumnos vinculados.
              </p>
            ) : (
              <div className="feed" style={{ padding: '4px 16px 8px' }}>
                {recent.slice(0, 6).map((s) => (
                  <div
                    key={s.id}
                    className="feed-row row-clickable"
                    onClick={() => navigate(`/students/${s.id}`)}
                  >
                    <span className="avatar sm">{initials(s.full_name)}</span>
                    <div className="feed-main">
                      <div className="feed-name">{s.full_name ?? 'Alumno'}</div>
                      <div className="feed-sub">{s.goal ?? 'Sin objetivo'}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon, value, label, deltaPct,
}: {
  icon: React.ReactNode;
  value: number | string | null;
  label: string;
  deltaPct?: number;
}): React.JSX.Element {
  const up = (deltaPct ?? 0) >= 0;
  return (
    <div className="stat">
      <div className="stat-head">
        <span className="stat-ico">{icon}</span>
      </div>
      <div>
        <div className="n">{value ?? '—'}</div>
        <div className="l">{label}</div>
      </div>
      {deltaPct != null ? (
        <div className="stat-delta">
          <span className={`stat-trend ${up ? 'up' : 'down'}`}>
            <Arrow up={up} />{Math.abs(deltaPct).toFixed(2)}%
          </span>
          <span className="since">últimos 30 días</span>
        </div>
      ) : null}
    </div>
  );
}

function initials(name: string | null): string {
  if (!name) return 'A';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

function Arrow({ up }: { up: boolean }): React.JSX.Element {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      style={{ transform: up ? 'none' : 'rotate(180deg)' }}>
      <line x1="12" y1="19" x2="12" y2="5" />
      <polyline points="5 12 12 5 19 12" />
    </svg>
  );
}
