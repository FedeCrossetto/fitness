import { useEffect, useMemo, useState } from 'react';
import type { BodyMeasurementRow, ProgressPhotoRow, WorkoutLogRow } from '@reset-fitness/shared/types/database';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';

// ── date helpers (local, no UTC shift) ──
function parseIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function mondayOf(d: Date): Date {
  const x = new Date(d);
  const dow = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - dow);
  x.setHours(0, 0, 0, 0);
  return x;
}
function fmtShort(d: Date): string {
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
}
function fmtLong(iso: string): string {
  return parseIso(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });
}

interface Bucket { start: Date; label: string; count: number; volume: number; sets: number; durationSum: number }

// ── SVG bar chart with hover tooltip ──
function BarChart({ bars, unit, fmt }: { bars: { label: string; value: number; detail: string }[]; unit: string; fmt?: (v: number) => string }): React.JSX.Element {
  const [hover, setHover] = useState<number | null>(null);
  const W = 520, H = 150, padB = 4, padT = 16;
  const max = Math.max(...bars.map((b) => b.value), 1);
  const n = bars.length;
  const bw = (W / n) * 0.62;
  const gap = (W / n) * 0.38;
  const barX = (i: number) => i * (W / n) + gap / 2;
  const barH = (v: number) => (v / max) * (H - padT - padB);
  const hi = hover;

  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 150, display: 'block', overflow: 'visible' }} onMouseLeave={() => setHover(null)}>
        {bars.map((b, i) => {
          const h = barH(b.value);
          const isMax = b.value === max && b.value > 0;
          return (
            <g key={i} onMouseEnter={() => setHover(i)}>
              <rect x={barX(i)} y={H - padB - h} width={bw} height={Math.max(h, b.value > 0 ? 2 : 0)} rx={3}
                fill={hi === i ? 'var(--accent-hover)' : isMax ? 'var(--accent)' : 'var(--accent-soft)'}
                stroke={isMax || hi === i ? 'none' : 'var(--accent)'} strokeOpacity={0.25} />
              <rect x={i * (W / n)} y={0} width={W / n} height={H} fill="transparent" />
            </g>
          );
        })}
      </svg>
      {hi != null && bars[hi] && (
        <div style={{ position: 'absolute', top: -6, left: `${((hi + 0.5) / n) * 100}%`, pointerEvents: 'none' }}>
          <div style={{ transform: 'translateX(-50%)', background: 'var(--text-primary)', color: '#fff', borderRadius: 8, padding: '6px 9px', fontSize: 11.5, whiteSpace: 'nowrap', boxShadow: 'var(--shadow)' }}>
            <div style={{ fontWeight: 700 }}>{fmt ? fmt(bars[hi].value) : `${bars[hi].value} ${unit}`}</div>
            <div style={{ opacity: 0.7, fontSize: 10.5 }}>{bars[hi].detail}</div>
          </div>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 10.5, color: 'var(--text-tertiary)' }}>
        <span>{bars[0]?.label}</span>
        <span>{bars[Math.floor(n / 2)]?.label}</span>
        <span>{bars[n - 1]?.label}</span>
      </div>
    </div>
  );
}

// ── weight line with dated tooltip ──
function WeightLine({ points }: { points: { date: string; value: number }[] }): React.JSX.Element {
  const [hover, setHover] = useState<number | null>(null);
  const W = 520, H = 150, padT = 18, padB = 22, padL = 4, padR = 4;
  if (points.length === 0) return <div className="muted" style={{ height: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>Sin registros de peso.</div>;
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
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 150, display: 'block', overflow: 'visible' }} onMouseLeave={() => setHover(null)}>
      <path d={line} fill="none" stroke="var(--accent)" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => <circle key={i} cx={x(i)} cy={y(p.value)} r={i === hi ? 4.5 : 2.6} fill="#fff" stroke="var(--accent)" strokeWidth={2} />)}
      {hp && (
        <>
          <rect x={ttX - 60} y={y(hp.value) - 44} width={120} height={32} rx={7} fill="var(--text-primary)" />
          <text x={ttX} y={y(hp.value) - 29} textAnchor="middle" fontSize={12} fontWeight={700} fill="#fff" fontFamily="inherit">{hp.value} kg</text>
          <text x={ttX} y={y(hp.value) - 17} textAnchor="middle" fontSize={10} fill="rgba(255,255,255,0.7)" fontFamily="inherit">{fmtLong(hp.date)}</text>
        </>
      )}
      {points.map((_, i) => <rect key={i} x={x(i) - step / 2} width={step || iw} y={0} height={H} fill="transparent" onMouseEnter={() => setHover(i)} />)}
    </svg>
  );
}

// ── month calendar highlighting trained days ──
function TrainingCalendar({ trainedDates }: { trainedDates: Set<string> }): React.JSX.Element {
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const year = month.getFullYear(), m = month.getMonth();
  const first = new Date(year, m, 1);
  const startPad = (first.getDay() + 6) % 7;
  const days = new Date(year, m + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(startPad).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  const todayIso = toIso(new Date());
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <button type="button" className="cal-nav" onClick={() => setMonth(new Date(year, m - 1, 1))}>‹</button>
        <span style={{ fontWeight: 650, fontSize: 13, textTransform: 'capitalize' }}>{month.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}</span>
        <button type="button" className="cal-nav" onClick={() => setMonth(new Date(year, m + 1, 1))}>›</button>
      </div>
      <div className="cal-grid cal-week">{['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => <span key={i}>{d}</span>)}</div>
      <div className="cal-grid">
        {cells.map((c, i) => {
          if (c === null) return <span key={i} />;
          const iso = toIso(new Date(year, m, c));
          const trained = trainedDates.has(iso);
          const isToday = iso === todayIso;
          return <span key={i} className={`cal-day${trained ? ' trained' : ''}${isToday ? ' today' : ''}`}>{c}</span>;
        })}
      </div>
    </div>
  );
}

interface ConsultationEntry { label: string; answer: string | string[] }
interface ConsultationLike { submitted_at: string; responses: ConsultationEntry[] }

interface Props {
  clientId: string;
  goal: string | null;
  phone: string | null;
  createdAt: string;
  level: string | null;
  planWeek: number | null;
  planName: string | null;
  expiresAt: string | null;
  subLabel: string | null;
  consultation: ConsultationLike | null | false;
  onOpenTab: (tab: string) => void;
}

export function ClientOverview({ clientId, goal, phone, createdAt, level, planWeek, planName, expiresAt, subLabel, consultation, onOpenTab }: Props): React.JSX.Element {
  const { profile: trainer } = useAuth();
  const { showToast } = useToast();
  const [logs, setLogs] = useState<WorkoutLogRow[]>([]);
  const [measures, setMeasures] = useState<BodyMeasurementRow[]>([]);
  const [photos, setPhotos] = useState<ProgressPhotoRow[]>([]);
  const [email, setEmail] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [notesLoaded, setNotesLoaded] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  useEffect(() => {
    void (async () => {
      const since = toIso(new Date(Date.now() - 130 * 86400000));
      const [{ data: logRows }, { data: mRows }, { data: pRows }, { data: emailData }, { data: noteRow }] = await Promise.all([
        supabase.from('workout_logs').select('*').eq('user_id', clientId).gte('date', since).order('date', { ascending: true }),
        supabase.from('body_measurements').select('*').eq('user_id', clientId).order('date', { ascending: true }),
        supabase.from('progress_photos').select('*').eq('user_id', clientId).order('created_at', { ascending: false }).limit(5),
        supabase.rpc('get_client_email', { p_client: clientId }),
        supabase.from('client_coach_notes').select('notes').eq('client_id', clientId).maybeSingle(),
      ]);
      setLogs((logRows as WorkoutLogRow[] | null) ?? []);
      setMeasures((mRows as BodyMeasurementRow[] | null) ?? []);
      setPhotos((pRows as ProgressPhotoRow[] | null) ?? []);
      setEmail((emailData as string | null) ?? null);
      const n = (noteRow as { notes: string | null } | null)?.notes ?? '';
      setNotes(n); setNotesLoaded(n);
    })();
  }, [clientId]);

  // Últimas 17 semanas.
  const buckets = useMemo<Bucket[]>(() => {
    const weeks = 17;
    const start = mondayOf(new Date());
    const list: Bucket[] = [];
    const byKey = new Map<string, Bucket>();
    for (let i = weeks - 1; i >= 0; i--) {
      const s = new Date(start); s.setDate(s.getDate() - i * 7);
      const b: Bucket = { start: s, label: fmtShort(s), count: 0, volume: 0, sets: 0, durationSum: 0 };
      byKey.set(toIso(s), b); list.push(b);
    }
    for (const l of logs) {
      const b = byKey.get(toIso(mondayOf(parseIso(l.date))));
      if (!b) continue;
      b.count += 1;
      b.volume += Number(l.total_volume_kg ?? 0);
      b.sets += l.completed_sets ?? 0;
      b.durationSum += (l.duration_seconds ? Math.round(l.duration_seconds / 60) : l.duration_min ?? 0);
    }
    return list;
  }, [logs]);

  const volumeBars = buckets.map((b) => ({ label: b.label, value: Math.round(b.volume), detail: `Semana del ${fmtShort(b.start)}` }));
  const setBars = buckets.map((b) => ({ label: b.label, value: b.sets, detail: `Semana del ${fmtShort(b.start)}` }));
  const durationBars = buckets.map((b) => ({ label: b.label, value: b.count ? Math.round(b.durationSum / b.count) : 0, detail: `${b.count} entreno${b.count === 1 ? '' : 's'}` }));
  const weightPoints = useMemo(() => measures.filter((r) => r.weight_kg != null).map((r) => ({ date: r.date, value: Number(r.weight_kg) })), [measures]);
  const trainedDates = useMemo(() => new Set(logs.map((l) => l.date)), [logs]);

  const activities = useMemo(() => {
    const items: { date: string; icon: string; text: string }[] = [];
    for (const l of logs.slice(-8)) items.push({ date: l.date, icon: '🏋️', text: `Completó ${l.workout_name}` });
    for (const mrow of measures.slice(-6)) if (mrow.weight_kg != null) items.push({ date: mrow.date, icon: '⚖️', text: `Registró peso: ${mrow.weight_kg} kg` });
    for (const p of photos) items.push({ date: (p.recorded_at ?? p.created_at).slice(0, 10), icon: '📸', text: 'Subió una foto de progreso' });
    return items.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 9);
  }, [logs, measures, photos]);

  const saveNotes = async () => {
    if (notes === notesLoaded || !trainer?.id) return;
    setSavingNotes(true);
    const { error } = await supabase.from('client_coach_notes').upsert({ client_id: clientId, trainer_id: trainer.id, notes, updated_at: new Date().toISOString() }, { onConflict: 'client_id' });
    setSavingNotes(false);
    if (error) { showToast('error', 'No pudimos guardar la nota.'); return; }
    setNotesLoaded(notes);
    showToast('success', 'Nota guardada.');
  };

  const waLink = phone ? `https://wa.me/${phone.replace(/\D/g, '')}` : null;

  return (
    <div className="ov-layout">
      <div className="ov-main">
        {/* Info del cliente */}
        <div className="card">
          <div className="section-title" style={{ marginBottom: 12 }}>Información del cliente</div>
          <div className="ov-info-grid">
            <Info label="Objetivo" value={goal ?? '—'} />
            <Info label="Nivel" value={level ?? '—'} />
            <Info label="Cliente desde" value={fmtLong(createdAt.slice(0, 10))} />
            <Info label="Semana del plan" value={planWeek ? `Semana ${planWeek}` : '—'} />
            <Info label="Plan" value={planName ?? '—'} />
            <Info label="Vence" value={expiresAt ? fmtLong(expiresAt.slice(0, 10)) : (subLabel ?? '—')} />
            <Info label="Teléfono" value={phone ?? '—'} href={waLink ?? undefined} hrefLabel={phone ? `${phone} · WhatsApp` : undefined} />
            <Info label="Email" value={email ?? '—'} href={email ? `mailto:${email}` : undefined} />
          </div>
        </div>

        {/* Statistics */}
        <div className="card">
          <div className="section-title" style={{ marginBottom: 4 }}>Estadísticas</div>
          <div className="sd-section-sub" style={{ marginBottom: 16 }}>Últimos 4 meses</div>
          <div className="ov-stats-grid">
            <Stat title="Volumen por semana">
              <BarChart bars={volumeBars} unit="kg" fmt={(v) => `${v.toLocaleString('es-AR')} kg`} />
            </Stat>
            <Stat title="Sets por semana">
              <BarChart bars={setBars} unit="sets" fmt={(v) => `${v} sets`} />
            </Stat>
            <Stat title="Duración promedio por semana">
              <BarChart bars={durationBars} unit="min" fmt={(v) => `${v} min`} />
            </Stat>
            <Stat title="Peso corporal">
              <WeightLine points={weightPoints} />
            </Stat>
          </div>
          <div style={{ marginTop: 18, maxWidth: 320 }}>
            <div className="ov-stat-title">Entrenamientos del mes</div>
            <TrainingCalendar trainedDates={trainedDates} />
          </div>
        </div>

        {/* Notas */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <div className="section-title" style={{ margin: 0 }}>Notas</div>
            <span className="ov-note-hint" title="Estas notas son privadas del coach — el alumno no las ve.">ⓘ</span>
          </div>
          <div className="sd-section-sub" style={{ marginBottom: 10 }}>Privadas — no visibles para el alumno</div>
          <textarea
            className="hevy-input" rows={4} placeholder='Ej: "Tiene molestia en la rodilla derecha, cuidar sentadillas."'
            value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => void saveNotes()}
          />
          {notes !== notesLoaded && (
            <div style={{ marginTop: 8, textAlign: 'right' }}>
              <button type="button" className="btn primary sm" disabled={savingNotes} onClick={() => void saveNotes()}>{savingNotes ? 'Guardando…' : 'Guardar nota'}</button>
            </div>
          )}
        </div>
      </div>

      {/* Actividad reciente */}
      <div className="ov-side">
        <div className="card">
          <div className="section-title" style={{ marginBottom: 12 }}>Actividad reciente</div>
          {activities.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>Sin actividad todavía.</p>
          ) : (
            <div className="ov-activity">
              {activities.map((a, i) => (
                <div key={i} className="ov-activity-item">
                  <span className="ov-activity-icon" aria-hidden>{a.icon}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13 }}>{a.text}</div>
                    <div className="muted" style={{ fontSize: 11.5 }}>{fmtLong(a.date)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <button type="button" className="sd-panel-link" style={{ marginTop: 12 }} onClick={() => onOpenTab('entrenos')}>Ver entrenamientos →</button>
        </div>

        <ConsultationCarousel data={consultation} />
      </div>

      <style>{`
        .ov-layout { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 20px; align-items: start; }
        @media (max-width: 1040px) { .ov-layout { grid-template-columns: 1fr; } }
        .ov-main { min-width: 0; display: flex; flex-direction: column; gap: 0; }
        .ov-side { min-width: 0; }
        .ov-info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px 24px; }
        @media (max-width: 560px) { .ov-info-grid { grid-template-columns: 1fr; } }
        .ov-info-label { font-size: 11px; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.04em; }
        .ov-info-value { font-size: 14px; font-weight: 600; margin-top: 2px; word-break: break-word; }
        .ov-info-value a { color: var(--accent-text); }
        .ov-info-value a:hover { text-decoration: underline; }
        .ov-stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px 24px; }
        @media (max-width: 720px) { .ov-stats-grid { grid-template-columns: 1fr; } }
        .ov-stat-title { font-size: 12.5px; font-weight: 650; margin-bottom: 8px; }
        .ov-note-hint { display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px; border-radius: 50%; background: var(--surface-elevated); color: var(--text-tertiary); font-size: 10px; cursor: help; }
        .ov-activity { display: flex; flex-direction: column; }
        .ov-activity-item { display: flex; gap: 10px; padding: 9px 0; border-bottom: 1px solid var(--border); }
        .ov-activity-item:last-child { border-bottom: none; }
        .ov-activity-icon { font-size: 16px; flex-shrink: 0; }
        .cal-nav { background: none; border: none; cursor: pointer; font-size: 16px; color: var(--text-secondary); padding: 0 6px; }
        .cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px; }
        .cal-week { text-align: center; font-size: 10.5px; color: var(--text-tertiary); margin-bottom: 4px; }
        .cal-day { display: flex; align-items: center; justify-content: center; height: 30px; font-size: 12px; border-radius: 7px; color: var(--text-secondary); }
        .cal-day.trained { background: var(--accent); color: var(--accent-contrast); font-weight: 650; }
        .cal-day.today { box-shadow: inset 0 0 0 1.5px var(--accent); }
        .cal-day.trained.today { box-shadow: inset 0 0 0 1.5px var(--text-primary); }
        .ov-consult { margin-top: 14px; padding: 12px 14px; border: 1px solid var(--border); border-radius: var(--radius-sm); opacity: 0.82; }
        .ov-consult-head { display: flex; align-items: center; justify-content: space-between; font-size: 11px; font-weight: 650; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 8px; }
        .ov-consult-q { font-size: 11.5px; color: var(--text-tertiary); margin-bottom: 2px; }
        .ov-consult-a { font-size: 12.5px; color: var(--text-secondary); font-weight: 550; margin-bottom: 8px; min-height: 16px; }
        .ov-consult-nav { display: flex; align-items: center; justify-content: center; gap: 10px; }
        .ov-consult-nav button { background: none; border: none; cursor: pointer; font-size: 14px; color: var(--text-tertiary); padding: 0 4px; line-height: 1; }
        .ov-consult-nav button:hover:not(:disabled) { color: var(--text-primary); }
        .ov-consult-nav button:disabled { opacity: 0.3; cursor: default; }
      `}</style>
    </div>
  );
}

// Deliberadamente discreto: la consulta está disponible pero no debe competir
// visualmente con Actividad reciente — texto chico, borde tenue, un dato a la vez.
function ConsultationCarousel({ data }: { data: ConsultationLike | null | false }): React.JSX.Element {
  const [idx, setIdx] = useState(0);

  if (!data) {
    return (
      <div className="ov-consult">
        <div className="ov-consult-head">Consulta</div>
        <p className="muted" style={{ margin: 0, fontSize: 11.5 }}>El alumno todavía no completó el formulario.</p>
      </div>
    );
  }

  const entries = data.responses;
  const entry = entries[Math.min(idx, entries.length - 1)];
  const answerText = entry ? (Array.isArray(entry.answer) ? (entry.answer.join(', ') || '—') : (entry.answer || '—')) : '—';

  return (
    <div className="ov-consult">
      <div className="ov-consult-head">
        <span>Consulta</span>
        <span className="muted" style={{ fontSize: 10.5 }}>{fmtLong(data.submitted_at.slice(0, 10))}</span>
      </div>
      {entries.length === 0 ? (
        <p className="muted" style={{ margin: 0, fontSize: 11.5 }}>Sin respuestas.</p>
      ) : (
        <>
          <div className="ov-consult-q">{entry.label}</div>
          <div className="ov-consult-a">{answerText}</div>
          <div className="ov-consult-nav">
            <button type="button" onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0} aria-label="Anterior">‹</button>
            <span className="muted" style={{ fontSize: 10.5 }}>{idx + 1} / {entries.length}</span>
            <button type="button" onClick={() => setIdx((i) => Math.min(entries.length - 1, i + 1))} disabled={idx === entries.length - 1} aria-label="Siguiente">›</button>
          </div>
        </>
      )}
    </div>
  );
}

function Info({ label, value, href, hrefLabel }: { label: string; value: string; href?: string; hrefLabel?: string }): React.JSX.Element {
  return (
    <div>
      <div className="ov-info-label">{label}</div>
      <div className="ov-info-value">
        {href ? <a href={href} target="_blank" rel="noopener noreferrer">{hrefLabel ?? value}</a> : value}
      </div>
    </div>
  );
}

function Stat({ title, children }: { title: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div>
      <div className="ov-stat-title">{title}</div>
      {children}
    </div>
  );
}
