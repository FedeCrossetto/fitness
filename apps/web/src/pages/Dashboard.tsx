import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ProfileRow, WorkoutLogRow, MealLogRow, ProgressPhotoRow, BodyMeasurementRow } from '@reset-fitness/shared/types/database';
import { formatMacroDisplay, DEFAULT_KCAL_GOAL, buildTrophyLeaderboard, type TrophyRankPeriod, formatWorkoutDuration, formatWorkoutVolume, summarizeWorkoutForFeed } from '@reset-fitness/shared';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from '@/hooks/useTranslation';
import { TrophyIcon, UsersIcon, CheckIcon, DumbbellIcon } from '@/components/icons';
import { AreaChart } from '@/components/charts';
import { brand } from '@/theme/brand';
import { ErrorState, Lightbox, useCountUp } from '@/components/ui';
import { UserAvatar } from '@/components/UserAvatar';
import { ClientListCard } from '@/components/ClientListCard';

// ── Types ──────────────────────────────────────────────────────────────────

type ClientMin = Pick<ProfileRow, 'id' | 'full_name' | 'avatar_url' | 'goal' | 'created_at'>;

type ActivityType = 'workout' | 'meal' | 'photo' | 'measurement' | 'joined';

interface ActivityCopy {
  clientDefault: string;
  workoutCompleted: string;
  workoutIncomplete: string;
  workoutDefault: string;
  mealCaloriesCompleted: string;
  formatMealDetail: (kcal: number, protein: string, carbs: string, fat: string) => string;
  photoUploaded: string;
  measurementLogged: string;
  measurementDefault: string;
  formatWeight: (kg: number) => string;
  formatFat: (pct: number) => string;
  joinedVerb: string;
  joinedDetail: string;
}

interface Activity {
  id: string;
  clientId: string;
  clientName: string;
  clientAvatar?: string | null;
  type: ActivityType;
  verb: string;
  detail: string;
  thumb?: string | null;
  createdAt: string;
  workoutTitle?: string;
  workoutStats?: string;
  workoutLines?: string[];
}

// ── Constants ──────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<ActivityType, { color: string; dot: string }> = {
  workout:     { color: '#16a34a', dot: '#16a34a' },
  meal:        { color: '#f59e0b', dot: '#f59e0b' },
  photo:       { color: '#6366f1', dot: '#6366f1' },
  measurement: { color: '#0ea5e9', dot: '#0ea5e9' },
  joined:      { color: '#ec4899', dot: '#ec4899' },
};

// ── Helpers ────────────────────────────────────────────────────────────────

function relativeTime(iso: string, copy: {
  now: string;
  min: (n: number) => string;
  hour: (n: number) => string;
  yesterday: string;
  days: (n: number) => string;
}): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return copy.now;
  if (m < 60) return copy.min(m);
  const h = Math.floor(m / 60);
  if (h < 24) return copy.hour(h);
  const d = Math.floor(h / 24);
  if (d === 1) return copy.yesterday;
  return copy.days(d);
}

// ── Activity builder ───────────────────────────────────────────────────────

type MealLogForFeed = Pick<
  MealLogRow,
  'id' | 'user_id' | 'date' | 'energy_kcal' | 'protein_g' | 'carbs_g' | 'fat_g' | 'is_included' | 'created_at'
>;

function buildMealDayActivities(
  clients: ClientMin[],
  mLogs: MealLogForFeed[],
  kcalGoal: number,
  copy: ActivityCopy,
): Activity[] {
  const byId = new Map(clients.map((s) => [s.id, s]));
  const byDay = new Map<string, MealLogForFeed[]>();

  for (const m of mLogs) {
    const key = `${m.user_id}:${m.date}`;
    const list = byDay.get(key);
    if (list) list.push(m);
    else byDay.set(key, [m]);
  }

  const items: Activity[] = [];

  for (const dayMeals of byDay.values()) {
    const sorted = [...dayMeals].sort((a, b) => a.created_at.localeCompare(b.created_at));
    let kcal = 0;
    let protein = 0;
    let carbs = 0;
    let fat = 0;
    let completedAt: string | null = null;

    for (const m of sorted) {
      if (!m.is_included) continue;
      kcal += m.energy_kcal ?? 0;
      protein += m.protein_g ?? 0;
      carbs += m.carbs_g ?? 0;
      fat += m.fat_g ?? 0;
      if (completedAt === null && kcal >= kcalGoal) {
        completedAt = m.created_at;
      }
    }

    if (completedAt === null) continue;
    if (new Date(completedAt).getTime() < Date.now() - 7 * 86400000) continue;

    const userId = dayMeals[0].user_id;
    const date = dayMeals[0].date;
    const s = byId.get(userId);
    if (!s) continue;

    items.push({
      id: `md-${userId}-${date}`,
      clientId: userId,
      clientName: s.full_name ?? copy.clientDefault,
      clientAvatar: s.avatar_url,
      type: 'meal',
      verb: copy.mealCaloriesCompleted,
      detail: copy.formatMealDetail(kcal, formatMacroDisplay(protein), formatMacroDisplay(carbs), formatMacroDisplay(fat)),
      createdAt: completedAt,
    });
  }

  return items;
}

function buildActivities(
  clients: ClientMin[],
  wLogs: Pick<
    WorkoutLogRow,
    | 'id'
    | 'user_id'
    | 'workout_name'
    | 'workout_type'
    | 'completed'
    | 'created_at'
    | 'duration_min'
    | 'elapsed_seconds'
    | 'total_volume_kg'
    | 'session_detail'
  >[],
  mLogs: MealLogForFeed[],
  pPhotos: Pick<ProgressPhotoRow, 'id' | 'user_id' | 'photo_url' | 'position' | 'created_at'>[],
  bMeasurements: Pick<BodyMeasurementRow, 'id' | 'user_id' | 'weight_kg' | 'body_fat_pct' | 'created_at'>[],
  copy: ActivityCopy,
  kcalGoal = DEFAULT_KCAL_GOAL,
): Activity[] {
  const byId = new Map(clients.map((s) => [s.id, s]));

  const items: Activity[] = [];

  for (const w of wLogs) {
    const s = byId.get(w.user_id);
    if (!s) continue;
    const title = w.workout_name ?? (w.workout_type ?? copy.workoutDefault);
    const lines = summarizeWorkoutForFeed(w.session_detail).map(
      (line) => `${line.completedSets} series · ${line.name}`,
    );
    const statsParts = [
      formatWorkoutDuration(w.duration_min, w.elapsed_seconds),
      formatWorkoutVolume(w.total_volume_kg),
    ].filter(Boolean);
    items.push({
      id: `w-${w.id}`,
      clientId: w.user_id,
      clientName: s.full_name ?? copy.clientDefault,
      clientAvatar: s.avatar_url,
      type: 'workout',
      verb: w.completed ? copy.workoutCompleted : copy.workoutIncomplete,
      detail: title,
      workoutTitle: title,
      workoutStats: statsParts.join(' · '),
      workoutLines: lines.slice(0, 4),
      createdAt: w.created_at,
    });
  }

  items.push(...buildMealDayActivities(clients, mLogs, kcalGoal, copy));

  for (const p of pPhotos) {
    const s = byId.get(p.user_id);
    if (!s) continue;
    items.push({
      id: `p-${p.id}`,
      clientId: p.user_id,
      clientName: s.full_name ?? copy.clientDefault,
      clientAvatar: s.avatar_url,
      type: 'photo',
      verb: copy.photoUploaded,
      detail: p.position,
      thumb: p.photo_url,
      createdAt: p.created_at,
    });
  }

  for (const b of bMeasurements) {
    const s = byId.get(b.user_id);
    if (!s) continue;
    const parts: string[] = [];
    if (b.weight_kg != null) parts.push(copy.formatWeight(b.weight_kg));
    if (b.body_fat_pct != null) parts.push(copy.formatFat(b.body_fat_pct));
    items.push({
      id: `b-${b.id}`,
      clientId: b.user_id,
      clientName: s.full_name ?? copy.clientDefault,
      clientAvatar: s.avatar_url,
      type: 'measurement',
      verb: copy.measurementLogged,
      detail: parts.join(' · ') || copy.measurementDefault,
      createdAt: b.created_at,
    });
  }

  // New clients (created_at in last 7 days)
  const cutoff = Date.now() - 7 * 86400000;
  for (const s of clients) {
    if (new Date(s.created_at).getTime() >= cutoff) {
      items.push({
        id: `j-${s.id}`,
        clientId: s.id,
        clientName: s.full_name ?? copy.clientDefault,
        clientAvatar: s.avatar_url,
        type: 'joined',
        verb: copy.joinedVerb,
        detail: copy.joinedDetail,
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

  const activityCopy = useMemo<ActivityCopy>(() => ({
    clientDefault: t.dashboard.activity_student_default,
    workoutCompleted: t.dashboard.activity_workout_completed,
    workoutIncomplete: t.dashboard.activity_workout_incomplete,
    workoutDefault: t.dashboard.activity_workout_default,
    mealCaloriesCompleted: t.dashboard.activity_meal_calories,
    formatMealDetail: (kcal, protein, carbs, fat) =>
      i18n(t.dashboard.activity_meal_detail, {
        kcal: Math.round(kcal),
        protein,
        carbs,
        fat,
      }),
    photoUploaded: t.dashboard.activity_photo,
    measurementLogged: t.dashboard.activity_measurement,
    measurementDefault: t.dashboard.activity_measurement_default,
    formatWeight: (n) => i18n(t.dashboard.activity_measurement_weight, { n }),
    formatFat: (n) => i18n(t.dashboard.activity_measurement_fat, { n }),
    joinedVerb: t.dashboard.activity_joined,
    joinedDetail: t.dashboard.activity_joined_detail,
  }), [t, i18n, language]);

  const relativeCopy = useMemo(() => ({
    now: t.dashboard.relative_now,
    min: (n: number) => i18n(t.dashboard.relative_min, { n }),
    hour: (n: number) => i18n(t.dashboard.relative_hour, { n }),
    yesterday: t.dashboard.relative_yesterday,
    days: (n: number) => i18n(t.dashboard.relative_days, { n }),
  }), [t, i18n, language]);

  const filterTabs = useMemo(
    () =>
      [
        { key: 'all' as const, label: t.dashboard.activity_filter_all },
        { key: 'workout' as const, label: t.dashboard.activity_filter_workout },
        { key: 'meal' as const, label: t.dashboard.activity_filter_meal },
        { key: 'photo' as const, label: t.dashboard.activity_filter_photo },
        { key: 'measurement' as const, label: t.dashboard.activity_filter_measurement },
      ],
    [t, language],
  );

  const typeLabels = useMemo<Record<ActivityType, string>>(
    () => ({
      workout: t.dashboard.activity_type_workout,
      meal: t.dashboard.activity_type_meal,
      photo: t.dashboard.activity_type_photo,
      measurement: t.dashboard.activity_type_measurement,
      joined: t.dashboard.activity_type_joined,
    }),
    [t, language],
  );

  // Left panel state
  const [clients, setClients]         = useState<ClientMin[]>([]);
  const [clientCount, setClientCount] = useState<number | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [phaseCount, setPhaseCount]     = useState<number | null>(null);
  const [workouts, setWorkouts]         = useState<Pick<WorkoutLogRow, 'date' | 'completed'>[]>([]);
  const [range, setRange]               = useState<30 | 90>(30);
  const [trophyRaw, setTrophyRaw]           = useState<{ user_id: string; date: string }[]>([]);
  const [trophyClients, setTrophyClients]   = useState<{ id: string; full_name: string | null; avatar_url: string | null; goal: string | null }[]>([]);
  const [trophyPeriod, setTrophyPeriod]     = useState<TrophyRankPeriod>('30d');
  const [loadingRank, setLoadingRank]       = useState(true);

  // Activity feed state
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [filter, setFilter]           = useState<ActivityType | 'all'>('all');
  const [loadError, setLoadError]     = useState<string | null>(null);
  const [reloadTick, setReloadTick]   = useState(0);
  // Buckets privados: resolvemos URLs firmadas para los thumbnails del feed.
  const [thumbs, setThumbs]           = useState<Record<string, string>>({});
  const [lightbox, setLightbox]       = useState<{ src: string; caption: string } | null>(null);

  const formatTrophyCount = useCallback(
    (n: number) => (n === 1 ? t.dashboard.trophy_rank_count_one : i18n(t.dashboard.trophy_rank_count, { n })),
    [t, i18n, language],
  );

  const formatTrophyStreak = useCallback(
    (n: number) => i18n(t.dashboard.trophy_rank_streak, { n }),
    [t, i18n, language],
  );

  const trophyPeriodOptions = useMemo(
    () => [
      { key: '30d' as const, label: t.dashboard.trophy_rank_period_30d },
      { key: 'month' as const, label: t.dashboard.trophy_rank_period_month },
      { key: 'all' as const, label: t.dashboard.trophy_rank_period_all },
    ],
    [t, language],
  );

  const trophyRank = useMemo(() => {
    const goalByUser = new Map(trophyClients.map((c) => [c.id, c.goal]));
    return buildTrophyLeaderboard(
      trophyClients,
      trophyRaw,
      trophyPeriod,
      t.dashboard.activity_student_default,
      language === 'es' ? 'es-AR' : 'en-US',
    ).map((entry) => ({
      ...entry,
      subtitle: goalByUser.get(entry.userId) ?? t.profile.no_goal,
    }));
  }, [trophyClients, trophyRaw, trophyPeriod, t.dashboard.activity_student_default, t.profile.no_goal, language]);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    setLoadError(null);

    void (async () => {
     try {
      setLoadingRank(true);
      // ── Stats queries ────────────────────────────────────────────────────
      const since90 = new Date();
      since90.setDate(since90.getDate() - 90);

      const [{ count: sc }, { count: pc }, { count: pending }, { data: clientsData }, { data: wl }] = await Promise.all([
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
      setClientCount(sc ?? 0);
      setPendingCount(pending ?? 0);
      setPhaseCount(pc ?? 0);
      setClients((clientsData as ClientMin[] | null) ?? []);
      setWorkouts((wl as Pick<WorkoutLogRow, 'date' | 'completed'>[] | null) ?? []);

      const { data: allActive } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, goal')
        .eq('trainer_id', userId)
        .eq('client_status', 'active');

      const activeClients = allActive ?? [];
      const activeIds = activeClients.map((p) => p.id);

      if (activeIds.length === 0) {
        setTrophyClients([]);
        setTrophyRaw([]);
        setLoadingRank(false);
      } else {
        const { data: trophyRows, error: trophyErr } = await supabase
          .from('user_trophy_days')
          .select('user_id, date')
          .in('user_id', activeIds);

        if (trophyErr) throw trophyErr;

        if (!active) return;
        setTrophyClients(activeClients);
        setTrophyRaw(trophyRows ?? []);
        setLoadingRank(false);
      }

      // ── Activity feed queries ─────────────────────────────────────────────
      const allClients = (clientsData as ClientMin[] | null) ?? [];
      const ids = allClients.map((s) => s.id);

      if (ids.length === 0) {
        setLoadingFeed(false);
        return;
      }

      const since7 = new Date();
      since7.setDate(since7.getDate() - 7);
      const since7Iso = since7.toISOString();
      const since7Date = since7.toISOString().slice(0, 10);

      const [
        { data: wLogs },
        { data: mLogs },
        { data: pPhotos },
        { data: bMeas },
      ] = await Promise.all([
        supabase
          .from('workout_logs')
          .select('id, user_id, workout_name, workout_type, completed, created_at, duration_min, elapsed_seconds, total_volume_kg, session_detail')
          .in('user_id', ids)
          .gte('created_at', since7Iso)
          .order('created_at', { ascending: false })
          .limit(40),
        supabase
          .from('meal_logs')
          .select('id, user_id, date, energy_kcal, protein_g, carbs_g, fat_g, is_included, created_at')
          .in('user_id', ids)
          .gte('date', since7Date)
          .order('created_at', { ascending: false })
          .limit(500),
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
        allClients,
        (wLogs ?? []) as Parameters<typeof buildActivities>[1],
        (mLogs ?? []) as Parameters<typeof buildActivities>[2],
        (pPhotos ?? []) as Parameters<typeof buildActivities>[3],
        (bMeas ?? []) as Parameters<typeof buildActivities>[4],
        activityCopy,
      ));
      setLoadingFeed(false);
     } catch (err) {
      if (active) {
        setLoadError(err instanceof Error ? err.message : 'No pudimos cargar el panel.');
        setLoadingFeed(false);
        setLoadingRank(false);
      }
     }
    })();

    return () => { active = false; };
  }, [userId, reloadTick, activityCopy]);

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

      {/* ── Left: stats + chart + clients ─────────────────────────────── */}
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
            onClick={() => navigate('/clients?tab=pending')}
          >
            <span>{i18n(t.dashboard.pending_banner, { count: pendingCount })}</span>
            <span className="dash-pending-banner-link">{t.dashboard.pending_review} →</span>
          </button>
        ) : null}

        {/* Stats strip */}
        <div className="stats-strip">
          <StatBlock value={clientCount ?? '—'} label={t.dashboard.clients} icon={<UsersIcon size={18} />} />
          <StatBlock
            value={completionPct ? `${completionPct}%` : '—'}
            label={i18n(t.dashboard.workouts_pct, { range })}
            icon={<CheckIcon size={18} />}
          />
          <StatBlock value={phaseCount ?? '—'} label={t.dashboard.phases} icon={<TrophyIcon size={18} />} />
          <StatBlock
            value={windowed.length}
            label={i18n(t.dashboard.workouts_n, { range })}
            icon={<DumbbellIcon size={18} />}
          />
        </div>

        {/* Chart (full width) */}
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
            <AreaChart values={series} height={148} color={brand.color.primary} />
          </div>
        </div>

        <ClientListCard
          entries={trophyRank}
          loading={loadingRank}
          title={t.dashboard.trophy_rank_title}
          emptyMessage={t.dashboard.trophy_rank_empty}
          period={trophyPeriod}
          periodOptions={trophyPeriodOptions}
          onPeriodChange={setTrophyPeriod}
          formatCount={formatTrophyCount}
          formatStreak={formatTrophyStreak}
          onClientClick={(id) => navigate(`/clients/${id}`)}
        />
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
          {filterTabs.map((tab) => (
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
            {clients.length === 0 && (
              <button className="btn secondary sm" onClick={() => navigate('/clients')}>
                {t.dashboard.link_clients}
              </button>
            )}
          </div>
        ) : (
          <div className="act-panel-feed">
            {filtered.map((a) => (
              <div
                key={a.id}
                className="act-panel-item"
                onClick={() => navigate(`/clients/${a.clientId}`)}
                role="button"
                tabIndex={0}
              >
                {/* Avatar + type dot */}
                <div className="act-panel-avatar-wrap">
                  <UserAvatar name={a.clientName} url={a.clientAvatar} size="sm" />
                  <span
                    className="act-panel-type-dot"
                    style={{ background: TYPE_COLORS[a.type].dot }}
                    title={typeLabels[a.type]}
                  />
                </div>

                {/* Content */}
                <div className="act-panel-body">
                  <div className="act-panel-text">
                    <strong>{a.clientName}</strong> {a.verb}
                  </div>
                  {a.type === 'workout' && a.workoutTitle ? (
                    <div className="act-workout-card">
                      <div className="act-workout-title">{a.workoutTitle}</div>
                      {a.workoutStats ? <div className="act-workout-stats">{a.workoutStats}</div> : null}
                      {a.workoutLines && a.workoutLines.length > 0 ? (
                        <ul className="act-workout-lines">
                          {a.workoutLines.map((line) => (
                            <li key={line}>{line}</li>
                          ))}
                        </ul>
                      ) : (
                        <div className="act-panel-detail">{a.detail}</div>
                      )}
                    </div>
                  ) : (
                    <div className="act-panel-detail">{a.detail}</div>
                  )}
                  <div className="act-panel-meta">
                    <span
                      className="act-panel-badge"
                      style={{
                        background: TYPE_COLORS[a.type].color + '18',
                        color: TYPE_COLORS[a.type].color,
                      }}
                    >
                      {typeLabels[a.type]}
                    </span>
                    <span className="act-panel-time">{relativeTime(a.createdAt, relativeCopy)}</span>
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
                      if (url) setLightbox({ src: url, caption: `${a.clientName} · ${a.detail}` });
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
  value, label, delta, since, icon,
}: {
  value: number | string | null;
  label: string;
  delta?: number;
  accent?: string;
  icon?: React.ReactNode;
  since?: string;
}): React.JSX.Element {
  const up = (delta ?? 0) >= 0;
  const numeric = typeof value === 'number' ? value : null;
  const animated = useCountUp(numeric ?? 0);
  const display = numeric !== null ? Math.round(animated).toLocaleString('es-AR') : (value ?? '—');
  return (
    <div className="stat-block">
      {icon && <div className="stat-block-icon">{icon}</div>}
      <div className="stat-block-value">{display}</div>
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
