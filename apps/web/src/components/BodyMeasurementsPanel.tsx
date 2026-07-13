import { useEffect, useMemo, useState } from 'react';
import type { BodyMeasurementRow } from '@reset-fitness/shared/types/database';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/useToast';

type MeasureKey =
  | 'weight_kg' | 'body_fat_pct' | 'lean_body_mass_kg'
  | 'neck_cm' | 'shoulder_cm' | 'chest_cm' | 'abdomen_cm' | 'waist_cm' | 'hips_cm'
  | 'left_bicep_cm' | 'right_bicep_cm' | 'left_forearm_cm' | 'right_forearm_cm'
  | 'left_thigh_cm' | 'right_thigh_cm' | 'left_calf_cm' | 'right_calf_cm';

interface Measure { key: MeasureKey; label: string; unit: string }

const MEASURES: Measure[] = [
  { key: 'weight_kg', label: 'Peso corporal', unit: 'kg' },
  { key: 'body_fat_pct', label: 'Grasa corporal', unit: '%' },
  { key: 'lean_body_mass_kg', label: 'Masa magra', unit: 'kg' },
  { key: 'neck_cm', label: 'Cuello', unit: 'cm' },
  { key: 'shoulder_cm', label: 'Hombro', unit: 'cm' },
  { key: 'chest_cm', label: 'Pecho', unit: 'cm' },
  { key: 'abdomen_cm', label: 'Abdomen', unit: 'cm' },
  { key: 'waist_cm', label: 'Cintura', unit: 'cm' },
  { key: 'hips_cm', label: 'Cadera', unit: 'cm' },
  { key: 'left_bicep_cm', label: 'Bícep izquierdo', unit: 'cm' },
  { key: 'right_bicep_cm', label: 'Bícep derecho', unit: 'cm' },
  { key: 'left_forearm_cm', label: 'Antebrazo izquierdo', unit: 'cm' },
  { key: 'right_forearm_cm', label: 'Antebrazo derecho', unit: 'cm' },
  { key: 'left_thigh_cm', label: 'Muslo izquierdo', unit: 'cm' },
  { key: 'right_thigh_cm', label: 'Muslo derecho', unit: 'cm' },
  { key: 'left_calf_cm', label: 'Gemelo izquierdo', unit: 'cm' },
  { key: 'right_calf_cm', label: 'Gemelo derecho', unit: 'cm' },
];

function parseIsoDateLocal(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function fmtDate(iso: string): string {
  return parseIsoDateLocal(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtDateShort(iso: string): string {
  return parseIsoDateLocal(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
}

interface Point { date: string; value: number }

/** Gráfico de línea con fecha en el tooltip, estilo Hevy. */
function MeasureLineChart({ points, unit }: { points: Point[]; unit: string }): React.JSX.Element {
  const [hover, setHover] = useState<number | null>(null);
  const W = 1000, H = 260, padT = 20, padB = 28, padL = 8, padR = 8;

  if (points.length === 0) {
    return <div style={{ height: H, display: 'flex', alignItems: 'center', justifyContent: 'center' }} className="muted">Sin registros para esta medida.</div>;
  }

  const vals = points.map((p) => p.value);
  let min = Math.min(...vals), max = Math.max(...vals);
  if (min === max) { min -= 1; max += 1; }
  const pad = (max - min) * 0.12;
  min -= pad; max += pad;

  const innerW = W - padL - padR;
  const step = points.length > 1 ? innerW / (points.length - 1) : 0;
  const x = (i: number) => padL + i * step;
  const y = (v: number) => padT + (1 - (v - min) / (max - min)) * (H - padT - padB);

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const hi = hover ?? points.length - 1;
  const hp = points[hi];
  const ttX = Math.max(70, Math.min(W - 70, x(hi)));

  const gridVals = [min + (max - min) * 0.25, (min + max) / 2, min + (max - min) * 0.75];
  const axisIdx = points.length <= 1 ? [0] : [0, Math.floor((points.length - 1) / 2), points.length - 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 260, display: 'block', overflow: 'visible' }} onMouseLeave={() => setHover(null)}>
      {gridVals.map((gv, i) => (
        <g key={i}>
          <line x1={padL} x2={W - padR} y1={y(gv)} y2={y(gv)} stroke="var(--border)" strokeWidth={1} strokeDasharray="4 4" />
          <text x={padL} y={y(gv) - 4} fontSize={11} fill="var(--text-tertiary)" fontFamily="inherit">{gv.toFixed(1)}</text>
        </g>
      ))}
      <path d={line} fill="none" stroke="var(--accent)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={i} cx={x(i)} cy={y(p.value)} r={i === hi ? 5 : 3} fill="#fff" stroke="var(--accent)" strokeWidth={2.2} />
      ))}
      {axisIdx.map((i) => (
        <text key={i} x={x(i)} y={H - 8} fontSize={11} textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'} fill="var(--text-tertiary)" fontFamily="inherit">
          {fmtDateShort(points[i].date)}
        </text>
      ))}
      {hp && (
        <>
          <line x1={x(hi)} x2={x(hi)} y1={padT} y2={H - padB} stroke="var(--accent)" strokeWidth={1.4} strokeDasharray="4 3" opacity={0.4} />
          <rect x={ttX - 66} y={y(hp.value) - 46} width={132} height={34} rx={7} fill="var(--text-primary)" />
          <text x={ttX} y={y(hp.value) - 30} textAnchor="middle" fontSize={12.5} fontWeight={700} fill="#fff" fontFamily="inherit">{hp.value} {unit}</text>
          <text x={ttX} y={y(hp.value) - 17} textAnchor="middle" fontSize={10.5} fill="rgba(255,255,255,0.7)" fontFamily="inherit">{fmtDate(hp.date)}</text>
        </>
      )}
      {points.map((_, i) => (
        <rect key={i} x={x(i) - step / 2} width={step || innerW} y={0} height={H} fill="transparent" onMouseEnter={() => setHover(i)} />
      ))}
    </svg>
  );
}

export function BodyMeasurementsPanel({ clientId }: { clientId: string }): React.JSX.Element {
  const { showToast } = useToast();
  const [rows, setRows] = useState<BodyMeasurementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<MeasureKey>('weight_kg');
  const [search, setSearch] = useState('');
  const [logOpen, setLogOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('body_measurements').select('*').eq('user_id', clientId).order('date', { ascending: true });
    setRows((data as BodyMeasurementRow[] | null) ?? []);
    setLoading(false);
  };
  useEffect(() => { void load(); }, [clientId]);

  const measure = MEASURES.find((m) => m.key === selected)!;
  const points = useMemo<Point[]>(
    () => rows.filter((r) => r[selected] != null).map((r) => ({ date: r.date, value: Number(r[selected]) })),
    [rows, selected],
  );
  const last = points.length ? points[points.length - 1].value : null;
  const filteredMeasures = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? MEASURES.filter((m) => m.label.toLowerCase().includes(q)) : MEASURES;
  }, [search]);

  const historyDesc = useMemo(() => [...points].reverse(), [points]);

  if (loading) return <div className="card"><p className="muted" style={{ margin: 0 }}>Cargando mediciones…</p></div>;

  return (
    <div className="bm-layout">
      {/* Lista de medidas */}
      <div className="card bm-list-card">
        <div className="search-field" style={{ marginBottom: 10, width: '100%' }}>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar medida…" />
        </div>
        <div className="bm-list">
          {filteredMeasures.map((m) => {
            const has = rows.some((r) => r[m.key] != null);
            return (
              <button key={m.key} type="button" className={`bm-list-item${selected === m.key ? ' active' : ''}`} onClick={() => setSelected(m.key)}>
                <span>{m.label}</span>
                {!has && <span className="bm-empty-dot" title="Sin registros" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Gráfico + historial */}
      <div style={{ minWidth: 0 }}>
        <div className="card">
          <div className="bm-chart-head">
            <div>
              <div className="section-title" style={{ margin: 0 }}>{measure.label}</div>
              {last != null ? (
                <div style={{ marginTop: 2 }}>
                  <span className="muted" style={{ fontSize: 12 }}>Último</span>
                  <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>{last} <span style={{ fontSize: 15, color: 'var(--text-tertiary)' }}>{measure.unit}</span></div>
                </div>
              ) : <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>Sin registros todavía</div>}
            </div>
            <button type="button" className="btn primary sm" onClick={() => setLogOpen(true)}>+ Registrar medición</button>
          </div>
          <MeasureLineChart points={points} unit={measure.unit} />
        </div>

        <div className="card">
          <div className="section-title" style={{ marginBottom: 10 }}>Historial</div>
          {historyDesc.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>Sin registros de {measure.label.toLowerCase()}.</p>
          ) : (
            <table className="bm-history">
              <tbody>
                {historyDesc.map((p) => (
                  <tr key={p.date}>
                    <td>{fmtDate(p.date)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 650 }}>{p.value} {measure.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {logOpen && (
        <LogMeasurementModal clientId={clientId} onClose={() => setLogOpen(false)} onSaved={() => { setLogOpen(false); void load(); showToast('success', 'Medición registrada.'); }} />
      )}

      <style>{`
        .bm-layout { display: grid; grid-template-columns: 260px minmax(0, 1fr); gap: 20px; align-items: start; }
        @media (max-width: 900px) { .bm-layout { grid-template-columns: 1fr; } }
        .bm-list-card { position: sticky; top: 12px; }
        .bm-list { display: flex; flex-direction: column; max-height: 520px; overflow-y: auto; }
        .bm-list-item { display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; text-align: left; background: none; border: none; cursor: pointer; padding: 9px 10px; border-radius: 9px; font-size: 13px; font-weight: 550; color: var(--text-secondary); }
        .bm-list-item:hover { background: var(--surface-elevated); color: var(--text-primary); }
        .bm-list-item.active { background: var(--accent-soft); color: var(--accent-text); font-weight: 650; }
        .bm-empty-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--border-strong); flex-shrink: 0; }
        .bm-chart-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
        .bm-history { width: 100%; border-collapse: collapse; }
        .bm-history td { padding: 9px 2px; border-bottom: 1px solid var(--border); font-size: 13px; }
        .bm-history tr:last-child td { border-bottom: none; }
      `}</style>
    </div>
  );
}

function LogMeasurementModal({ clientId, onClose, onSaved }: { clientId: string; onClose: () => void; onSaved: () => void }): React.JSX.Element {
  const { showToast } = useToast();
  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const [date, setDate] = useState(todayIso);
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const numbers: Partial<Record<MeasureKey, number>> = {};
    let any = false;
    for (const m of MEASURES) {
      const v = values[m.key];
      if (v != null && v.trim() !== '') { numbers[m.key] = Number(v); any = true; }
    }
    if (!any) { showToast('error', 'Cargá al menos una medida.'); return; }
    setSaving(true);
    const payload = { user_id: clientId, date, ...numbers };
    const { error } = await supabase.from('body_measurements').upsert(payload, { onConflict: 'user_id,date' });
    setSaving(false);
    if (error) { showToast('error', 'No pudimos guardar la medición.'); return; }
    onSaved();
  };

  return (
    <div className="invite-qr-backdrop" onClick={onClose}>
      <div className="assign-program-modal" style={{ width: 'min(560px, 94vw)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 17 }}>Registrar medición</div>
          <button type="button" className="btn secondary sm" onClick={onClose}>✕</button>
        </div>
        <div className="field" style={{ marginBottom: 14 }}>
          <label>Fecha</label>
          <input type="date" className="inline-select" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: '100%' }} />
        </div>
        <div className="bm-log-grid">
          {MEASURES.map((m) => (
            <div key={m.key} className="field">
              <label>{m.label} <span className="muted">({m.unit})</span></label>
              <input
                className="inline-select" inputMode="decimal" placeholder="—"
                value={values[m.key] ?? ''}
                onChange={(e) => setValues((prev) => ({ ...prev, [m.key]: e.target.value }))}
              />
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
          <button type="button" className="btn secondary" onClick={onClose}>Cancelar</button>
          <button type="button" className="btn primary" disabled={saving} onClick={() => void save()}>{saving ? 'Guardando…' : 'Guardar'}</button>
        </div>
        <style>{`
          .bm-log-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 14px; max-height: 48vh; overflow-y: auto; }
          .bm-log-grid .field label { font-size: 12px; }
          @media (max-width: 560px) { .bm-log-grid { grid-template-columns: 1fr; } }
        `}</style>
      </div>
    </div>
  );
}
