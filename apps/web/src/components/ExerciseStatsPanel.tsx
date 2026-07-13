import { useEffect, useMemo, useState } from 'react';
import type { WorkoutLogRow } from '@reset-fitness/shared/types/database';
import { supabase } from '@/lib/supabase';

function parseIsoDateLocal(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function fmtShort(d: Date): string {
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
}
function fmtLong(iso: string): string {
  return parseIsoDateLocal(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });
}
/** 1RM estimado (fórmula de Epley) a partir de una serie completada. */
function epley1RM(weightKg: number, reps: number): number {
  return reps <= 1 ? weightKg : weightKg * (1 + reps / 30);
}

interface ExerciseOption { id: string; name: string; imageUrl: string | null; lastUsed: string }
interface StatPoint { date: string; value: number }
interface HistoryEntry { date: string; workoutName: string; sets: { setNumber: number; weightKg: number | null; reps: number | null }[] }

function LineChart({ points, unit }: { points: StatPoint[]; unit: string }): React.JSX.Element {
  const [hover, setHover] = useState<number | null>(null);
  const W = 900, H = 190, padT = 16, padB = 24, padL = 6, padR = 6;
  if (points.length === 0) return <div className="muted" style={{ height: H, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>Sin registros en este período.</div>;
  const vals = points.map((p) => p.value);
  let min = Math.min(...vals), max = Math.max(...vals);
  if (min === max) { min -= 1; max += 1; }
  const pad = (max - min) * 0.15; min -= pad; max += pad;
  const iw = W - padL - padR;
  const step = points.length > 1 ? iw / (points.length - 1) : 0;
  const x = (i: number) => padL + i * step;
  const y = (v: number) => padT + (1 - (v - min) / (max - min)) * (H - padT - padB);
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const hi = hover ?? points.length - 1;
  const hp = points[hi];
  const ttX = Math.max(60, Math.min(W - 60, x(hi)));
  const axisIdx = points.length <= 1 ? [0] : [0, Math.floor((points.length - 1) / 2), points.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H, display: 'block', overflow: 'visible' }} onMouseLeave={() => setHover(null)}>
      <path d={line} fill="none" stroke="var(--accent)" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => <circle key={i} cx={x(i)} cy={y(p.value)} r={i === hi ? 4.5 : 2.6} fill="#fff" stroke="var(--accent)" strokeWidth={2} />)}
      {axisIdx.map((i) => (
        <text key={i} x={x(i)} y={H - 6} fontSize={11} textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'} fill="var(--text-tertiary)" fontFamily="inherit">
          {fmtShort(parseIsoDateLocal(points[i].date))}
        </text>
      ))}
      {hp && (
        <>
          <rect x={ttX - 58} y={y(hp.value) - 42} width={116} height={30} rx={7} fill="var(--text-primary)" />
          <text x={ttX} y={y(hp.value) - 27} textAnchor="middle" fontSize={12} fontWeight={700} fill="#fff" fontFamily="inherit">{hp.value} {unit}</text>
          <text x={ttX} y={y(hp.value) - 15} textAnchor="middle" fontSize={9.5} fill="rgba(255,255,255,0.7)" fontFamily="inherit">{fmtShort(parseIsoDateLocal(hp.date))}</text>
        </>
      )}
      {points.map((_, i) => <rect key={i} x={x(i) - step / 2} width={step || iw} y={0} height={H} fill="transparent" onMouseEnter={() => setHover(i)} />)}
    </svg>
  );
}

export function ExerciseStatsPanel({ clientId }: { clientId: string }): React.JSX.Element {
  const [logs, setLogs] = useState<WorkoutLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<'stats' | 'history'>('stats');

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('workout_logs').select('*').eq('user_id', clientId)
        .not('session_detail', 'is', null).order('date', { ascending: true }).limit(200);
      setLogs((data as WorkoutLogRow[] | null) ?? []);
      setLoading(false);
    })();
  }, [clientId]);

  const exercises = useMemo<ExerciseOption[]>(() => {
    const map = new Map<string, ExerciseOption>();
    for (const log of logs) {
      for (const ex of log.session_detail?.exercises ?? []) {
        const prev = map.get(ex.exerciseId);
        if (!prev || log.date > prev.lastUsed) {
          map.set(ex.exerciseId, { id: ex.exerciseId, name: ex.exerciseName, imageUrl: ex.imageUrl, lastUsed: log.date });
        }
      }
    }
    return [...map.values()].sort((a, b) => b.lastUsed.localeCompare(a.lastUsed));
  }, [logs]);

  useEffect(() => {
    if (!selected && exercises.length > 0) setSelected(exercises[0].id);
  }, [exercises, selected]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? exercises.filter((e) => e.name.toLowerCase().includes(q)) : exercises;
  }, [exercises, search]);

  const { weightSeries, oneRmSeries, volumeSeries, history, exName } = useMemo(() => {
    const weightSeries: StatPoint[] = [];
    const oneRmSeries: StatPoint[] = [];
    const volumeSeries: StatPoint[] = [];
    const history: HistoryEntry[] = [];
    let name = '';
    if (!selected) return { weightSeries, oneRmSeries, volumeSeries, history, exName: name };
    for (const log of logs) {
      const ex = log.session_detail?.exercises.find((e) => e.exerciseId === selected);
      if (!ex) continue;
      name = ex.exerciseName;
      const completed = ex.sets.filter((s) => s.completed && s.weightKg != null && s.reps != null);
      if (completed.length === 0) continue;
      const heaviest = Math.max(...completed.map((s) => s.weightKg!));
      const best1rm = Math.max(...completed.map((s) => epley1RM(s.weightKg!, s.reps!)));
      const bestVol = Math.max(...completed.map((s) => s.weightKg! * s.reps!));
      weightSeries.push({ date: log.date, value: heaviest });
      oneRmSeries.push({ date: log.date, value: Math.round(best1rm) });
      volumeSeries.push({ date: log.date, value: Math.round(bestVol) });
      history.push({ date: log.date, workoutName: log.workout_name, sets: ex.sets.map((s) => ({ setNumber: s.setNumber, weightKg: s.weightKg, reps: s.reps })) });
    }
    return { weightSeries, oneRmSeries, volumeSeries, history: history.reverse(), exName: name };
  }, [logs, selected]);

  if (loading) return <div className="card"><p className="muted" style={{ margin: 0 }}>Cargando estadísticas…</p></div>;

  if (exercises.length === 0) {
    return <div className="card"><p className="muted" style={{ margin: 0 }}>Este cliente todavía no registró entrenamientos con series completadas.</p></div>;
  }

  const heaviest = weightSeries.length ? Math.max(...weightSeries.map((p) => p.value)) : null;
  const best1rm = oneRmSeries.length ? Math.max(...oneRmSeries.map((p) => p.value)) : null;
  const bestVol = volumeSeries.length ? Math.max(...volumeSeries.map((p) => p.value)) : null;

  return (
    <div className="exs-layout">
      <div className="card exs-list-card">
        <div className="search-field" style={{ marginBottom: 10 }}>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar ejercicio…" />
        </div>
        <div className="exs-list">
          {filtered.map((ex) => (
            <button key={ex.id} type="button" className={`exs-list-item${selected === ex.id ? ' active' : ''}`} onClick={() => setSelected(ex.id)}>
              {ex.imageUrl ? <img src={ex.imageUrl} alt="" className="exs-thumb" /> : <span className="exs-thumb exs-thumb--empty" />}
              <span>{ex.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="card" style={{ minWidth: 0 }}>
        <div className="section-title" style={{ marginBottom: 4 }}>{exName || 'Ejercicio'}</div>
        <div className="exs-tabs">
          <button type="button" className={`exs-tab${view === 'stats' ? ' active' : ''}`} onClick={() => setView('stats')}>Estadísticas</button>
          <button type="button" className={`exs-tab${view === 'history' ? ' active' : ''}`} onClick={() => setView('history')}>Historial</button>
        </div>

        {view === 'stats' ? (
          <>
            <div className="exs-stat-block">
              <div className="exs-stat-title">Peso</div>
              <div className="muted" style={{ fontSize: 12 }}>Peso máximo</div>
              <div className="exs-stat-value">{heaviest != null ? `${heaviest} kg` : '—'}</div>
              <LineChart points={weightSeries} unit="kg" />
            </div>
            <div className="exs-stat-block">
              <div className="exs-stat-title">1RM estimado</div>
              <div className="muted" style={{ fontSize: 12 }}>Mejor 1RM</div>
              <div className="exs-stat-value">{best1rm != null ? `${best1rm} kg` : '—'}</div>
              <LineChart points={oneRmSeries} unit="kg" />
            </div>
            <div className="exs-stat-block">
              <div className="exs-stat-title">Volumen por serie</div>
              <div className="muted" style={{ fontSize: 12 }}>Mejor serie</div>
              <div className="exs-stat-value">{bestVol != null ? `${bestVol} kg` : '—'}</div>
              <LineChart points={volumeSeries} unit="kg" />
            </div>
          </>
        ) : (
          <div>
            {history.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>Sin historial.</p>
            ) : history.map((h, i) => (
              <div key={i} className="exs-history-block">
                <div style={{ fontWeight: 650, fontSize: 13.5 }}>{h.workoutName}</div>
                <div className="muted" style={{ fontSize: 11.5, marginBottom: 6, textTransform: 'capitalize' }}>{fmtLong(h.date)}</div>
                {h.sets.map((s) => (
                  <div key={s.setNumber} className="exs-set-row">
                    <span className="exs-set-num">{s.setNumber}</span>
                    <span>{s.weightKg != null && s.reps != null ? `${s.weightKg}kg × ${s.reps} reps` : '—'}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        .exs-layout { display: grid; grid-template-columns: 260px minmax(0, 1fr); gap: 20px; align-items: start; }
        @media (max-width: 900px) { .exs-layout { grid-template-columns: 1fr; } }
        .exs-list-card { position: sticky; top: 12px; }
        .exs-list { display: flex; flex-direction: column; max-height: 560px; overflow-y: auto; }
        .exs-list-item { display: flex; align-items: center; gap: 9px; width: 100%; text-align: left; background: none; border: none; cursor: pointer; padding: 7px 8px; border-radius: 9px; font-size: 12.5px; font-weight: 550; color: var(--text-secondary); }
        .exs-list-item:hover { background: var(--surface-elevated); color: var(--text-primary); }
        .exs-list-item.active { background: var(--accent-soft); color: var(--accent-text); font-weight: 650; }
        .exs-thumb { width: 30px; height: 30px; border-radius: 8px; object-fit: cover; flex-shrink: 0; background: var(--surface-elevated); }
        .exs-thumb--empty { border: 1px dashed var(--border-strong); }
        .exs-tabs { display: flex; gap: 18px; border-bottom: 1px solid var(--border); margin: 6px 0 16px; }
        .exs-tab { background: none; border: none; cursor: pointer; padding: 8px 2px; font-size: 13px; font-weight: 600; color: var(--text-tertiary); border-bottom: 2px solid transparent; margin-bottom: -1px; }
        .exs-tab.active { color: var(--text-primary); border-bottom-color: var(--text-primary); }
        .exs-stat-block { margin-bottom: 26px; }
        .exs-stat-title { font-size: 13px; font-weight: 700; }
        .exs-stat-value { font-size: 26px; font-weight: 700; letter-spacing: -0.02em; margin-bottom: 6px; }
        .exs-history-block { padding: 10px 0; border-bottom: 1px solid var(--border); }
        .exs-history-block:last-child { border-bottom: none; }
        .exs-set-row { display: flex; gap: 10px; align-items: center; font-size: 13px; padding: 3px 0; }
        .exs-set-num { display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; border-radius: 6px; background: var(--surface-elevated); font-size: 11px; font-weight: 700; flex-shrink: 0; }
      `}</style>
    </div>
  );
}
