import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

// Bypass strict types for new tables
const anyClient = supabase as unknown as {
  from: (table: string) => ReturnType<typeof supabase.from>;
};
const waiverCfgTable  = () => anyClient.from('waiver_configs');

// ── Default waiver text ────────────────────────────────────────────────────────
const DEFAULT_BODY = `DESLINDE DE RESPONSABILIDAD Y ASUNCIÓN DE RIESGOS

Yo, el firmante, habiendo contratado los servicios de entrenamiento personal, declaro haber sido informado/a sobre los riesgos inherentes a la práctica de actividad física y el ejercicio físico, incluyendo pero no limitado a: lesiones musculares, articulares, cardíacas u otras lesiones físicas que pudieran ocurrir durante el entrenamiento.

ASUNCIÓN DE RIESGOS
Asumо plena responsabilidad por cualquier lesión o daño que pudiera sufrir durante la práctica de las actividades físicas y programas de entrenamiento proporcionados por mi entrenador personal.

DECLARACIÓN DE APTITUD FÍSICA
Declaro que me encuentro en condiciones de salud aptas para realizar actividad física, que no padezco ninguna condición médica que me impida realizarla, y que he informado a mi entrenador sobre cualquier limitación o condición preexistente relevante.

LIBERACIÓN DE RESPONSABILIDAD
Por medio de la presente, libero a mi entrenador personal, sus empleados, representantes y afiliados de cualquier responsabilidad civil por lesiones, daños, accidentes o pérdidas que pudieran ocurrir durante o como consecuencia directa de las sesiones de entrenamiento.

Al firmar este documento manifiesto que he leído, entendido y acepto en su totalidad el contenido de este deslinde de responsabilidad.`;

// ── Component ─────────────────────────────────────────────────────────────────

interface WaiverConfig {
  title: string;
  body: string;
  require_before_start: boolean;
}

export function WaiverSettingsPage(): React.JSX.Element {
  const { profile } = useAuth();
  const [config, setConfig] = useState<WaiverConfig>({
    title: 'Deslinde de Responsabilidad',
    body: DEFAULT_BODY,
    require_before_start: true,
  });
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [dbMissing, setDbMissing] = useState(false);
  const [preview, setPreview]   = useState(false);

  // Load existing config
  useEffect(() => {
    if (!profile?.id) return;
    let active = true;
    void (async () => {
      try {
        const { data, error } = await waiverCfgTable()
          .select('title, body, require_before_start')
          .eq('trainer_id', profile.id)
          .maybeSingle();
        if (!active) return;
        if (error?.message?.includes('does not exist')) {
          setDbMissing(true);
        } else if (data) {
          setConfig({
            title: (data as WaiverConfig).title,
            body: (data as WaiverConfig).body,
            require_before_start: (data as WaiverConfig).require_before_start,
          });
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [profile?.id]);

  const handleSave = async () => {
    if (!profile?.id || saving) return;
    setSaving(true);
    setSaved(false);
    const { error } = await waiverCfgTable().upsert({
      trainer_id: profile.id,
      title: config.title.trim(),
      body: config.body,
      require_before_start: config.require_before_start,
    }, { onConflict: 'trainer_id' });
    setSaving(false);
    if (!error) { setSaved(true); setTimeout(() => setSaved(false), 3000); }
  };

  return (
    <div>
      {/* Header */}
      <Link to="/settings" className="back-link">← Volver a Settings</Link>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="page-title" style={{ marginBottom: 4 }}>Deslinde de Responsabilidad</h1>
          <p className="page-sub" style={{ margin: 0 }}>
            Configurá el documento que tus alumnos firman digitalmente antes de comenzar.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn secondary" onClick={() => setPreview(true)}>
            Vista previa
          </button>
          <button className="btn" onClick={() => void handleSave()} disabled={saving || loading}>
            {saving ? 'Guardando…' : saved ? '✓ Guardado' : 'Guardar'}
          </button>
        </div>
      </div>

      {/* Migration banner */}
      {dbMissing && (
        <div className="card" style={{ background: '#fefce8', border: '1px solid #fde047', padding: '14px 18px', marginBottom: 20, borderRadius: 10 }}>
          <strong style={{ color: '#854d0e' }}>Tabla pendiente de migración</strong>
          <p style={{ margin: '6px 0 0', color: '#713f12', fontSize: 13 }}>
            Aplicá la migración <code>0017_waiver.sql</code> en tu proyecto de Supabase para habilitar esta funcionalidad.
          </p>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, marginTop: 20 }}>

        {/* Editor */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card" style={{ padding: '20px' }}>
            <label className="waiver-label">Título del documento</label>
            <input
              className="field-input"
              value={config.title}
              onChange={(e) => setConfig((c) => ({ ...c, title: e.target.value }))}
              style={{ marginBottom: 0 }}
            />
          </div>
          <div className="card" style={{ padding: '20px' }}>
            <label className="waiver-label">Cuerpo del documento</label>
            <textarea
              className="field-input waiver-textarea"
              value={config.body}
              onChange={(e) => setConfig((c) => ({ ...c, body: e.target.value }))}
              rows={22}
            />
          </div>
        </div>

        {/* Sidebar options */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card" style={{ padding: '20px' }}>
            <div className="waiver-label" style={{ marginBottom: 14 }}>Configuración</div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--text-primary)' }}>
                  Requerir antes de iniciar
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)', marginTop: 3 }}>
                  El alumno debe firmar antes de ver su plan
                </div>
              </div>
              <button
                className={`waiver-toggle${config.require_before_start ? ' on' : ''}`}
                onClick={() => setConfig((c) => ({ ...c, require_before_start: !c.require_before_start }))}
                aria-pressed={config.require_before_start}
              >
                <span className="waiver-toggle-thumb" />
              </button>
            </div>

            <div style={{ padding: '12px 14px', borderRadius: 8, background: 'var(--surface-elevated)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
                El alumno firma desde la app mobile. La firma queda guardada con fecha, nombre completo y trazado digital.
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: '20px' }}>
            <div className="waiver-label" style={{ marginBottom: 10 }}>¿Cómo funciona?</div>
            <ol style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                'El alumno abre la app mobile por primera vez.',
                'Aparece este deslinde para leer.',
                'Escribe su nombre y firma con el dedo.',
                'La firma queda guardada. Podés verla en el perfil del alumno.',
              ].map((step, i) => (
                <li key={i} style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>

      {/* Preview modal */}
      {preview && createPortal(
        <WaiverPreviewModal
          title={config.title}
          body={config.body}
          onClose={() => setPreview(false)}
        />,
        document.body
      )}

      <style>{`
        .waiver-label { display: block; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: .06em; color: var(--text-tertiary); margin-bottom: 10px; }
        .waiver-textarea { resize: vertical; font-family: 'Georgia', serif; font-size: 13.5px; line-height: 1.7; min-height: 420px; }
        .waiver-toggle {
          width: 44px; height: 24px; border-radius: 12px; border: none; cursor: pointer; position: relative;
          background: #cbd5e1; transition: background 200ms; flex-shrink: 0; padding: 0;
        }
        .waiver-toggle.on { background: #22c55e; }
        .waiver-toggle-thumb {
          display: block; width: 18px; height: 18px; border-radius: 50%;
          background: #fff; position: absolute; top: 3px; left: 3px;
          transition: transform 200ms; box-shadow: 0 1px 3px rgba(0,0,0,.25);
        }
        .waiver-toggle.on .waiver-toggle-thumb { transform: translateX(20px); }

        /* Preview modal */
        .wv-backdrop {
          position: fixed; inset: 0; z-index: 9999;
          background: rgba(0,0,0,.5); backdrop-filter: blur(4px);
          display: flex; align-items: center; justify-content: center; padding: 24px;
          animation: wv-fade-in 150ms ease;
        }
        .wv-modal {
          background: #fff; border-radius: 14px; width: 100%; max-width: 680px;
          max-height: 90vh; display: flex; flex-direction: column;
          box-shadow: 0 24px 80px rgba(0,0,0,.3);
          animation: wv-slide-up 200ms ease;
        }
        .wv-modal-head {
          display: flex; align-items: center; justify-content: space-between;
          padding: 18px 24px; border-bottom: 1px solid var(--border);
        }
        .wv-modal-body { flex: 1; overflow-y: auto; padding: 28px 32px; }
        .wv-modal-footer {
          padding: 16px 24px; border-top: 1px solid var(--border);
          display: flex; align-items: center; justify-content: space-between;
        }
        .wv-doc-title { font-size: 18px; font-weight: 700; text-align: center; margin-bottom: 24px; }
        .wv-doc-body { font-family: 'Georgia', serif; font-size: 14px; line-height: 1.8; white-space: pre-wrap; color: #1e293b; }
        .wv-sig-area {
          margin-top: 32px; border: 1.5px dashed #94a3b8; border-radius: 8px;
          padding: 20px; display: flex; align-items: center; justify-content: center;
          min-height: 100px; color: #94a3b8; font-size: 14px; text-align: center;
        }
        @keyframes wv-fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes wv-slide-up { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}

// ── Preview modal ─────────────────────────────────────────────────────────────

function WaiverPreviewModal({ title, body, onClose }: { title: string; body: string; onClose: () => void }): React.JSX.Element {
  const sigRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastPt  = useRef<{ x: number; y: number } | null>(null);
  const [hasSig, setHasSig] = useState(false);

  const getXY = (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } | null => {
    const canvas = sigRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      const t = e.touches[0];
      return t ? { x: t.clientX - rect.left, y: t.clientY - rect.top } : null;
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  };

  const onStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const pt = getXY(e);
    if (!pt) return;
    drawing.current = true;
    lastPt.current = pt;
    const ctx = sigRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(pt.x, pt.y);
  };

  const onMove = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!drawing.current) return;
    const pt = getXY(e);
    if (!pt) return;
    const ctx = sigRef.current?.getContext('2d');
    if (!ctx || !lastPt.current) return;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1e293b';
    ctx.quadraticCurveTo(lastPt.current.x, lastPt.current.y, pt.x, pt.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(pt.x, pt.y);
    lastPt.current = pt;
    setHasSig(true);
  };

  const onEnd = () => { drawing.current = false; lastPt.current = null; };

  const clearSig = () => {
    const canvas = sigRef.current;
    if (!canvas) return;
    canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    setHasSig(false);
  };

  return (
    <div className="wv-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="wv-modal">
        <div className="wv-modal-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', padding: '3px 8px', borderRadius: 4, background: '#f1f5f9', color: '#64748b' }}>
              Vista previa
            </span>
            <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
              Así verá el alumno el documento
            </span>
          </div>
          <button
            onClick={onClose}
            style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-elevated)', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            ✕
          </button>
        </div>

        <div className="wv-modal-body">
          <div className="wv-doc-title">{title || 'Deslinde de Responsabilidad'}</div>
          <div className="wv-doc-body">{body}</div>

          <div style={{ marginTop: 32, borderTop: '1px solid var(--border)', paddingTop: 24 }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>Nombre completo</div>
            <input className="field-input" placeholder="Tu nombre completo" style={{ marginBottom: 20 }} />

            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>Firma digital</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)', marginBottom: 10 }}>
              Dibujá tu firma con el mouse o el dedo
            </div>
            <canvas
              ref={sigRef}
              width={580}
              height={120}
              style={{ width: '100%', height: 120, border: '1.5px solid #cbd5e1', borderRadius: 8, background: '#f8fafc', cursor: 'crosshair', touchAction: 'none' }}
              onMouseDown={onStart}
              onMouseMove={onMove}
              onMouseUp={onEnd}
              onMouseLeave={onEnd}
              onTouchStart={onStart}
              onTouchMove={onMove}
              onTouchEnd={onEnd}
            />
            {hasSig && (
              <button onClick={clearSig} style={{ marginTop: 8, fontSize: 12.5, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                Limpiar firma
              </button>
            )}
          </div>
        </div>

        <div className="wv-modal-footer">
          <span style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>
            Esta es una vista previa. La firma real se guarda en la app mobile.
          </span>
          <button className="btn secondary" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
