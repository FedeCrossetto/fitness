import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { GridIcon, BrushIcon, UsersIcon, DumbbellIcon, LogOutIcon } from '@/components/icons';

type NavItem = { to: string; label: string; end?: boolean; icon: () => React.JSX.Element };

const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: 'General',
    items: [
      { to: '/', label: 'Dashboard', end: true, icon: () => <GridIcon /> },
      { to: '/students', label: 'Alumnos', icon: () => <UsersIcon /> },
    ],
  },
  {
    section: 'App mobile',
    items: [
      { to: '/branding', label: 'Marca', icon: () => <BrushIcon /> },
      { to: '/routines', label: 'Rutinas', icon: () => <DumbbellIcon /> },
    ],
  },
];

function initials(name: string | null | undefined): string {
  if (!name) return 'E';
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '');
}

export function Layout(): React.JSX.Element {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <NavLink to="/" end className="brand" aria-label="Inicio">
          <img src="/logo_app_sin_fondo_cuadrado_1024.png" alt="" className="brand-logo" />
          <div className="brand-text">
            <span className="brand-name">CustomFit</span>
          </div>
        </NavLink>

        <nav className="nav">
          {NAV.map((group) => (
            <div key={group.section} className="nav-section">
              <span className="nav-section-title">{group.section}</span>
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                >
                  <span className="nav-icon">{item.icon()}</span>
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="spacer" />

        <div className="sidebar-footer">
          <div className="user-card">
            <div className="avatar">{initials(profile?.full_name).toUpperCase()}</div>
            <div className="user-meta">
              <span className="user-name">{profile?.full_name ?? 'Entrenador'}</span>
              <span className="user-role">Entrenador</span>
            </div>
            <button className="signout" onClick={() => void signOut()} aria-label="Cerrar sesión">
              <LogOutIcon size={16} />
            </button>
          </div>
        </div>
      </aside>
      <main className="main">
        <div className="topbar">
          <div className="topbar-spacer" />
          <div className="topbar-actions">
            <button className="pill-btn" onClick={() => navigate('/branding')}>
              Invitar alumno
            </button>
          </div>
        </div>
        <div className="main-inner">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
