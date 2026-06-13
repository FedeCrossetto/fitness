import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

const NAV = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/branding', label: 'Marca', end: false },
  { to: '/students', label: 'Alumnos', end: false },
  { to: '/routines', label: 'Rutinas', end: false },
];

export function Layout(): React.JSX.Element {
  const { profile, signOut } = useAuth();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          Habito<span>.</span> <span className="muted" style={{ fontSize: 12 }}>admin</span>
        </div>
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            {item.label}
          </NavLink>
        ))}
        <div className="spacer" />
        <div className="muted" style={{ padding: '0 12px 8px', fontSize: 13 }}>
          {profile?.full_name ?? 'Entrenador'}
        </div>
        <button className="signout" onClick={() => void signOut()}>
          Cerrar sesión
        </button>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
