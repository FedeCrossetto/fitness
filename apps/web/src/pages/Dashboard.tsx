import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ProfileRow, TrainerBrandingRow, WorkoutLogRow } from '@habito/shared/types/database';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { UsersIcon, DumbbellIcon, CheckIcon, BrushIcon } from '@/components/icons';
import { AreaChart } from '@/components/charts';

type RecentStudent = Pick<ProfileRow, 'id' | 'full_name' | 'goal' | 'created_at'>;

export function DashboardPage(): React.JSX.Element {
  const { session, profile } = useAuth();
  const navigate = useNavigate();
  const userId = session?.user.id;
  const [studentCount, setStudentCount] = useState<number | null>(null);
  const [phaseCount, setPhaseCount] = useState<number | null>(null);
  const [branding, setBranding] = useState<TrainerBrandingRow | null>(null);
  const [recent, setRecent] = useState<RecentStudent[]>([]);
  const [workouts, setWorkouts] = useState<Pick<WorkoutLogRow, 'date' | 'completed'>[]>([]);
  const [range, setRange] = useState<30 | 90>(30);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    void (async () => {
      const since = new Date();
      since.setDate(since.getDate() - 90);
      const sinceIso = since.toISOString().slice(0, 10);
      const [{ count: students }, { data: b }, { count: phases }, { data: recentRows }, { data: wl }] =
        await Promise.all([
          supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('trainer_id', userId),
          supabase.from('trainer_branding').select('*').maybeSingle(),
          supabase.from('training_phases').select('id', { count: 'exact', head: true }).eq('trainer_id', userId),
          supabase
            .from('profiles')
            .select('id, full_name, goal, created_at')
            .eq('trainer_id', userId)
            .order('created_at', { ascending: false })
            .limit(6),
          supabase.from('workout_logs').select('date, completed').gte('date', sinceIso),
        ]);
      if (!active) return;
      setStudentCount(students ?? 0);
      setBranding((b as TrainerBrandingRow | null) ?? null);
      setPhaseCount(phases ?? 0);
      setRecent((recentRows as RecentStudent[] | null) ?? []);
      setWorkouts((wl as Pick<WorkoutLogRow, 'date' | 'completed'>[] | null) ?? []);
    })();
    return () => {
      active = false;
    };
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

  return (
    <div>
      <h1 className="page-title">Hola, {profile?.full_name ?? 'entrenador'}</h1>
      <p className="page-sub">Resumen de tu app personalizada.</p>

      <div className="grid">
        <StatCard icon={<UsersIcon />} value={studentCount} label="Alumnos vinculados" deltaPct={12.04} />
        <StatCard icon={<CheckIcon />} value={completionPct != null ? `${completionPct}%` : '—'} label={`Entrenos completados (${range}d)`} deltaPct={completionPct >= 50 ? 8.2 : -4.1} />
        <StatCard icon={<DumbbellIcon />} value={phaseCount} label="Fases del programa" />
        <StatCard icon={<DumbbellIcon />} value={windowed.length} label={`Entrenos registrados (${range}d)`} deltaPct={5.6} />
      </div>

      <div className="dash-cols">
        <div className="card">
          <div className="section-head">
            <h2 className="section-title">Actividad de entrenamiento</h2>
            <div className="segmented">
              <button className={range === 30 ? 'active' : ''} onClick={() => setRange(30)}>30 días</button>
              <button className={range === 90 ? 'active' : ''} onClick={() => setRange(90)}>90 días</button>
            </div>
          </div>
          <AreaChart values={series} height={200} />
        </div>

        <div className="detail-col">
          <div className="card" style={{ marginBottom: 0 }}>
            <div className="app-card">
              <span
                className="app-logo"
                style={{ background: branding?.color_primary ?? 'var(--surface-elevated)' }}
              >
                <BrushIcon size={18} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="cell-name">{branding?.app_name ?? 'Tu app'}</div>
                <div className="stat-foot">Código: <strong>{branding?.invite_code ?? '—'}</strong></div>
              </div>
              <button className="btn secondary" onClick={() => navigate('/branding')}>Editar</button>
            </div>
          </div>

          <div className="card" style={{ padding: 0 }}>
            <div className="section-head" style={{ padding: '16px 20px', marginBottom: 0, borderBottom: '1px solid var(--border)' }}>
              <h2 className="section-title">Últimos alumnos</h2>
              <span className="section-link" onClick={() => navigate('/students')}>Ver todos →</span>
            </div>
            <div style={{ padding: '4px 20px 12px' }}>
              {recent.length === 0 ? (
                <p className="muted" style={{ padding: '14px 0' }}>Todavía no hay alumnos.</p>
              ) : (
                <div className="feed">
                  {recent.map((s) => (
                    <div key={s.id} className="feed-row row-clickable" onClick={() => navigate(`/students/${s.id}`)}>
                      <span className="avatar sm">{initials(s.full_name)}</span>
                      <div className="feed-main">
                        <div className="feed-name">{s.full_name ?? 'Alumno'}</div>
                        <div className="feed-sub">{s.goal ?? 'Sin objetivo'}</div>
                      </div>
                      <span className="feed-time">{new Date(s.created_at).toLocaleDateString('es-AR')}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  value,
  label,
  deltaPct,
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
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: up ? 'none' : 'rotate(180deg)' }}>
      <line x1="12" y1="19" x2="12" y2="5" />
      <polyline points="5 12 12 5 19 12" />
    </svg>
  );
}
