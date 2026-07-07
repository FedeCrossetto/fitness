import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { anyClient } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';

interface NotificationPrefs {
  notify_billing_email: boolean;
  notify_billing_whatsapp: boolean;
}

const DEFAULT_PREFS: NotificationPrefs = {
  notify_billing_email: true,
  notify_billing_whatsapp: false,
};

export function NotificationSettingsPage(): React.JSX.Element {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<keyof NotificationPrefs | null>(null);

  useEffect(() => {
    if (!profile?.id) return;
    let active = true;
    void (async () => {
      const { data } = await anyClient
        .from('trainer_notification_prefs')
        .select('notify_billing_email, notify_billing_whatsapp')
        .eq('trainer_id', profile.id)
        .maybeSingle();
      if (!active) return;
      if (data) setPrefs(data as NotificationPrefs);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [profile?.id]);

  const toggle = async (key: keyof NotificationPrefs) => {
    if (!profile?.id || savingKey) return;
    const next = { ...prefs, [key]: !prefs[key] };
    setSavingKey(key);
    setPrefs(next);
    const { error } = await anyClient
      .from('trainer_notification_prefs')
      .upsert({ trainer_id: profile.id, ...next }, { onConflict: 'trainer_id' });
    setSavingKey(null);
    if (error) {
      setPrefs(prefs);
      showToast('error', 'No pudimos guardar el cambio.');
      return;
    }
    showToast('success', 'Preferencia actualizada.');
  };

  return (
    <div>
      <Link to="/settings" className="back-link">← Volver a Settings</Link>
      <h1 className="page-title">Notificaciones</h1>
      <p className="page-sub">Elegí cómo querés que te avisemos sobre alertas de facturación.</p>

      {loading ? null : (
        <div className="card" style={{ maxWidth: 560 }}>
          <div className="section-title" style={{ marginBottom: 4 }}>Precio de facturación desactualizado</div>
          <p className="muted" style={{ margin: '0 0 18px', fontSize: 12.5, lineHeight: 1.5 }}>
            Te avisamos cuando un cliente sigue pagando el precio viejo de una frecuencia y le quedan menos de 10 días
            para renovar en Mercado Pago.
          </p>

          <label className="notif-row">
            <div>
              <div className="notif-row-title">Email</div>
              <div className="notif-row-desc">Recibir un mail a tu correo de la cuenta.</div>
            </div>
            <span className={`toggle-switch${savingKey === 'notify_billing_email' ? ' saving' : ''}`}>
              <input
                type="checkbox"
                checked={prefs.notify_billing_email}
                onChange={() => void toggle('notify_billing_email')}
                disabled={savingKey === 'notify_billing_email'}
                aria-label="Notificar por email"
              />
              <span className="toggle-track">
                <span className="toggle-thumb" />
              </span>
            </span>
          </label>

          <label className="notif-row">
            <div>
              <div className="notif-row-title">WhatsApp</div>
              <div className="notif-row-desc">
                Todavía no está conectado — cuando lo esté, vas a empezar a recibir el aviso ahí si lo dejás activado.
              </div>
            </div>
            <span className={`toggle-switch${savingKey === 'notify_billing_whatsapp' ? ' saving' : ''}`}>
              <input
                type="checkbox"
                checked={prefs.notify_billing_whatsapp}
                onChange={() => void toggle('notify_billing_whatsapp')}
                disabled={savingKey === 'notify_billing_whatsapp'}
                aria-label="Notificar por WhatsApp"
              />
              <span className="toggle-track">
                <span className="toggle-thumb" />
              </span>
            </span>
          </label>
        </div>
      )}

      <style>{`
        .notif-row {
          display: flex; align-items: center; justify-content: space-between; gap: 20px;
          padding: 14px 0; border-top: 1px solid var(--border); cursor: pointer;
        }
        .notif-row:first-of-type { border-top: none; }
        .notif-row-title { font-size: 14px; font-weight: 600; color: var(--text-primary); }
        .notif-row-desc { font-size: 12.5px; color: var(--text-tertiary); margin-top: 2px; max-width: 380px; }

        .toggle-switch { position: relative; display: inline-flex; cursor: pointer; flex-shrink: 0; }
        .toggle-switch input { position: absolute; opacity: 0; width: 0; height: 0; }
        .toggle-track {
          width: 36px; height: 20px; border-radius: 10px;
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
          width: 14px; height: 14px; border-radius: 50%; background: #94a3b8;
          box-shadow: 0 1px 3px rgba(0,0,0,.2); transition: transform 180ms, background 180ms;
          flex-shrink: 0;
        }
        .toggle-switch input:checked ~ .toggle-track .toggle-thumb {
          transform: translateX(16px);
          background: #fff;
        }
        .toggle-switch.saving { opacity: .4; pointer-events: none; }
      `}</style>
    </div>
  );
}
