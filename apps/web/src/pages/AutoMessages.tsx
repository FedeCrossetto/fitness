import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

const autoMsgTable = () => supabase.from('auto_message_configs');

// ── Types ────────────────────────────────────────────────────────────────────

type Schedule = 'instant' | string; // 'instant' | '9am day 3' | ...

interface TriggerDef {
  key: string;
  schedule: Schedule;
  description: string;
  defaultMessage: string;
  group: string;
}

interface Config {
  id?: string;
  trigger_key: string;
  schedule: string;
  message: string;
  enabled: boolean;
}

// ── Default triggers ──────────────────────────────────────────────────────────

const TRIGGERS: TriggerDef[] = [
  // Onboarding
  { group: 'Onboarding', key: 'first_sign_in',    schedule: 'instant',     description: 'Al registrarse por primera vez', defaultMessage: '¡Bienvenido/a a Habito! 🎉 Soy tu entrenador y estoy acá para ayudarte a alcanzar tus objetivos. Cualquier duda, escribime.' },
  { group: 'Onboarding', key: 'day_3',             schedule: '9am — Día 3', description: '3 días después del registro',    defaultMessage: '¿Cómo te está yendo estos primeros días? Acordate de registrar tus comidas y tus entrenos para que pueda ver tu progreso.' },
  { group: 'Onboarding', key: 'day_7',             schedule: '9am — Día 7', description: '7 días después del registro',    defaultMessage: '¡Llegaste a tu primera semana! 💪 Seguí así, la constancia es la clave. Revisá tus metas y contame cómo te sentís.' },
  { group: 'Onboarding', key: 'day_14',            schedule: '9am — Día 14', description: '14 días después del registro',  defaultMessage: '¡Dos semanas completadas! ¿Cómo vas con el plan? Este es buen momento para hacer un check-in y ajustar lo que sea necesario.' },
  { group: 'Onboarding', key: 'day_30',            schedule: '9am — Día 30', description: '30 días después del registro',  defaultMessage: '¡Un mes juntos! 🏆 Este es un gran hito. Revisemos tus resultados y planifiquemos el siguiente mes.' },

  // Hitos
  { group: 'Hitos', key: 'first_workout',    schedule: 'instant', description: 'Primer entreno completado',           defaultMessage: '¡Excelente! Completaste tu primer entreno 🔥 ¿Cómo te sentiste? Ese primer paso es el más importante.' },
  { group: 'Hitos', key: 'first_meal',       schedule: 'instant', description: 'Primera comida registrada',           defaultMessage: 'Muy bien, registraste tu primera comida 🥗 Seguir registrando tu alimentación es clave para avanzar.' },
  { group: 'Hitos', key: 'first_photo',      schedule: 'instant', description: 'Primera foto de progreso subida',     defaultMessage: '¡Foto de progreso guardada! 📸 Las fotos son la mejor forma de ver tu evolución real. Seguí tomándolas semana a semana.' },
  { group: 'Hitos', key: 'weight_goal',      schedule: 'instant', description: 'Meta de peso alcanzada',              defaultMessage: '¡INCREÍBLE! Llegaste a tu meta de peso 🎯 Todo el trabajo valió la pena. ¿Establecemos un nuevo objetivo?' },
  { group: 'Hitos', key: 'streak_7',         schedule: 'instant', description: '7 días de racha consecutiva',         defaultMessage: '¡7 días de racha! 🔥 La consistencia es lo que separa a los que logran sus metas de los que no. Seguí así.' },

  // Fechas especiales
  { group: 'Fechas especiales', key: 'birthday',   schedule: '9am — Cumpleaños', description: 'Cumpleaños del alumno', defaultMessage: '¡Feliz cumple! 🎂 Que este año estés más cerca de tus objetivos y más fuerte que nunca. ¡A celebrar!' },
  { group: 'Fechas especiales', key: 'inactivity_7', schedule: '9am — Día 7 sin actividad', description: '7 días sin registrar actividad', defaultMessage: 'Hace una semana que no te veo por acá... ¿Todo bien? 😊 Cualquier cosa, escribime. Pequeños pasos cuentan.' },
];

const GROUPS = [...new Set(TRIGGERS.map((t) => t.group))];

// ── Helpers ───────────────────────────────────────────────────────────────────

function ScheduleBadge({ schedule }: { schedule: string }): React.JSX.Element {
  const isInstant = schedule === 'instant';
  return (
    <span className={`auto-msg-badge${isInstant ? ' instant' : ' scheduled'}`}>
      {isInstant ? 'Instantáneo' : schedule}
    </span>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AutoMessagesPage(): React.JSX.Element {
  const { session } = useAuth();
  const trainerId = session?.user.id;

  const [configs, setConfigs] = useState<Map<string, Config>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [editKey, setEditKey] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [dbMissing, setDbMissing] = useState(false);

  // Load existing configs from DB
  useEffect(() => {
    if (!trainerId) return;
    void (async () => {
      const { data, error } = await autoMsgTable().select('*').eq('trainer_id', trainerId) as { data: Config[] | null; error: { code?: string } | null };
      if (error) { setDbMissing(true); setLoading(false); return; }

      const map = new Map<string, Config>();
      // Seed defaults for missing keys
      for (const def of TRIGGERS) {
        const existing = data?.find((r: Config) => r.trigger_key === def.key);
        map.set(def.key, existing ?? {
          trigger_key: def.key,
          schedule: def.schedule,
          message: def.defaultMessage,
          enabled: true,
        });
      }
      setConfigs(map);
      setLoading(false);
    })();
  }, [trainerId]);

  const saveConfig = useCallback(async (cfg: Config) => {
    if (!trainerId) return;
    setSaving((prev) => new Set(prev).add(cfg.trigger_key));
    try {
      if (cfg.id) {
        await autoMsgTable()
          .update({ message: cfg.message, enabled: cfg.enabled, schedule: cfg.schedule })
          .eq('id', cfg.id);
      } else {
        const { data } = await autoMsgTable()
          .insert({ trainer_id: trainerId, ...cfg })
          .select()
          .single() as { data: Config | null };
        if (data) {
          setConfigs((prev) => {
            const next = new Map(prev);
            next.set(cfg.trigger_key, data as Config);
            return next;
          });
        }
      }
    } finally {
      setSaving((prev) => {
        const next = new Set(prev);
        next.delete(cfg.trigger_key);
        return next;
      });
    }
  }, [trainerId]);

  const toggleEnabled = useCallback((key: string) => {
    setConfigs((prev) => {
      const cfg = prev.get(key);
      if (!cfg) return prev;
      const updated = { ...cfg, enabled: !cfg.enabled };
      void saveConfig(updated);
      return new Map(prev).set(key, updated);
    });
  }, [saveConfig]);

  const openEdit = (key: string) => {
    const cfg = configs.get(key);
    const def = TRIGGERS.find((t) => t.key === key);
    setEditText(cfg?.message ?? def?.defaultMessage ?? '');
    setEditKey(key);
  };

  const saveEdit = async () => {
    if (!editKey) return;
    const cfg = configs.get(editKey);
    const def = TRIGGERS.find((t) => t.key === editKey);
    if (!cfg && !def) return;
    const updated: Config = {
      ...(cfg ?? { trigger_key: editKey, schedule: def!.schedule, enabled: true }),
      message: editText,
    };
    setConfigs((prev) => new Map(prev).set(editKey, updated));
    await saveConfig(updated);
    setEditKey(null);
  };

  const editingDef = TRIGGERS.find((t) => t.key === editKey);

  return (
    <div>
      <div className="page-header-row">
        <div>
          <h1 className="page-title">Mensajes automáticos</h1>
          <p className="page-sub">Configurá los mensajes que se envían automáticamente a tus alumnos según sus acciones.</p>
        </div>
      </div>

      {dbMissing && (
        <div className="card" style={{ padding: '14px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12, background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 10 }}>
          <span style={{ fontSize: 20 }}>⚠️</span>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13, color: '#92400e' }}>Tabla pendiente de migración</div>
            <div style={{ fontSize: 12, color: '#92400e', marginTop: 2 }}>
              Ejecutá <code style={{ background: '#fde68a', padding: '1px 6px', borderRadius: 4 }}>supabase/migrations/0014_auto_messages.sql</code> en tu proyecto de Supabase para habilitar el guardado.
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)' }}>
          Cargando configuración…
        </div>
      ) : (
        GROUPS.map((group) => {
          const groupTriggers = TRIGGERS.filter((t) => t.group === group);
          return (
            <div key={group} className="auto-msg-section">
              <div className="auto-msg-section-title">{group}</div>
              <div className="card auto-msg-table" style={{ padding: 0 }}>
                <div className="auto-msg-thead">
                  <span>Horario</span>
                  <span>Evento</span>
                  <span style={{ textAlign: 'right' }}>Acción</span>
                </div>
                {groupTriggers.map((def, idx) => {
                  const cfg = configs.get(def.key);
                  const isSaving = saving.has(def.key);
                  const isLast = idx === groupTriggers.length - 1;
                  return (
                    <div
                      key={def.key}
                      className={`auto-msg-row${!isLast ? ' bordered' : ''}`}
                    >
                      {/* Schedule badge */}
                      <div className="auto-msg-col-schedule">
                        <ScheduleBadge schedule={cfg?.schedule ?? def.schedule} />
                      </div>

                      {/* Description + message preview */}
                      <div className="auto-msg-col-desc">
                        <span className="auto-msg-trigger-label">{def.description}</span>
                        <span className="auto-msg-preview">
                          {cfg?.message ?? def.defaultMessage}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="auto-msg-col-actions">
                        <button
                          className="btn secondary auto-msg-customize"
                          onClick={() => openEdit(def.key)}
                        >
                          Personalizar
                        </button>
                        <label className={`toggle-switch${isSaving ? ' saving' : ''}`} aria-label="Habilitar mensaje">
                          <input
                            type="checkbox"
                            checked={cfg?.enabled ?? true}
                            onChange={() => toggleEnabled(def.key)}
                            disabled={isSaving}
                          />
                          <span className="toggle-track">
                            <span className="toggle-thumb" />
                          </span>
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}

      {/* ── Edit modal ───────────────────────────────────────────────────── */}
      {editKey && (
        <div className="modal-overlay" onClick={() => setEditKey(null)}>
          <div className="modal-box auto-msg-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div className="modal-title">Personalizar mensaje</div>
                <div className="modal-sub">{editingDef?.description}</div>
              </div>
              <button className="icon-action" onClick={() => setEditKey(null)} aria-label="Cerrar">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div className="modal-section-label">
              <ScheduleBadge schedule={configs.get(editKey)?.schedule ?? editingDef?.schedule ?? 'instant'} />
            </div>

            <div className="modal-field">
              <label className="field-label">Mensaje</label>
              <textarea
                className="auto-msg-textarea"
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                placeholder="Escribí el mensaje automático…"
                rows={5}
                maxLength={500}
              />
              <div className="field-hint">{editText.length}/500 caracteres</div>
            </div>

            <div className="modal-hint">
              <strong>Variables disponibles:</strong> {'{{nombre}}'} — nombre del alumno &nbsp;·&nbsp; {'{{fecha}}'} — fecha del evento
            </div>

            <div className="modal-footer">
              <button className="btn secondary" onClick={() => setEditKey(null)}>Cancelar</button>
              <button className="btn primary" onClick={() => void saveEdit()}>Guardar mensaje</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .page-header-row { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 4px; }

        /* Section */
        .auto-msg-section { margin-bottom: 32px; }
        .auto-msg-section-title {
          font-size: 11px; font-weight: 700; letter-spacing: .09em; text-transform: uppercase;
          color: var(--text-tertiary); margin-bottom: 6px; padding-left: 1px;
        }

        /* Table — flat, rectangular */
        .auto-msg-table { overflow: hidden; border-radius: 8px; }
        .auto-msg-thead {
          display: grid; grid-template-columns: 140px 1fr 170px;
          padding: 7px 18px;
          background: var(--surface-elevated);
          font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .07em;
          color: var(--text-tertiary); gap: 16px;
          border-bottom: 1px solid var(--border);
        }
        .auto-msg-row {
          display: grid; grid-template-columns: 140px 1fr 170px;
          align-items: center; padding: 12px 18px; gap: 16px;
          transition: background 100ms;
        }
        .auto-msg-row:hover { background: var(--surface-elevated); }
        .auto-msg-row.bordered { border-bottom: 1px solid var(--border); }

        /* Cols */
        .auto-msg-col-schedule { display: flex; align-items: center; }
        .auto-msg-col-desc { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .auto-msg-col-actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; }

        .auto-msg-trigger-label { font-size: 13px; font-weight: 600; color: var(--text-primary); }
        .auto-msg-preview {
          font-size: 11.5px; color: var(--text-tertiary);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 460px;
        }

        /* Badge — flat pill, minimal */
        .auto-msg-badge {
          display: inline-block;
          padding: 3px 9px; border-radius: 4px; font-size: 11px; font-weight: 650;
          white-space: nowrap; letter-spacing: .01em;
        }
        .auto-msg-badge.instant  { background: #d1fae5; color: #065f46; }
        .auto-msg-badge.scheduled { background: #ede9fe; color: #5b21b6; }
        [data-theme="dark"] .auto-msg-badge.instant  { background: #052e16; color: #6ee7b7; }
        [data-theme="dark"] .auto-msg-badge.scheduled { background: #2e1065; color: #c4b5fd; }

        /* Customize button */
        .auto-msg-customize {
          font-size: 11.5px; padding: 5px 12px; flex-shrink: 0;
          border-radius: 6px;
        }

        /* Toggle */
        .toggle-switch { position: relative; display: inline-flex; cursor: pointer; flex-shrink: 0; }
        .toggle-switch input { position: absolute; opacity: 0; width: 0; height: 0; }
        .toggle-track {
          width: 40px; height: 22px; border-radius: 11px;
          background: #e2e8f0;
          border: 1.5px solid #cbd5e1;
          transition: background 180ms, border-color 180ms;
          display: flex; align-items: center; padding: 2px;
          box-sizing: border-box;
        }
        .toggle-switch input:checked ~ .toggle-track {
          background: #22c55e;
          border-color: #16a34a;
        }
        .toggle-thumb {
          width: 16px; height: 16px; border-radius: 50%; background: #94a3b8;
          box-shadow: 0 1px 3px rgba(0,0,0,.2); transition: transform 180ms, background 180ms;
          flex-shrink: 0;
        }
        .toggle-switch input:checked ~ .toggle-track .toggle-thumb {
          transform: translateX(18px);
          background: #fff;
        }
        .toggle-switch.saving { opacity: .4; pointer-events: none; }

        /* Modal */
        .modal-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,.45); z-index: 200;
          display: flex; align-items: center; justify-content: center; padding: 24px;
        }
        .auto-msg-modal {
          background: var(--surface); border: 1px solid var(--border); border-radius: 10px;
          width: 100%; max-width: 500px; display: flex; flex-direction: column;
          box-shadow: 0 16px 48px rgba(0,0,0,.18);
        }
        .modal-header {
          display: flex; align-items: flex-start; justify-content: space-between;
          padding: 18px 22px 14px; border-bottom: 1px solid var(--border);
        }
        .modal-title { font-size: 15px; font-weight: 700; color: var(--text-primary); }
        .modal-sub { font-size: 12.5px; color: var(--text-tertiary); margin-top: 2px; }
        .modal-section-label { padding: 14px 22px 4px; }
        .modal-field { padding: 10px 22px; display: flex; flex-direction: column; gap: 6px; }
        .field-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; color: var(--text-tertiary); }
        .auto-msg-textarea {
          width: 100%; border: 1px solid var(--border); border-radius: 6px;
          background: var(--surface-elevated); color: var(--text-primary);
          padding: 9px 11px; font-size: 13.5px; line-height: 1.6; resize: vertical;
          font-family: inherit; box-sizing: border-box; transition: border-color 150ms;
        }
        .auto-msg-textarea:focus { outline: none; border-color: var(--primary); }
        .field-hint { font-size: 11px; color: var(--text-tertiary); text-align: right; }
        .modal-hint {
          margin: 0 22px 2px; padding: 9px 12px;
          background: var(--surface-elevated); border-radius: 6px;
          font-size: 11.5px; color: var(--text-secondary); border: 1px solid var(--border);
        }
        .modal-footer {
          display: flex; justify-content: flex-end; gap: 8px;
          padding: 14px 22px 18px; border-top: 1px solid var(--border); margin-top: 14px;
        }
      `}</style>
    </div>
  );
}
