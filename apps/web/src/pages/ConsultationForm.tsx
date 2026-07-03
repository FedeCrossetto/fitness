import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from '@/hooks/useTranslation';
import type { PlanType } from '@reset-fitness/shared/types/database';

// ── Default form ──────────────────────────────────────────────────────────────

const DEFAULT_FORM = `[listbox text='¿Cuáles son tus metas de entrenamiento?']
[value text='Apariencia (estética)']
[value text='Resistencia cardiovascular']
[value text='Flexibilidad']
[value text='Salud (General)']
[value text='Definición muscular']
[value text='Tamaño muscular']
[value text='Fuerza/potencia muscular']
[value text='Autoestima o confianza']
[value text='Destreza']
[value text='Rendimiento deportivo']
[value text='Reducción del estrés']
[value text='Tonificación y modelado']
[value text='Pérdida de peso']
[value text='Postura']
[/listbox]

[textbox text='Otras metas de entrenamiento (si no están seleccionadas arriba)']

[dropdown text='¿Hacés ejercicio regularmente?']
[value text='--']
[value text='Nunca hice ejercicio regularmente']
[value text='Solía hacer ejercicio regularmente']
[value text='Actualmente hago ejercicio regularmente']
[/dropdown]

[dropdown text='Calificá tu habilidad para realizar ejercicios de cardio']
[value text='--']
[value text='Muy baja']
[value text='Aceptable']
[value text='Promedio']
[value text='Buena']
[value text='Excelente']
[/dropdown]

[dropdown text='Calificá tu experiencia con el ejercicio']
[value text='--']
[value text='Principiante']
[value text='Intermedio']
[value text='Avanzado']
[/dropdown]

[listbox text='¿A qué equipamiento tenés acceso?']
[value text='Pesas (mancuernas/barra)']
[value text='Máquinas de gimnasio']
[value text='Bandas de resistencia']
[value text='Pelotas Bosu']
[value text='Kettlebells']
[value text='Bandas TRX']
[/listbox]

[textbox text='Otros equipamientos para entrenar']

[listbox text='¿Qué días estás disponible para entrenar?']
[value text='Domingo']
[value text='Lunes']
[value text='Martes']
[value text='Miércoles']
[value text='Jueves']
[value text='Viernes']
[value text='Sábado']
[/listbox]

[dropdown text='¿Con qué frecuencia tenés tiempo para ejercitarte?']
[value text='--']
[value text='1-3 días a la semana']
[value text='4-5 días a la semana']
[value text='6-7 días a la semana']
[value text='A decisión del entrenador']
[/dropdown]

[textarea text='¿Tenés alguna lesión o condición existente que deba tener en cuenta al armar tu plan de entrenamiento?']

[dropdown text='¿Fumás productos de tabaco?']
[value text='--']
[value text='No']
[value text='Sí']
[/dropdown]

[textarea text='¿Algún otro comentario sobre lo que te gustaría ver en tu plan de entrenamiento?']`;

// ── Parser ────────────────────────────────────────────────────────────────────

type FormField =
  | { type: 'listbox';  label: string; options: string[] }
  | { type: 'dropdown'; label: string; options: string[] }
  | { type: 'textbox';  label: string }
  | { type: 'textarea'; label: string }
  | { type: 'error';    raw: string };

function parseForm(code: string): FormField[] {
  const fields: FormField[] = [];
  const lines = code.split('\n').map((l) => l.trim()).filter(Boolean);
  let i = 0;

  const attr = (line: string, tag: string): string => {
    const m = line.match(/text=['"]([^'"]*)['"]/);
    return m?.[1] ?? tag;
  };

  while (i < lines.length) {
    const line = lines[i]!;

    if (/^\[listbox /i.test(line)) {
      const label = attr(line, 'Lista');
      const options: string[] = [];
      i++;
      while (i < lines.length && !/^\[\/listbox\]/i.test(lines[i]!)) {
        if (/^\[value /i.test(lines[i]!)) options.push(attr(lines[i]!, ''));
        i++;
      }
      fields.push({ type: 'listbox', label, options });

    } else if (/^\[dropdown /i.test(line)) {
      const label = attr(line, 'Dropdown');
      const options: string[] = [];
      i++;
      while (i < lines.length && !/^\[\/dropdown\]/i.test(lines[i]!)) {
        if (/^\[value /i.test(lines[i]!)) options.push(attr(lines[i]!, ''));
        i++;
      }
      fields.push({ type: 'dropdown', label, options });

    } else if (/^\[textbox /i.test(line)) {
      fields.push({ type: 'textbox', label: attr(line, 'Texto') });

    } else if (/^\[textarea /i.test(line)) {
      fields.push({ type: 'textarea', label: attr(line, 'Comentario') });
    }

    i++;
  }
  return fields;
}

const KNOWN_TAGS = /^\[(\/?listbox|\/?dropdown|value|textbox|textarea|p)\b/i;

/** Validador mínimo de sintaxis del DSL — no es código ejecutable, así que
 * "compilar" acá significa: tags conocidos y bien cerrados. Devuelve un
 * mensaje de error (para bloquear "Guardar") o null si está todo bien. */
function validateForm(code: string): string | null {
  const lines = code.split('\n').map((l) => l.trim()).filter(Boolean);
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;

    const isListbox = /^\[listbox /i.test(line);
    const isDropdown = /^\[dropdown /i.test(line);
    if (isListbox || isDropdown) {
      const closeRe = isListbox ? /^\[\/listbox\]/i : /^\[\/dropdown\]/i;
      const closeTag = isListbox ? '[/listbox]' : '[/dropdown]';
      let j = i + 1;
      let closed = false;
      while (j < lines.length) {
        if (closeRe.test(lines[j]!)) { closed = true; break; }
        if (/^\[(listbox|dropdown|textbox|textarea|p) /i.test(lines[j]!)) break;
        if (!/^\[value /i.test(lines[j]!)) {
          return `Línea "${lines[j]}" no es válida dentro de ${line} (solo se admiten [value text='...']).`;
        }
        j++;
      }
      if (!closed) {
        return `Falta el cierre ${closeTag} para "${line}".`;
      }
      i = j + 1;
      continue;
    }

    if (line.startsWith('[') && !KNOWN_TAGS.test(line)) {
      return `Tag desconocido: "${line}".`;
    }

    i++;
  }
  return null;
}

// ── Preview renderer ──────────────────────────────────────────────────────────

function FormPreview({ fields }: { fields: FormField[] }): React.JSX.Element {
  if (fields.length === 0) {
    return <p style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>Sin campos para previsualizar.</p>;
  }
  return (
    <div className="cf-preview-body">
      {fields.map((f, idx) => {
        if (f.type === 'listbox') return (
          <div key={idx} className="cf-field">
            <div className="cf-label">{f.label}</div>
            <div className="cf-checkgroup">
              {f.options.map((opt) => (
                <label key={opt} className="cf-check-row">
                  <input type="checkbox" readOnly />
                  <span>{opt}</span>
                </label>
              ))}
            </div>
          </div>
        );
        if (f.type === 'dropdown') return (
          <div key={idx} className="cf-field">
            <div className="cf-label">{f.label}</div>
            <select className="cf-select" defaultValue="">
              {f.options.map((opt) => <option key={opt}>{opt}</option>)}
            </select>
          </div>
        );
        if (f.type === 'textbox') return (
          <div key={idx} className="cf-field">
            <div className="cf-label">{f.label}</div>
            <input className="cf-input" type="text" readOnly placeholder="Respuesta…" />
          </div>
        );
        if (f.type === 'textarea') return (
          <div key={idx} className="cf-field">
            <div className="cf-label">{f.label}</div>
            <textarea className="cf-textarea" readOnly rows={3} placeholder="Respuesta…" />
          </div>
        );
        return null;
      })}
    </div>
  );
}

// ── Code reference sidebar ────────────────────────────────────────────────────

const CODE_REF = [
  { tag: '[p text=\'Párrafo informativo\']',                            desc: 'Texto libre' },
  { tag: '[textbox text=\'Pregunta\']',                                 desc: 'Campo de texto corto' },
  { tag: '[textarea text=\'Pregunta\']',                                desc: 'Campo de texto largo' },
  { tag: '[listbox text=\'Pregunta\']\n[value text=\'Opción\']\n[/listbox]', desc: 'Selección múltiple' },
  { tag: '[dropdown text=\'Pregunta\']\n[value text=\'Opción\']\n[/dropdown]', desc: 'Desplegable' },
];

// ── Page ──────────────────────────────────────────────────────────────────────

const cfTable = () => supabase.from('consultation_form_configs');

const PLAN_TITLES: Record<PlanType, string> = {
  mentoria: 'Mentoría 1 a 1',
  base: 'Plan Base',
};

export function ConsultationFormPage(): React.JSX.Element {
  const { session } = useAuth();
  const { t } = useTranslation();
  const { planType: planTypeParam } = useParams<{ planType: string }>();
  const planType: PlanType = planTypeParam === 'mentoria' ? 'mentoria' : 'base';
  const trainerId = session?.user.id;

  const [code, setCode]     = useState(DEFAULT_FORM);
  const [saved, setSaved]   = useState(DEFAULT_FORM);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [recordId, setRecordId] = useState<string | null>(null);
  const [dbMissing, setDbMissing] = useState(false);

  const dirty = code !== saved;
  const validationError = useMemo(() => validateForm(code), [code]);

  useEffect(() => {
    if (!trainerId) return;
    setLoading(true);
    setRecordId(null);
    void (async () => {
      const { data, error } = await cfTable()
        .select('id, form_code')
        .eq('trainer_id', trainerId)
        .eq('plan_type', planType)
        .maybeSingle() as { data: { id: string; form_code: string } | null; error: { code?: string } | null };

      if (error) { setDbMissing(true); setLoading(false); return; }
      if (data) {
        setCode(data.form_code); setSaved(data.form_code); setRecordId(data.id);
      } else {
        setCode(DEFAULT_FORM); setSaved(DEFAULT_FORM);
      }
      setLoading(false);
    })();
  }, [trainerId, planType]);

  const handleSave = async () => {
    if (!trainerId || validationError) return;
    setSaving(true);
    if (recordId) {
      await cfTable().update({ form_code: code }).eq('id', recordId);
    } else {
      const { data } = await cfTable()
        .insert({ trainer_id: trainerId, plan_type: planType, form_code: code })
        .select('id').single() as { data: { id: string } | null };
      if (data) setRecordId(data.id);
    }
    setSaved(code);
    setSaving(false);
  };

  const fields = useMemo(() => parseForm(code), [code]);

  return (
    <div>
      <Link to="/settings/forms" className="back-link">← {t.web.back_to_forms}</Link>
      <div className="cf-page-header">
        <div>
          <h1 className="page-title">Formulario — {PLAN_TITLES[planType]}</h1>
          <p className="page-sub">
            Este formulario se envía a tus alumnos para conocer sus metas, historial y disponibilidad.
          </p>
        </div>
        <div className="cf-header-actions">
          <button className="btn secondary" onClick={() => setShowPreview(true)}>
            Previsualizar
          </button>
          <button className="btn primary" onClick={() => void handleSave()} disabled={saving || !dirty || !!validationError}>
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>

      {dbMissing && (
        <div className="cf-banner">
          ⚠️ &nbsp; Ejecutá <code>supabase/migrations/0064_consultation_form_per_plan_type.sql</code> para habilitar el guardado.
        </div>
      )}

      {validationError && (
        <div className="cf-banner cf-banner-error">
          ⚠️ &nbsp; {validationError}
        </div>
      )}

      <div className="cf-layout">
        {/* Editor */}
        <div className="cf-editor-wrap">
          <div className="cf-editor-header">
            <span className="cf-editor-title">Código del formulario</span>
            {dirty && <span className="cf-dirty-dot" title="Cambios sin guardar" />}
          </div>
          {loading ? (
            <div className="cf-loading">Cargando…</div>
          ) : (
            <textarea
              className="cf-editor"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              spellCheck={false}
              rows={30}
            />
          )}
        </div>

        {/* Reference */}
        <div className="cf-ref-panel">
          <div className="cf-ref-title">CÓDIGOS DISPONIBLES</div>
          {CODE_REF.map((r) => (
            <div key={r.tag} className="cf-ref-item">
              <pre className="cf-ref-code">{r.tag}</pre>
              <span className="cf-ref-desc">{r.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Preview modal — rendered via portal so it's always on top */}
      {showPreview && createPortal(
        <div
          className="cf-portal-overlay"
          onClick={() => setShowPreview(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Previsualización del formulario"
        >
          <div className="cf-preview-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cf-preview-header">
              <div className="cf-preview-header-left">
                <div className="cf-preview-badge">Vista previa</div>
                <span className="cf-preview-title">Formulario — {PLAN_TITLES[planType]}</span>
              </div>
              <button className="cf-close-btn" onClick={() => setShowPreview(false)} aria-label="Cerrar">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className="cf-preview-hint">
              Esta es la vista que verán tus alumnos. Los campos son de solo lectura en la previsualización.
            </div>
            <div className="cf-preview-scroll">
              <FormPreview fields={fields} />
            </div>
            <div className="cf-preview-footer">
              <button className="btn secondary" onClick={() => setShowPreview(false)}>Cerrar</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <style>{`
        .cf-page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 16px; flex-wrap: wrap; }
        .cf-header-actions { display: flex; gap: 8px; flex-shrink: 0; }
        .cf-banner {
          background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px;
          padding: 10px 16px; font-size: 12.5px; color: #92400e; margin-bottom: 16px;
        }
        .cf-banner code { background: #fde68a; padding: 1px 6px; border-radius: 4px; }
        .cf-banner-error { background: #fef2f2; border-color: #dc2626; color: #991b1b; }

        /* Layout */
        .cf-layout { display: grid; grid-template-columns: 1fr 260px; gap: 16px; align-items: start; }
        @media (max-width: 860px) { .cf-layout { grid-template-columns: 1fr; } }

        /* Editor */
        .cf-editor-wrap { display: flex; flex-direction: column; gap: 0; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
        .cf-editor-header {
          display: flex; align-items: center; gap: 8px;
          padding: 9px 14px; background: var(--surface-elevated);
          border-bottom: 1px solid var(--border);
        }
        .cf-editor-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; color: var(--text-tertiary); }
        .cf-dirty-dot { width: 7px; height: 7px; border-radius: 50%; background: #f59e0b; flex-shrink: 0; }
        .cf-editor {
          width: 100%; resize: vertical; border: none; outline: none;
          background: var(--surface); color: var(--text-primary);
          font-family: 'SF Mono', 'Fira Code', 'Fira Mono', monospace;
          font-size: 12.5px; line-height: 1.7; padding: 14px;
          box-sizing: border-box; min-height: 520px;
        }
        .cf-loading { padding: 40px; text-align: center; color: var(--text-tertiary); font-size: 13px; }

        /* Reference panel */
        .cf-ref-panel {
          border: 1px solid var(--border); border-radius: 8px; overflow: hidden;
          position: sticky; top: 16px;
        }
        .cf-ref-title {
          padding: 9px 14px; background: var(--surface-elevated);
          border-bottom: 1px solid var(--border);
          font-size: 10.5px; font-weight: 700; text-transform: uppercase;
          letter-spacing: .08em; color: var(--text-tertiary);
        }
        .cf-ref-item { padding: 10px 14px; border-bottom: 1px solid var(--border); }
        .cf-ref-item:last-child { border-bottom: none; }
        .cf-ref-code {
          font-family: 'SF Mono', 'Fira Code', monospace;
          font-size: 11px; color: var(--primary);
          background: color-mix(in srgb, var(--primary) 8%, transparent);
          padding: 4px 8px; border-radius: 4px; margin: 0 0 4px;
          white-space: pre-wrap; word-break: break-all;
        }
        .cf-ref-desc { font-size: 11.5px; color: var(--text-tertiary); }

        /* Preview portal overlay — always on top of everything */
        .cf-portal-overlay {
          position: fixed; inset: 0; z-index: 9999;
          background: rgba(0, 0, 0, .6);
          backdrop-filter: blur(4px);
          display: flex; align-items: center; justify-content: center;
          padding: 24px;
          animation: cf-fade-in 150ms ease;
        }
        @keyframes cf-fade-in { from { opacity: 0; } to { opacity: 1; } }

        .cf-preview-modal {
          background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
          width: 100%; max-width: 580px; height: min(86vh, 780px);
          display: flex; flex-direction: column;
          box-shadow: 0 32px 80px rgba(0,0,0,.35), 0 0 0 1px rgba(255,255,255,.06);
          animation: cf-slide-up 200ms cubic-bezier(.16,1,.3,1);
        }
        @keyframes cf-slide-up { from { transform: translateY(16px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

        .cf-preview-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 16px 20px; border-bottom: 1px solid var(--border); flex-shrink: 0;
          gap: 12px;
        }
        .cf-preview-header-left { display: flex; align-items: center; gap: 10px; }
        .cf-preview-badge {
          font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em;
          color: var(--primary); background: color-mix(in srgb, var(--primary) 12%, transparent);
          padding: 3px 8px; border-radius: 4px;
        }
        .cf-preview-title { font-size: 15px; font-weight: 700; color: var(--text-primary); }
        .cf-close-btn {
          width: 32px; height: 32px; border-radius: 6px; border: 1px solid var(--border);
          background: var(--surface-elevated); color: var(--text-secondary);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; flex-shrink: 0; transition: background 120ms, color 120ms;
        }
        .cf-close-btn:hover { background: var(--surface-hover); color: var(--text-primary); }

        .cf-preview-hint {
          padding: 10px 20px; background: var(--surface-elevated);
          border-bottom: 1px solid var(--border); flex-shrink: 0;
          font-size: 12px; color: var(--text-tertiary);
        }
        .cf-preview-scroll { flex: 1; overflow-y: auto; padding: 4px 0; }
        .cf-preview-body { padding: 12px 24px 24px; display: flex; flex-direction: column; gap: 20px; }
        .cf-preview-footer {
          padding: 12px 20px; border-top: 1px solid var(--border); flex-shrink: 0;
          display: flex; justify-content: flex-end;
        }

        /* Form fields in preview */
        .cf-field { display: flex; flex-direction: column; gap: 8px; }
        .cf-label { font-size: 14px; font-weight: 600; color: var(--text-primary); }
        .cf-checkgroup { display: flex; flex-direction: column; gap: 6px; }
        .cf-check-row {
          display: flex; align-items: center; gap: 10px;
          padding: 9px 12px; border: 1px solid var(--border); border-radius: 6px;
          cursor: pointer; font-size: 13.5px; color: var(--text-primary);
          transition: background 100ms;
        }
        .cf-check-row:hover { background: var(--surface-elevated); }
        .cf-check-row input { width: 15px; height: 15px; flex-shrink: 0; accent-color: var(--primary); }
        .cf-select, .cf-input {
          width: 100%; padding: 9px 11px; border: 1px solid var(--border); border-radius: 6px;
          background: var(--surface-elevated); color: var(--text-primary);
          font-size: 13.5px; font-family: inherit; box-sizing: border-box;
        }
        .cf-textarea {
          width: 100%; padding: 9px 11px; border: 1px solid var(--border); border-radius: 6px;
          background: var(--surface-elevated); color: var(--text-primary);
          font-size: 13.5px; font-family: inherit; resize: vertical; box-sizing: border-box;
        }
        .cf-select:focus, .cf-input:focus, .cf-textarea:focus { outline: none; border-color: var(--primary); }
      `}</style>
    </div>
  );
}
