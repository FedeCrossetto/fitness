import { useEffect, useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import type { TrainerBrandingRow } from '@reset-fitness/shared/types/database';
import { buildInviteLink } from '@reset-fitness/shared';
import { getJoinBaseUrl } from '@/lib/inviteClient';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';

const HEX_RE = /^#([0-9a-fA-F]{6})$/;

function buildInviteLinkLocal(code: string): string {
  return buildInviteLink(code, getJoinBaseUrl());
}

function ColorField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
}): React.JSX.Element {
  const valid = HEX_RE.test(value);
  return (
    <div className="field">
      <label>{label}</label>
      <div className="color-control">
        <label className="color-dot" style={{ background: valid ? value : 'var(--surface-elevated)' }}>
          <input
            type="color"
            value={valid ? value : '#000000'}
            onChange={(e) => onChange(e.target.value.toUpperCase())}
            aria-label={`Elegir ${label}`}
          />
        </label>
        <input
          className="color-hex"
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          placeholder={placeholder}
          maxLength={7}
        />
      </div>
    </div>
  );
}

type Form = {
  app_name: string;
  invite_code: string;
  logo_url: string;
  color_primary: string;
  color_accent: string;
  welcome_title: string;
  welcome_subtitle: string;
};

const EMPTY: Form = {
  app_name: '',
  invite_code: '',
  logo_url: '',
  color_primary: '',
  color_accent: '',
  welcome_title: '',
  welcome_subtitle: '',
};

export function BrandingPage(): React.JSX.Element {
  const { session } = useAuth();
  const { showToast } = useToast();
  const userId = session?.user.id;
  const [form, setForm] = useState<Form>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [copied, setCopied] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  const inviteLink = buildInviteLinkLocal(form.invite_code);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      showToast('error', 'No pudimos copiar el link.');
    }
  };

  const downloadQr = () => {
    const canvas = qrRef.current?.querySelector('canvas');
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `qr-${(form.invite_code || 'app').toLowerCase()}.png`;
    a.click();
  };

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
          logo_url: b.logo_url ?? '',
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

  const onPickLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !userId) return;
    if (!file.type.startsWith('image/')) {
      showToast('error', 'El logo debe ser una imagen.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      showToast('error', 'El logo no puede superar los 2 MB.');
      return;
    }
    setUploading(true);
    const ext = (file.name.split('.').pop() || 'png').toLowerCase();
    const path = `${userId}/app-logo.${ext}`;
    const { error } = await supabase.storage.from('avatars').upload(path, file, {
      contentType: file.type,
      upsert: true,
    });
    setUploading(false);
    if (error) {
      showToast('error', 'No pudimos subir el logo.');
      return;
    }
    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    setForm((p) => ({ ...p, logo_url: `${data.publicUrl}?t=${Date.now()}` }));
  };

  const onSave = async () => {
    if (!userId) return;
    if (!form.app_name.trim() || !form.invite_code.trim()) {
      showToast('error', 'Nombre de app y código de invitación son obligatorios.');
      return;
    }
    if (form.color_primary && !HEX_RE.test(form.color_primary)) {
      showToast('error', 'Color primario inválido (#RRGGBB).');
      return;
    }
    if (form.color_accent && !HEX_RE.test(form.color_accent)) {
      showToast('error', 'Color de acento inválido (#RRGGBB).');
      return;
    }
    setSaving(true);
    const payload = {
      trainer_id: userId,
      app_name: form.app_name.trim(),
      invite_code: form.invite_code.trim().toUpperCase(),
      logo_url: form.logo_url || null,
      color_primary: form.color_primary || null,
      color_accent: form.color_accent || null,
      welcome_title: form.welcome_title.trim() || null,
      welcome_subtitle: form.welcome_subtitle.trim() || null,
    };
    const { error } = await supabase
      .from('trainer_branding')
      .upsert(payload, { onConflict: 'trainer_id' });
    setSaving(false);
    if (error) showToast('error', 'No pudimos guardar. ¿El código de invitación ya existe?');
    else showToast('success', 'Marca actualizada.');
  };

  if (loading) return <div className="muted">Cargando…</div>;

  return (
    <div>
      <h1 className="page-title">Marca</h1>
      <p className="page-sub">Personalizá cómo se ve tu app para los alumnos.</p>

      <div className="card form-card">
        <section className="form-section">
          <h3 className="form-section-title">Identidad</h3>
          <div className="field">
            <label>Nombre de la app</label>
            <input value={form.app_name} onChange={set('app_name')} placeholder="Pepito Fit" />
          </div>
          <div className="field">
            <label>Código de invitación</label>
            <input value={form.invite_code} onChange={set('invite_code')} placeholder="PEPITO" />
          </div>
          <div className="field is-tall">
            <label>Logo de la app</label>
            <div className="field-body">
              <div className="logo-control">
                <span className="logo-preview">
                  {form.logo_url ? (
                    <img src={form.logo_url} alt="Logo" />
                  ) : (
                    <span className="logo-empty">Sin logo</span>
                  )}
                </span>
                <div className="logo-actions">
                  <label className="btn secondary">
                    {uploading ? 'Subiendo…' : form.logo_url ? 'Cambiar logo' : 'Subir logo'}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      onChange={(e) => void onPickLogo(e)}
                      disabled={uploading}
                      hidden
                    />
                  </label>
                  {form.logo_url ? (
                    <button
                      type="button"
                      className="logo-remove"
                      onClick={() => setForm((p) => ({ ...p, logo_url: '' }))}
                    >
                      Quitar
                    </button>
                  ) : null}
                </div>
              </div>
              <p className="field-hint">PNG, JPG, WEBP o SVG. Máx. 2 MB. Recomendado cuadrado.</p>
            </div>
          </div>
        </section>

        <section className="form-section">
          <h3 className="form-section-title">Colores</h3>
          <ColorField
            label="Color primario"
            value={form.color_primary}
            placeholder="#FF5A36"
            onChange={(v) => setForm((p) => ({ ...p, color_primary: v }))}
          />
          <ColorField
            label="Color de acento"
            value={form.color_accent}
            placeholder="#FFB020"
            onChange={(v) => setForm((p) => ({ ...p, color_accent: v }))}
          />
        </section>

        <section className="form-section">
          <h3 className="form-section-title">Bienvenida</h3>
          <div className="field">
            <label>Título de bienvenida</label>
            <input value={form.welcome_title} onChange={set('welcome_title')} placeholder="Entrená con Pepito" />
          </div>
          <div className="field">
            <label>Subtítulo de bienvenida</label>
            <input value={form.welcome_subtitle} onChange={set('welcome_subtitle')} placeholder="Tu mejor versión empieza hoy" />
          </div>
        </section>

        <div className="form-actions">
          <button className="btn" onClick={() => void onSave()} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar marca'}
          </button>
        </div>
      </div>

      <div className="card share-card">
        <h2 className="section-title" style={{ margin: '0 0 4px' }}>Compartí tu app</h2>
        <p className="muted" style={{ margin: '0 0 18px' }}>
          Compartí este link o QR. Tus alumnos se registran con Google o email y quedan vinculados automáticamente.
        </p>
        {form.invite_code.trim() ? (
          <div className="share-body">
            <div className="qr-box" ref={qrRef}>
              <QRCodeCanvas value={inviteLink} size={172} level="M" includeMargin marginSize={2} />
            </div>
            <div className="share-info">
              <div className="field">
                <label>Link de invitación</label>
                <div className="copy-row">
                  <input readOnly value={inviteLink} onFocus={(e) => e.target.select()} />
                  <button type="button" className="btn secondary sm" onClick={() => void copyLink()}>
                    {copied ? 'Copiado' : 'Copiar'}
                  </button>
                </div>
              </div>
              <button type="button" className="btn secondary" onClick={downloadQr}>
                Descargar QR
              </button>
              <p className="field-hint">
                El QR abre la página de descarga del APK (Android) con tu código ya cargado.
                La URL del APK se configura con <code>VITE_ANDROID_APK_URL</code>.
              </p>
            </div>
          </div>
        ) : (
          <p className="muted" style={{ margin: 0 }}>
            Definí primero un <strong>código de invitación</strong> arriba para generar el QR.
          </p>
        )}
      </div>
    </div>
  );
}
