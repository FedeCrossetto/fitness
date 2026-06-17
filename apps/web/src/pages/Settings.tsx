import { useRef, useState } from 'react';
import { SettingsIcon, BellIcon, BrushIcon, CreditCardIcon, UsersIcon, MessageIcon, BookOpenIcon, CheckIcon } from '@/components/icons';
import { useAuth } from '@/hooks/useAuth';
import { Link } from 'react-router-dom';
import type { ProfileRow } from '@habito/shared/types/database';
import { supabase } from '@/lib/supabase';

type SettingsSection = {
  icon: React.ReactNode;
  title: string;
  desc: string;
  action: string;
  to?: string;
  highlight?: boolean;
};

const SECTIONS: SettingsSection[] = [
  { icon: <UsersIcon size={20} />,     title: 'Perfil',                 desc: 'Nombre, foto y datos del entrenador.',                                          action: 'Editar perfil' },
  { icon: <BrushIcon size={20} />,     title: 'Marca de la app',        desc: 'Nombre, colores y logo de tu app mobile.',                                      action: 'Configurar',   to: '/branding' },
  { icon: <MessageIcon size={20} />,   title: 'Mensajes automáticos',   desc: 'Configurá mensajes que se envían solos según la actividad de tus alumnos.',     action: 'Configurar',   to: '/settings/auto-messages', highlight: true },
  { icon: <BookOpenIcon size={20} />, title: 'Formulario de consulta', desc: 'Personalizá el formulario que completan tus alumnos al unirse.',                   action: 'Configurar',   to: '/settings/consultation-form' },
  { icon: <CheckIcon size={20} />,    title: 'Deslinde de responsabilidad', desc: 'Documento que firman tus alumnos digitalmente antes de iniciar el plan.',  action: 'Configurar',   to: '/settings/waiver' },
  { icon: <CreditCardIcon size={20} />,title: 'Suscripción',            desc: 'Plan actual, facturación y métodos de pago.',                                   action: 'Ver plan' },
  { icon: <BellIcon size={20} />,      title: 'Notificaciones',         desc: 'Configurá qué alertas recibís por email y push.',                               action: 'Configurar' },
  { icon: <SettingsIcon size={20} />,  title: 'Privacidad y seguridad', desc: 'Contraseña, sesiones activas y permisos.',                                      action: 'Gestionar' },
];

function SectionRow({ s, isLast }: { s: SettingsSection; isLast: boolean }): React.JSX.Element {
  const inner = (
    <div
      className={s.to ? 'settings-row settings-row--link' : 'settings-row'}
      style={{
        borderBottom: !isLast ? '1px solid var(--border)' : 'none',
        background: s.highlight ? 'color-mix(in srgb, var(--primary) 5%, transparent)' : undefined,
      }}
    >
      <div className="settings-row-icon" style={{ color: s.highlight ? 'var(--primary)' : undefined }}>
        {s.icon}
      </div>
      <div className="settings-row-body">
        <div className="settings-row-title">{s.title}</div>
        <div className="settings-row-desc">{s.desc}</div>
      </div>
      <span className={`btn ${s.highlight ? 'primary' : 'secondary'} settings-row-btn`}>
        {s.action}
      </span>
    </div>
  );

  if (s.to) {
    return <Link to={s.to} style={{ textDecoration: 'none', display: 'block' }}>{inner}</Link>;
  }
  return inner;
}

function initials(name: string | null | undefined): string {
  if (!name) return 'E';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

export function SettingsPage(): React.JSX.Element {
  const { profile, session, refreshProfile } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<{ kind: 'error' | 'success'; msg: string } | null>(null);

  const onPickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    const userId = session?.user.id;
    if (!file || !userId) return;

    if (!file.type.startsWith('image/')) {
      setToast({ kind: 'error', msg: 'La foto debe ser una imagen.' });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setToast({ kind: 'error', msg: 'La foto no puede superar los 2 MB.' });
      return;
    }

    setUploading(true);
    setToast(null);

    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${userId}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, {
      contentType: file.type,
      upsert: true,
    });

    if (uploadError) {
      setUploading(false);
      setToast({ kind: 'error', msg: 'No pudimos subir la foto. Intentá de nuevo.' });
      return;
    }

    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
    const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: avatarUrl } as Partial<ProfileRow> as never)
      .eq('id', userId);

    setUploading(false);

    if (updateError) {
      setToast({ kind: 'error', msg: 'No pudimos guardar la foto en tu perfil.' });
      return;
    }

    await refreshProfile();
    setToast({ kind: 'success', msg: 'Foto actualizada.' });
  };

  return (
    <div>
      <h1 className="page-title">Settings</h1>
      <p className="page-sub">Configurá tu cuenta y preferencias del panel.</p>

      {toast && (
        <div className={`settings-toast settings-toast--${toast.kind}`}>
          {toast.msg}
        </div>
      )}

      {/* Profile card */}
      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <div
          className="avatar"
          style={{
            width: 56,
            height: 56,
            fontSize: 20,
            padding: profile?.avatar_url ? 0 : undefined,
            overflow: profile?.avatar_url ? 'hidden' : undefined,
          }}
        >
          {profile?.avatar_url
            ? <img src={profile.avatar_url} alt={profile.full_name ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : initials(profile?.full_name)
          }
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 650, fontSize: 16 }}>{profile?.full_name ?? 'Entrenador'}</div>
          <div style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>Entrenador · {profile?.role ?? 'trainer'}</div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => void onPickPhoto(e)}
        />
        <button
          className="btn secondary"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? 'Subiendo…' : 'Editar foto'}
        </button>
      </div>

      {/* Settings list */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {SECTIONS.map((s, i) => (
          <SectionRow key={s.title} s={s} isLast={i === SECTIONS.length - 1} />
        ))}
      </div>

      <style>{`
        .settings-row {
          display: flex; align-items: center; gap: 14px;
          padding: 16px 20px; transition: background 120ms;
        }
        .settings-row--link:hover { background: var(--surface-elevated); cursor: pointer; }
        .settings-row-icon { flex-shrink: 0; width: 36px; height: 36px; border-radius: 8px;
          background: var(--surface-elevated); display: flex; align-items: center;
          justify-content: center; color: var(--text-secondary); }
        .settings-row-body { flex: 1; min-width: 0; }
        .settings-row-title { font-weight: 600; font-size: 14px; margin-bottom: 2px; color: var(--text-primary); }
        .settings-row-desc { font-size: 12.5px; color: var(--text-tertiary); }
        .settings-row-btn { font-size: 12.5px; padding: 7px 14px; flex-shrink: 0; pointer-events: none; }
        .settings-toast {
          margin-bottom: 16px; padding: 10px 14px; border-radius: 8px; font-size: 13px;
        }
        .settings-toast--success {
          background: #dcfce7; border: 1px solid #86efac; color: #166534;
        }
        .settings-toast--error {
          background: #fef2f2; border: 1px solid #fecaca; color: #991b1b;
        }
      `}</style>
    </div>
  );
}
