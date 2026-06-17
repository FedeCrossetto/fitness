import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import {
  GridIcon, BrushIcon, UsersIcon, LogOutIcon, SearchIcon,
  MessageIcon, BellIcon, CalendarIcon, GroupsIcon, TrophyIcon, CreditCardIcon,
  BookOpenIcon, SettingsIcon, PlusIcon, ChevronDownIcon, ChevronRightIcon,
  MegaphoneIcon, PuzzleIcon,
} from '@/components/icons';

type NavItem = { to: string; label: string; end?: boolean; icon: () => React.JSX.Element; badge?: number };
type NavGroup = { section: string; items: NavItem[]; collapsible?: boolean };

const NAV: NavGroup[] = [
  {
    section: 'MAIN MENU',
    items: [
      { to: '/', label: 'Overview', end: true, icon: () => <GridIcon /> },
      { to: '/messages', label: 'Messages', icon: () => <MessageIcon />, badge: 3 },
      { to: '/groups', label: 'Groups', icon: () => <GroupsIcon /> },
      { to: '/challenges', label: 'Challenges', icon: () => <TrophyIcon /> },
      { to: '/students', label: 'Clients', icon: () => <UsersIcon /> },
      { to: '/payments', label: 'Payments', icon: () => <CreditCardIcon /> },
    ],
  },
  {
    section: 'CONTENT',
    collapsible: false,
    items: [
      { to: '/routines', label: 'Master Libraries', icon: () => <BookOpenIcon /> },
      { to: '/branding', label: 'Branding', icon: () => <BrushIcon /> },
      { to: '/scheduling', label: 'Scheduling', icon: () => <CalendarIcon /> },
      { to: '/announcements', label: 'Announcements', icon: () => <MegaphoneIcon /> },
    ],
  },
  {
    section: 'OTHER',
    items: [
      { to: '/add-ons', label: 'Add-ons', icon: () => <PuzzleIcon /> },
      { to: '/settings', label: 'Settings', icon: () => <SettingsIcon /> },
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
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [clientSearch, setClientSearch] = useState('');

  const toggleSection = (section: string) => {
    setCollapsed((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const handleClientSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && clientSearch.trim()) {
      navigate(`/students?q=${encodeURIComponent(clientSearch.trim())}`);
      setClientSearch('');
    }
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        {/* Brand */}
        <NavLink to="/" end className="brand" aria-label="Inicio">
          <img src="/logo_app_sin_fondo_cuadrado_1024.png" alt="" className="brand-logo" />
          <div className="brand-text">
            <span className="brand-name">CustomFit</span>
          </div>
        </NavLink>

        {/* Find a client */}
        <div className="sidebar-search">
          <SearchIcon size={14} />
          <input
            type="text"
            placeholder="Find a client"
            value={clientSearch}
            onChange={(e) => setClientSearch(e.target.value)}
            onKeyDown={handleClientSearch}
            aria-label="Buscar cliente"
          />
        </div>

        {/* Nav */}
        <nav className="nav">
          {NAV.map((group) => {
            const isCollapsed = collapsed[group.section] ?? false;
            return (
              <div key={group.section} className="nav-section">
                <button
                  className="nav-section-title"
                  onClick={() => toggleSection(group.section)}
                  aria-expanded={!isCollapsed}
                >
                  {group.section}
                  <span className={`nav-section-chevron${isCollapsed ? ' collapsed' : ''}`}>
                    <ChevronDownIcon size={12} />
                  </span>
                </button>
                {!isCollapsed && group.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                  >
                    <span className="nav-icon">{item.icon()}</span>
                    <span className="nav-label">{item.label}</span>
                    {item.badge ? (
                      <span className="nav-badge">{item.badge}</span>
                    ) : null}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>

        <div className="spacer" />

        {/* Footer */}
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
        {/* Topbar */}
        <div className="topbar">
          <div className="topbar-spacer" />
          <div className="topbar-actions">
            <button
              className="pill-btn pill-btn--outline"
              onClick={() => navigate('/branding')}
            >
              Invitar alumno
            </button>
            <button
              className="icon-action"
              onClick={() => navigate('/students')}
              aria-label="Agregar cliente"
            >
              <PlusIcon size={16} />
            </button>
            <button className="icon-action topbar-bell" aria-label="Notificaciones">
              <BellIcon size={16} />
              <span className="bell-dot" />
            </button>
            <div className="topbar-user" onClick={() => navigate('/settings')} role="button" tabIndex={0}>
              <div className="avatar avatar--sm">{initials(profile?.full_name).toUpperCase()}</div>
              <span className="topbar-username">{profile?.full_name ?? 'Entrenador'}</span>
              <ChevronRightIcon size={14} />
            </div>
          </div>
        </div>

        <div className="main-inner">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
