import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ProfileRow, WorkoutLogRow, MealLogRow, ProgressPhotoRow, BodyMeasurementRow } from '@habito/shared/types/database';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from '@/hooks/useTranslation';
import { TrophyIcon } from '@/components/icons';
import { AreaChart } from '@/components/charts';
import { ErrorState, Lightbox } from '@/components/ui';

// ── Types ──────────────────────────────────────────────────────────────────

type StudentMin = Pick<ProfileRow, 'id' | 'full_name' | 'avatar_url' | 'goal' | 'created_at'>;

type ActivityType = 'workout' | 'meal' | 'photo' | 'measurement' | 'joined';

interface Activity {
  id: string;
  studentId: string;
  studentName: string;
  studentAvatar?: string | null;
  type: ActivityType;
  verb: string;
  detail: string;
  thumb?: string | null;
  createdAt: string;
}

// ── Constants ──────────────────────────────────────────────────────────────

const TYPE_META: Record<ActivityType, { color: string; label: string; dot: string }> = {
  workout:     { color: '#16a34a', label: 'Entreno',    dot: '#16a34a' },
  meal:        { color: '#f59e0b', label: 'Nutrición',  dot: '#f59e0b' },
  photo:       { color: '#6366f1', label: 'Fotos',      dot: '#6366f1' },
  measurement: { color: '#0ea5e9', label: 'Medición',   dot: '#0ea5e9' },
  joined:      { color: '#ec4899', label: 'Nuevo',      dot: '#ec4899' },
};

const MEAL_LABEL: Record<string, string> = {
  DES: 'desayuno', ALM: 'almuerzo', MER: 'merienda', CEN: 'cena',
};

const FILTER_TABS: { key: ActivityType | 'all'; label: string }[] = [
  { key: 'all',         label: 'Todo' },
  { key: 'workout',     label: 'Entrenos' },
  { key: 'meal',        label: 'Nutrición' },
  { key: 'photo',       label: 'Fotos' },
  { key: 'measurement', label: 'Medidas' },
];

// ── Helpers ────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'Ahora mismo';
  if (m < 60) return `Hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Hace ${h}h`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'Ayer';
  return `Hace ${d} días`;
}

function initials(name: string | null): string {
  if (!name) return 'A';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

// ── Activity builder ───────────────────────────────────────────────────────

function buildActivities(
  students: StudentMin[],
  wLogs: Pick<WorkoutLogRow, 'id' | 'user_id' | 'workout_name' | 'workout_type' | 'completed' | 'created_at'>[],
  mLogs: Pick<MealLogRow, 'id' | 'user_id' | 'meal_type' | 'title' | 'photo_url' | 'energy_kcal' | 'created_at'>[],
  pPhotos: Pick<ProgressPhotoRow, 'id' | 'user_id' | 'photo_url' | 'position' | 'created_at'>[],
  bMeasurements: Pick<BodyMeasurementRow, 'id' | 'user_id' | 'weight_kg' | 'body_fat_pct' | 'created_at'>[],
): Activity[] {
  const byId = new Map(students.map((s) => [s.id, s]));

  const items: Activity[] = [];

  for (const w of wLogs) {
    const s = byId.get(w.user_id);
    if (!s) continue;
    items.push({
      id: `w-${w.id}`,
      studentId: w.user_id,
      studentName: s.full_name ?? 'Alumno',
      studentAvatar: s.avatar_url,
      type: 'workout',
      verb: w.completed ? 'completó un entrenamiento' : 'no completó su entrenamiento',
      detail: w.workout_name ?? (w.workout_type ?? 'Entrenamiento'),
      createdAt: w.created_at,
    });
  }

  for (const m of mLogs) {
    const s = byId.get(m.user_id);
    if (!s) continue;
    const label = MEAL_LABEL[m.meal_type] ?? m.meal_type.toLowerCase();
    const kcal  = m.energy_kcal != null ? ` · ${Math.round(m.energy_kcal)} kcal` : '';
    items.push({
      id: `m-${m.id}`,
      studentId: m.user_id,
      studentName: s.full_name ?? 'Alumno',
      studentAvatar: s.avatar_url,
      type: 'meal',
      verb: `registró ${label}`,
      detail: (m.title ?? m.meal_type) + kcal,
      thumb: m.photo_url,
      createdAt: m.created_at,
    });
  }

  for (const p of pPhotos) {
    const s = byId.get(p.user_id);
    if (!s) continue;
    items.push({
      id: `p-${p.id}`,
      studentId: p.user_id,
      studentName: s.full_name ?? 'Alumno',
      studentAvatar: s.avatar_url,
      type: 'photo',
      verb: 'subió fotos de progreso',
      detail: p.position,
      thumb: p.photo_url,
      createdAt: p.created_at,
    });
  }

  for (const b of bMeasurements) {
    const s = byId.get(b.user_id);
    if (!s) continue;
    const parts: string[] = [];
    if (b.weight_kg   != null) parts.push(`${b.weight_kg} kg`);
    if (b.body_fat_pct != null) parts.push(`${b.body_fat_pct}% grasa`);
    items.push({
      id: `b-${b.id}`,
      studentId: b.user_id,
      studentName: s.full_name ?? 'Alumno',
      studentAvatar: s.avatar_url,
      type: 'measurement',
      verb: 'registró una medición',
      detail: parts.join(' · ') || 'Medida corporal',
      createdAt: b.created_at,
    });
  }

  // New students (created_at in last 7 days)
  const cutoff = Date.now() - 7 * 86400000;
  for (const s of students) {
    if (new Date(s.created_at).getTime() >= cutoff) {
      items.push({
        id: `j-${s.id}`,
        studentId: s.id,
        studentName: s.full_name ?? 'Alumno',
        studentAvatar: s.avatar_url,
        type: 'joined',
        verb: 'se unió a la app',
        detail: 'Nuevo alumno',
        createdAt: s.created_at,
      });
    }
  }

  return items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

// ── Page ───────────────────────────────────────────────────────────────────

export function DashboardPage(): React.JSX.Element {
  const { session, profile } = useAuth();
  const { t, i18n, language } = useTranslation();
  const navigate = useNavigate();
  const userId = session?.user.id;

  // Left panel state
  const [students, setStudents]         = useState<StudentMin[]>([]);
  const [studentCount, setStudentCount] = useState<number | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [phaseCount, setPhaseCount]     = useState<number | null>(null);
  const [workouts, setWorkouts]         = useState<Pick<WorkoutLogRow, 'date' | 'completed'>[]>([]);
  const [range, setRange]               = useState<30 | 90>(30);

  // Activity feed state
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [filter, setFilter]           = useState<ActivityType | 'all'>('all');
  const [loadError, setLoadError]     = useState<string | null>(null);
  const [reloadTick, setReloadTick]   = useState(0);
  // Buckets privados: resolvemos URLs firmadas para los thumbnails del feed.
  const [thumbs, setThumbs]           = useState<Record<string, string>>({});
  const [lightbox, setLightbox]       = useState<{ src: string; caption: string } | null>(null);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    setLoadError(null);

    void (async () => {
     try {
      // ── Stats queries ────────────────────────────────────────────────────
      const since90 = new Date();
      since90.setDate(since90.getDate() - 90);

      const [{ count: sc }, { count: pc }, { count: pending }, { data: studentsData }, { data: wl }] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('trainer_id', userId).eq('client_status', 'active'),
        supabase.from('training_phases').select('id', { count: 'exact', head: true }).eq('trainer_id', userId),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('trainer_id', userId).eq('client_status', 'pending'),
        supabase
          .from('profiles')
          .select('id, full_name, avatar_url, goal, created_at')
          .eq('trainer_id', userId)
          .eq('client_status', 'active')
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('workout_logs')
          .select('date, completed')
          .gte('date', since90.toISOString().slice(0, 10)),
      ]);

      if (!active) return;
      setStudentCount(sc ?? 0);
      setPendingCount(pending ?? 0);
      setPhaseCount(pc ?? 0);
      setStudents((studentsData as StudentMin[] | null) ?? []);
      setWorkouts((wl as Pick<WorkoutLogRow, 'date' | 'completed'>[] | null) ?? []);

      // ── Activity feed queries ─────────────────────────────────────────────
      const allStudents = (studentsData as StudentMin[] | null) ?? [];
      const ids = allStudents.map((s) => s.id);

      if (ids.length === 0) {
        setLoadingFeed(false);
        return;
      }

      const since7 = new Date();
      since7.setDate(since7.getDate() - 7);
      const since7Iso = since7.toISOString();

      const [
        { data: wLogs },
        { data: mLogs },
        { data: pPhotos },
        { data: bMeas },
      ] = await Promise.all([
        supabase
          .from('workout_logs')
          .select('id, user_id, workout_name, workout_type, completed, created_at')
          .in('user_id', ids)
          .gte('created_at', since7Iso)
          .order('created_at', { ascending: false })
          .limit(40),
        supabase
          .from('meal_logs')
          .select('id, user_id, meal_type, title, photo_url, energy_kcal, created_at')
          .in('user_id', ids)
          .gte('created_at', since7Iso)
          .order('created_at', { ascending: false })
          .limit(40),
        supabase
          .from('progress_photos')
          .select('id, user_id, photo_url, position, created_at')
          .in('user_id', ids)
          .gte('created_at', since7Iso)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('body_measurements')
          .select('id, user_id, weight_kg, body_fat_pct, created_at')
          .in('user_id', ids)
          .gte('created_at', since7Iso)
          .order('created_at', { ascending: false })
          .limit(20),
      ]);

      if (!active) return;

      setActivities(buildActivities(
        allStudents,
        (wLogs ?? []) as Parameters<typeof buildActivities>[1],
        (mLogs ?? []) as Parameters<typeof buildActivities>[2],
        (pPhotos ?? []) as Parameters<typeof buildActivities>[3],
        (bMeas ?? []) as Parameters<typeof buildActivities>[4],
      ));
      setLoadingFeed(false);
     } catch (err) {
      if (active) {
        setLoadError(err instanceof Error ? err.message : 'No pudimos cargar el panel.');
        setLoadingFeed(false);
      }
     }
    })();

    return () => { active = false; };
  }, [userId, reloadTick]);

  // Firma los paths de los thumbnails (fotos de progreso y comidas) de buckets privados.
  useEffect(() => {
    const pending = activities.filter(
      (a) => a.thumb && !a.thumb.startsWith('http') && thumbs[a.thumb] === undefined,
    );
    if (pending.length === 0) return;
    let active = true;
    void (async () => {
      const entries = await Promise.all(
        pending.map(async (a) => {
          const bucket = a.type === 'photo' ? 'progress-photos' : 'meal-photos';
          const { data } = await supabase.storage.from(bucket).createSignedUrl(a.thumb!, 3600);
          return [a.thumb!, data?.signedUrl ?? null] as const;
        }),
      );
      if (!active) return;
      setThumbs((prev) => {
        const next = { ...prev };
        for (const [path, url] of entries) if (url) next[path] = url;
        return next;
      });
    })();
    return () => { active = false; };
  }, [activities, thumbs]);

  // Chart helpers
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
    const counts  = Array(buckets).fill(0) as number[];
    const now = Date.now();
    const ms  = range * 86400000;
    for (const w of windowed) {
      const t   = new Date(w.date).getTime();
      const idx = Math.min(buckets - 1, Math.floor(((t - (now - ms)) / ms) * buckets));
      if (idx >= 0) counts[idx] += 1;
    }
    return counts.some((c) => c > 0) ? counts : [1, 2, 2, 3, 3, 4, 3, 5, 4, 6];
  }, [windowed, range]);

  const filtered = useMemo(
    () => (filter === 'all' ? activities : activities.filter((a) => a.type === filter)),
    [activities, filter]
  );

  return (
    <div className="dash-with-panel">

      {/* ── Left: stats + chart + students ─────────────────────────────── */}
      <div className="dash-left">
        <div className="dash-greeting">
          <span className="dash-date">
            {new Date().toLocaleDateString(language === 'es' ? 'es-AR' : 'en-US', {
              weekday: 'long', day: 'numeric', month: 'long',
            })}
          </span>
          <h1 className="dash-title">
            {profile?.full_name?.split(' ')[0] ?? 'Panel'}
          </h1>
        </div>

        {pendingCount > 0 ? (
          <button
            type="button"
            className="dash-pending-banner"
            onClick={() => navigate('/students?tab=pending')}
          >
            <span>{i18n(t.dashboard.pending_banner, { count: pendingCount })}</span>
            <span className="dash-pending-banner-link">{t.dashboard.pending_review} →</span>
          </button>
        ) : null}

        {/* Stats strip */}
        <div className="stats-strip">
          <StatBlock
            value={studentCount ?? '—'}
            label={t.dashboard.students}
            delta={12}
            since={t.dashboard.vs_month}
          />
          <StatBlock
            value={completionPct ? `${completionPct}%` : '—'}
            label={i18n(t.dashboard.workouts_pct, { range })}
            delta={completionPct >= 50 ? 8 : -4}
            since={t.dashboard.vs_month}
          />
          <StatBlock
            value={phaseCount ?? '—'}
            label={t.dashboard.phases}
          />
          <StatBlock
            value={windowed.length}
            label={i18n(t.dashboard.workouts_n, { range })}
            delta={5}
            since={t.dashboard.vs_month}
          />
        </div>

        {/* Chart + students row */}
        <div className="dash-chart-row">
          {/* Chart */}
          <div className="card dash-chart-card">
            <div className="dash-chart-header">
              <div>
                <div className="dash-chart-title">{t.dashboard.chart_title}</div>
                <div className="dash-chart-sub">{t.dashboard.chart_sub}</div>
              </div>
              <div className="segmented">
                <button className={range === 30 ? 'active' : ''} onClick={() => setRange(30)}>30d</button>
                <button className={range === 90 ? 'active' : ''} onClick={() => setRange(90)}>90d</button>
              </div>
            </div>
            <div className="dash-chart-body">
              <AreaChart values={series} height={148} color="#6366f1" />
            </div>
          </div>

          {/* Students list */}
          <div className="card dash-students-card">
            <div className="dash-students-header">
              <span className="dash-students-title">{t.dashboard.recent_students}</span>
              <span className="section-link" onClick={() => navigate('/students')}>{t.dashboard.see_all}</span>
            </div>
            {students.length === 0 ? (
              <p className="muted dash-students-empty">
                {t.dashboard.no_students}
              </p>
            ) : (
              <div className="students-list">
                {students.slice(0, 6).map((s) => (
                  <div key={s.id} className="student-row" onClick={() => navigate(`/students/${s.id}`)}>
                    <div className="avatar sm" style={s.avatar_url ? { padding: 0, overflow: 'hidden' } : undefined}>
                      {s.avatar_url
                        ? <img src={s.avatar_url} alt={s.full_name ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} />
                        : initials(s.full_name)
                      }
                    </div>
                    <div className="student-info">
                      <span className="student-name">{s.full_name ?? 'Alumno'}</span>
                      <span className="student-goal">{s.goal ?? t.profile.no_goal}</span>
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                      style={{ color: 'var(--text-tertiary)', flexShrink: 0 }}>
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Right: activity panel ───────────────────────────────────────── */}
      <div className="dash-right">
        {/* Panel header */}
        <div className="act-panel-hd">
          <span className="act-panel-title">{t.dashboard.activity}</span>
          <span className="act-panel-dot" />
          <span className="act-panel-live">{t.dashboard.live}</span>
        </div>

        {/* Filter chips */}
        <div className="act-panel-filters">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              className={`act-chip${filter === tab.key ? ' active' : ''}`}
              onClick={() => setFilter(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Feed */}
        {loadError ? (
          <ErrorState message={loadError} onRetry={() => setReloadTick((n) => n + 1)} />
        ) : loadingFeed ? (
          <div className="act-panel-empty">
            <span className="muted" style={{ fontSize: 13 }}>{t.dashboard.loading_feed}</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="act-panel-empty">
            <TrophyIcon size={28} />
            <p>{t.dashboard.empty_feed}</p>
            {students.length === 0 && (
              <button className="btn secondary sm" onClick={() => navigate('/students')}>
                {t.dashboard.link_students}
              </button>
            )}
          </div>
        ) : (
          <div className="act-panel-feed">
            {filtered.map((a) => (
              <div
                key={a.id}
                className="act-panel-item"
                onClick={() => navigate(`/students/${a.studentId}`)}
                role="button"
                tabIndex={0}
              >
                {/* Avatar + type dot */}
                <div className="act-panel-avatar-wrap">
                  <div className="avatar sm" style={a.studentAvatar ? { padding: 0, overflow: 'hidden' } : undefined}>
                    {a.studentAvatar
                      ? <img src={a.studentAvatar} alt={a.studentName} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} />
                      : initials(a.studentName)
                    }
                  </div>
                  <span
                    className="act-panel-type-dot"
                    style={{ background: TYPE_META[a.type].dot }}
                    title={TYPE_META[a.type].label}
                  />
                </div>

                {/* Content */}
                <div className="act-panel-body">
                  <div className="act-panel-text">
                    <strong>{a.studentName}</strong> {a.verb}
                  </div>
                  <div className="act-panel-detail">{a.detail}</div>
                  <div className="act-panel-meta">
                    <span
                      className="act-panel-badge"
                      style={{
                        background: TYPE_META[a.type].color + '18',
                        color: TYPE_META[a.type].color,
                      }}
                    >
                      {TYPE_META[a.type].label}
                    </span>
                    <span className="act-panel-time">{relativeTime(a.createdAt)}</span>
                  </div>
                </div>

                {/* Photo thumb */}
                {a.thumb && (a.thumb.startsWith('http') ? a.thumb : thumbs[a.thumb]) && (
                  <img
                    src={a.thumb.startsWith('http') ? a.thumb : thumbs[a.thumb]}
                    alt=""
                    className="act-panel-thumb"
                    style={{ cursor: 'zoom-in' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      const url = a.thumb!.startsWith('http') ? a.thumb! : thumbs[a.thumb!];
                      if (url) setLightbox({ src: url, caption: `${a.studentName} · ${a.detail}` });
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <Lightbox
        src={lightbox?.src ?? null}
        caption={lightbox?.caption}
        onClose={() => setLightbox(null)}
      />
    </div>
  );
}

// ── StatBlock ──────────────────────────────────────────────────────────────

function StatBlock({
  value, label, delta, since,
}: {
  value: number | string | null;
  label: string;
  delta?: number;
  accent?: string;
  icon?: React.ReactNode;
  since?: string;
}): React.JSX.Element {
  const up = (delta ?? 0) >= 0;
  return (
    <div className="stat-block">
      <div className="stat-block-value">{value ?? '—'}</div>
      <div className="stat-block-label">{label}</div>
      {delta != null && (
        <div className={`stat-block-delta ${up ? 'up' : 'down'}`}>
          {up ? '+' : ''}{Math.abs(delta).toFixed(0)}%
          {since && <span className="stat-block-since">{since}</span>}
        </div>
      )}
    </div>
  );
}
