import { useEffect, useMemo, useState } from 'react';
import type { WorkoutLogRow } from '@reset-fitness/shared/types/database';
import { supabase } from '@/lib/supabase';

function parseIsoDateLocal(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function fmtLong(iso: string): string {
  return parseIsoDateLocal(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
}
function epley1RM(weightKg: number, reps: number): number {
  return reps <= 1 ? weightKg : weightKg * (1 + reps / 30);
}
function capitalize(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}

interface MuscleVolume { muscle: string; volume: number }
interface PersonalRecord { exerciseName: string; oneRm: number; weightKg: number; reps: number; date: string }

/** Nota: esta pantalla no existe con contenido en Hevy Coach (la vimos vacía
 * al revisarla) — se construye con datos REALES de session_detail (no
 * mockeados), a diferencia del panel "Series por grupo muscular" del editor
 * de programas que sí usa datos simulados. */
export function AdvancedStatsPanel({ clientId }: { clientId: string }): React.JSX.Element {
  const [logs, setLogs] = useState<WorkoutLogRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const since = (() => { const d = new Date(); d.setDate(d.getDate() - 89); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
      const { data } = await supabase
        .from('workout_logs').select('*').eq('user_id', clientId)
        .gte('date', since).not('session_detail', 'is', null).order('date', { ascending: true });
      setLogs((data as WorkoutLogRow[] | null) ?? []);
      setLoading(false);
    })();
  }, [clientId]);

  const muscleVolumes = useMemo<MuscleVolume[]>(() => {
    const map = new Map<string, number>();
    for (const log of logs) {
      for (const ex of log.session_detail?.exercises ?? []) {
        const muscles = (ex.targetMuscles && ex.targetMuscles.length > 0) ? ex.targetMuscles : (ex.bodyPart ? [ex.bodyPart] : []);
        if (muscles.length === 0) continue;
        const vol = ex.sets.filter((s) => s.completed && s.weightKg != null && s.reps != null).reduce((sum, s) => sum + s.weightKg! * s.reps!, 0);
        if (vol === 0) continue;
        // El volumen del ejercicio se reparte entre sus músculos objetivo.
        const share = vol / muscles.length;
        for (const m of muscles) map.set(m, (map.get(m) ?? 0) + share);
      }
    }
    return [...map.entries()].map(([muscle, volume]) => ({ muscle: capitalize(muscle), volume: Math.round(volume) })).sort((a, b) => b.volume - a.volume).slice(0, 10);
  }, [logs]);

  const records = useMemo<PersonalRecord[]>(() => {
    const best = new Map<string, PersonalRecord>();
    for (const log of logs) {
      for (const ex of log.session_detail?.exercises ?? []) {
        for (const s of ex.sets) {
          if (!s.completed || s.weightKg == null || s.reps == null) continue;
          const rm = epley1RM(s.weightKg, s.reps);
          const prev = best.get(ex.exerciseId);
          if (!prev || rm > prev.oneRm) {
            best.set(ex.exerciseId, { exerciseName: ex.exerciseName, oneRm: Math.round(rm), weightKg: s.weightKg, reps: s.reps, date: log.date });
          }
        }
      }
    }
    return [...best.values()].sort((a, b) => b.oneRm - a.oneRm).slice(0, 8);
  }, [logs]);

  if (loading) return <div className="card"><p className="muted" style={{ margin: 0 }}>Cargando…</p></div>;

  const maxVol = Math.max(...muscleVolumes.map((m) => m.volume), 1);

  return (
    <div className="adv-layout">
      <div className="card">
        <div className="section-title" style={{ marginBottom: 4 }}>Volumen por grupo muscular</div>
        <div className="sd-section-sub" style={{ marginBottom: 14 }}>Últimos 90 días</div>
        {muscleVolumes.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>Sin datos suficientes todavía.</p>
        ) : (
          <div className="adv-muscle-list">
            {muscleVolumes.map((m) => (
              <div key={m.muscle} className="adv-muscle-row">
                <span className="adv-muscle-label">{m.muscle}</span>
                <div className="adv-muscle-bar-track">
                  <div className="adv-muscle-bar-fill" style={{ width: `${(m.volume / maxVol) * 100}%` }} />
                </div>
                <span className="adv-muscle-val">{m.volume.toLocaleString('es-AR')} kg</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <div className="section-title" style={{ marginBottom: 4 }}>Récords personales</div>
        <div className="sd-section-sub" style={{ marginBottom: 10 }}>1RM estimado (fórmula de Epley)</div>
        {records.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>Sin registros suficientes todavía.</p>
        ) : (
          records.map((r, i) => (
            <div key={i} className="adv-pr-row">
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 650, fontSize: 13.5 }}>{r.exerciseName}</div>
                <div className="muted" style={{ fontSize: 11.5 }}>{r.weightKg}kg × {r.reps} reps · {fmtLong(r.date)}</div>
              </div>
              <div className="adv-pr-value">{r.oneRm} kg</div>
            </div>
          ))
        )}
      </div>

      <style>{`
        .adv-layout { display: flex; flex-direction: column; gap: 20px; }
        .adv-muscle-list { display: flex; flex-direction: column; gap: 10px; }
        .adv-muscle-row { display: grid; grid-template-columns: 110px 1fr 76px; align-items: center; gap: 10px; }
        .adv-muscle-label { font-size: 12.5px; font-weight: 550; }
        .adv-muscle-bar-track { height: 8px; border-radius: 999px; background: var(--surface-elevated); overflow: hidden; }
        .adv-muscle-bar-fill { height: 100%; background: var(--accent); border-radius: 999px; }
        .adv-muscle-val { font-size: 12px; text-align: right; color: var(--text-tertiary); }
        .adv-pr-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 9px 0; border-bottom: 1px solid var(--border); }
        .adv-pr-row:last-child { border-bottom: none; }
        .adv-pr-value { font-size: 15px; font-weight: 700; flex-shrink: 0; }
      `}</style>
    </div>
  );
}
