import { useEffect, useState } from 'react';
import type { TrainerBrandingRow } from '@habito/shared/types/database';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

const HEX_RE = /^#([0-9a-fA-F]{6})$/;

type Form = {
  app_name: string;
  invite_code: string;
  color_primary: string;
  color_accent: string;
  welcome_title: string;
  welcome_subtitle: string;
};

const EMPTY: Form = {
  app_name: '',
  invite_code: '',
  color_primary: '',
  color_accent: '',
  welcome_title: '',
  welcome_subtitle: '',
};

export function BrandingPage(): React.JSX.Element {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [form, setForm] = useState<Form>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ kind: 'error' | 'success'; msg: string } | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      const { data } = await supabase.from('trainer_branding').select('*').maybeSingle();
      if (!active) return;
      const b = data as TrainerBrandingRow | null;
      if (b) {
        setForm({
          app_name: b.app_name ?? '',
          invite_code: b.invite_code ?? '',
          color_primary: b.color_primary ?? '',
          color_accent: b.color_accent ?? '',
          welcome_title: b.welcome_title ?? '',
          welcome_subtitle: b.welcome_subtitle ?? '',
        });
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const set = (key: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const onSave = async () => {
    if (!userId) return;
    setToast(null);
    if (!form.app_name.trim() || !form.invite_code.trim()) {
      setToast({ kind: 'error', msg: 'Nombre de app y código de invitación son obligatorios.' });
      return;
    }
    if (form.color_primary && !HEX_RE.test(form.color_primary)) {
      setToast({ kind: 'error', msg: 'Color primario inválido (#RRGGBB).' });
      return;
    }
    if (form.color_accent && !HEX_RE.test(form.color_accent)) {
      setToast({ kind: 'error', msg: 'Color de acento inválido (#RRGGBB).' });
      return;
    }
    setSaving(true);
    const payload: Partial<TrainerBrandingRow> = {
      trainer_id: userId,
      app_name: form.app_name.trim(),
      invite_code: form.invite_code.trim().toUpperCase(),
      color_primary: form.color_primary || null,
      color_accent: form.color_accent || null,
      welcome_title: form.welcome_title.trim() || null,
      welcome_subtitle: form.welcome_subtitle.trim() || null,
    };
    const { error } = await supabase
      .from('trainer_branding')
      .upsert(payload as never, { onConflict: 'trainer_id' });
    setSaving(false);
    setToast(
      error
        ? { kind: 'error', msg: 'No pudimos guardar. ¿El código de invitación ya existe?' }
        : { kind: 'success', msg: 'Marca actualizada.' }
    );
  };

  if (loading) return <div className="muted">Cargando…</div>;

  return (
    <div>
      <h1 className="page-title">Marca</h1>
      <p className="page-sub">Personalizá cómo se ve tu app para los alumnos.</p>

      {toast ? <div className={`toast ${toast.kind}`}>{toast.msg}</div> : null}

      <div className="card">
        <div className="field">
          <label>Nombre de la app</label>
          <input value={form.app_name} onChange={set('app_name')} placeholder="Pepito Fit" />
        </div>
        <div className="field">
          <label>Código de invitación</label>
          <input value={form.invite_code} onChange={set('invite_code')} placeholder="PEPITO" />
        </div>
        <div className="color-row">
          <div className="field">
            <label>Color primario</label>
            <input value={form.color_primary} onChange={set('color_primary')} placeholder="#FF5A36" />
          </div>
          <div
            className="swatch"
            style={{ background: HEX_RE.test(form.color_primary) ? form.color_primary : 'var(--surface-elevated)' }}
          />
        </div>
        <div className="color-row">
          <div className="field">
            <label>Color de acento</label>
            <input value={form.color_accent} onChange={set('color_accent')} placeholder="#FFB020" />
          </div>
          <div
            className="swatch"
            style={{ background: HEX_RE.test(form.color_accent) ? form.color_accent : 'var(--surface-elevated)' }}
          />
        </div>
        <div className="field">
          <label>Título de bienvenida</label>
          <input value={form.welcome_title} onChange={set('welcome_title')} placeholder="Entrená con Pepito" />
        </div>
        <div className="field">
          <label>Subtítulo de bienvenida</label>
          <input value={form.welcome_subtitle} onChange={set('welcome_subtitle')} placeholder="Tu mejor versión empieza hoy" />
        </div>
        <button className="btn" onClick={() => void onSave()} disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar marca'}
        </button>
      </div>
    </div>
  );
}
