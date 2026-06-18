import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from '@/hooks/useTranslation';
import { useUnreadMessages } from '@/hooks/useUnreadMessages';
import { LANGUAGES } from '@habito/shared';
import {
  GridIcon, BrushIcon, UsersIcon, LogOutIcon,
  MessageIcon, CalendarIcon, GroupsIcon, TrophyIcon, CreditCardIcon,
  BookOpenIcon, SettingsIcon, ChevronDownIcon, ChevronRightIcon,
  MegaphoneIcon,
} from '@/components/icons';

// ── Types ─────────────────────────────────────────────────────────────────────

type NavItem  = { to: string; label: string; end?: boolean; icon: () => React.JSX.Element; badge?: number; mock?: boolean };
type NavGroup = { section: string; items: NavItem[] };

// ── Collapse toggle icon ───────────────────────────────────────────────────────

function CollapseIcon({ collapsed }: { collapsed: boolean }): React.JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      {collapsed
        ? <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        : <path d="M10 3L5 8l5 5"  stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      }
    </svg>
  );
}

function initials(name: string | null | undefined): string {
  if (!name) return 'E';
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '');
}

function Avatar({ name, url, size = 'md', title }: { name?: string | null; url?: string | null; size?: 'md' | 'sm'; title?: string }): React.JSX.Element {
  const cls = `avatar${size === 'sm' ? ' avatar--sm' : ''}`;
  if (url) {
    return (
      <div className={cls} title={title} style={{ padding: 0, overflow: 'hidden' }}>
        <img src={url} alt={name ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} />
      </div>
    );
  }
  return <div className={cls} title={title}>{initials(name).toUpperCase()}</div>;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function Layout(): React.JSX.Element {
  const { profile, signOut, isAdmin, isTrainer } = useAuth();
  const { t, language, setLanguage } = useTranslation();
  const unreadMessages = useUnreadMessages();
  const navigate = useNavigate();
  const location = useLocation();
  const isOverview = location.pathname === '/';

  const [collapsed,        setCollapsed]        = useState<Record<string, boolean>>({});
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() =>
    localStorage.getItem('sb-collapsed') === '1'
  );

  const toggleSidebar = () => {
    setSidebarCollapsed((v) => {
      const next = !v;
      localStorage.setItem('sb-collapsed', next ? '1' : '0');
      return next;
    });
  };

  const toggleSection = (section: string) => {
    setCollapsed((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  // Build translated nav — rebuilt on every language change because `t` reference changes
  const NAV: NavGroup[] = [
    {
      section: t.web.nav_main,
      items: [
        { to: '/',          label: t.web.overview,      end: true, icon: () => <GridIcon />      },
        { to: '/messages',  label: t.web.messages,                 icon: () => <MessageIcon />,  badge: unreadMessages || undefined },
        { to: '/groups',    label: t.web.groups,                   icon: () => <GroupsIcon />    },
        { to: '/challenges',label: t.web.challenges,               icon: () => <TrophyIcon />,   mock: true },
        { to: '/students',  label: t.web.clients,                  icon: () => <UsersIcon />     },
        { to: '/payments',  label: t.web.payments,                 icon: () => <CreditCardIcon />, mock: true },
      ],
    },
    {
      section: t.web.nav_content,
      items: [
        { to: '/routines',      label: t.web.libraries,      icon: () => <BookOpenIcon /> },
        { to: '/branding',      label: t.web.branding,       icon: () => <BrushIcon />   },
        { to: '/scheduling',    label: t.web.scheduling,     icon: () => <CalendarIcon />, mock: true },
        { to: '/announcements', label: t.web.announcements,  icon: () => <MegaphoneIcon />},
      ],
    },
    {
      section: t.web.nav_other,
      items: [
        { to: '/settings', label: t.web.settings, icon: () => <SettingsIcon /> },
      ],
    },
  ];

  const sc = sidebarCollapsed;

  return (
    <div className="app-shell">
      <aside className={`sidebar${sc ? ' sidebar--collapsed' : ''}`}>

        {/* Brand + collapse toggle row */}
        <div className="sidebar-top">
          <NavLink to="/" end className="brand" aria-label="Inicio">
            <img src="/logo_app_sin_fondo_cuadrado_1024.png" alt="" className="brand-logo" />
            {!sc && (
              <div className="brand-text">
                <span className="brand-name">CustomFit</span>
              </div>
            )}
          </NavLink>
          <button
            className="sidebar-collapse-btn"
            onClick={toggleSidebar}
            title={sc ? t.web.expand : t.web.collapse}
            aria-label={sc ? t.web.expand : t.web.collapse}
          >
            <CollapseIcon collapsed={sc} />
          </button>
        </div>

        {/* Nav */}
        <nav className="nav">
          {NAV.map((group) => {
            const isCollapsed = collapsed[group.section] ?? false;
            return (
              <div key={group.section} className="nav-section">
                {!sc && (
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
                )}
                {!isCollapsed && group.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }: { isActive: boolean }) => `nav-link${isActive ? ' active' : ''}`}
                    title={sc ? item.label : undefined}
                  >
                    <span className="nav-icon">{item.icon()}</span>
                    {!sc && <span className="nav-label">{item.label}</span>}
                    {!sc && item.badge ? (
                      <span className="nav-badge">{item.badge}</span>
                    ) : null}
                    {!sc && item.mock ? (
                      <span className="nav-mock" title="Datos simulados — aún no conectado">mock</span>
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
          <div className={`user-card${sc ? ' user-card--compact' : ''}`}>
            <Avatar name={profile?.full_name} url={profile?.avatar_url} title={sc ? (profile?.full_name ?? 'Entrenador') : undefined} />
            {!sc && (
              <div className="user-meta">
                <span className="user-name">{profile?.full_name ?? 'Entrenador'}</span>
                <span className={`role-badge ${isAdmin ? 'admin' : 'trainer'}`}>
                  {isAdmin ? t.web.role_admin : isTrainer ? t.web.role_trainer : t.web.role_user}
                </span>
              </div>
            )}
            <button className="signout" onClick={() => void signOut()} aria-label={t.auth.sign_out} title={t.auth.sign_out}>
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
            {/* Language toggle */}
            <div className="lang-toggle" role="group" aria-label="Language">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  className={`lang-btn${language === lang.code ? ' active' : ''}`}
                  onClick={() => setLanguage(lang.code)}
                  title={lang.label}
                >
                  {lang.flag} {lang.code.toUpperCase()}
                </button>
              ))}
            </div>
            <div className="topbar-user" onClick={() => navigate('/settings')} role="button" tabIndex={0}>
              <Avatar name={profile?.full_name} url={profile?.avatar_url} size="sm" />
              <span className="topbar-username">{profile?.full_name ?? 'Entrenador'}</span>
              <ChevronRightIcon size={14} />
            </div>
          </div>
        </div>

        <div className={`main-inner${isOverview ? ' full-width' : ''}`}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
