import { SettingsIcon, BellIcon, BrushIcon, CreditCardIcon, UsersIcon } from '@/components/icons';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';

type SettingsSection = {
  icon: React.ReactNode;
  title: string;
  desc: string;
  action: string;
  to?: string;
};

const SECTIONS: SettingsSection[] = [
  { icon: <UsersIcon size={20} />, title: 'Perfil', desc: 'Nombre, foto y datos del entrenador.', action: 'Editar perfil' },
  { icon: <BrushIcon size={20} />, title: 'Marca de la app', desc: 'Nombre, colores y logo de tu app mobile.', action: 'Configurar', to: '/branding' },
  { icon: <CreditCardIcon size={20} />, title: 'Suscripción', desc: 'Plan actual, facturación y métodos de pago.', action: 'Ver plan' },
  { icon: <BellIcon size={20} />, title: 'Notificaciones', desc: 'Configurá qué alertas recibís por email y push.', action: 'Configurar' },
  { icon: <SettingsIcon size={20} />, title: 'Privacidad y seguridad', desc: 'Contraseña, sesiones activas y permisos.', action: 'Gestionar' },
];

export function SettingsPage(): React.JSX.Element {
  const { profile } = useAuth();
  const navigate = useNavigate();

  return (
    <div>
      <h1 className="page-title">Settings</h1>
      <p className="page-sub">Configurá tu cuenta y preferencias del panel.</p>

      {/* Profile card */}
      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <div className="avatar" style={{ width: 56, height: 56, fontSize: 20 }}>
          {profile?.full_name?.charAt(0).toUpperCase() ?? 'E'}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 650, fontSize: 16 }}>{profile?.full_name ?? 'Entrenador'}</div>
          <div style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>Entrenador · {profile?.role ?? 'trainer'}</div>
        </div>
        <button className="btn secondary">Editar foto</button>
      </div>

      {/* Settings list */}
      <div className="card" style={{ padding: 0 }}>
        {SECTIONS.map((s, i) => (
          <div
            key={s.title}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '16px 20px',
              borderBottom: i < SECTIONS.length - 1 ? '1px solid var(--border)' : 'none',
              cursor: 'pointer',
              transition: 'background 120ms',
            }}
            onClick={() => s.to && navigate(s.to)}
            className="row-clickable"
          >
            <div className="stat-ico" style={{ flexShrink: 0 }}>{s.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{s.title}</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>{s.desc}</div>
            </div>
            <button className="btn secondary" style={{ fontSize: 12.5, padding: '7px 14px', flexShrink: 0 }}>
              {s.action}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
