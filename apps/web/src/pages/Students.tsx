import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import type { ProfileRow } from '@habito/shared/types/database';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { buildInviteLink, getJoinBaseUrl } from '@/lib/inviteClient';
import { SearchIcon, UsersIcon } from '@/components/icons';

type Student = Pick<ProfileRow, 'id' | 'full_name' | 'goal' | 'created_at' | 'avatar_url'> & {
  client_status: 'pending' | 'active';
};

function initials(name: string | null): string {
  if (!name) return 'A';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

function StudentAvatar({ name, url, style }: { name: string | null; url?: string | null; style?: React.CSSProperties }): React.JSX.Element {
  if (url) {
    return (
      <span className="avatar sm" style={{ padding: 0, overflow: 'hidden', ...style }}>
        <img src={url} alt={name ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} />
      </span>
    );
  }
  return <span className="avatar sm" style={style}>{initials(name)}</span>;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86400000);
  if (d === 0) return 'Hoy';
  if (d === 1) return 'Ayer';
  if (d < 30) return `Hace ${d} días`;
  const m = Math.floor(d / 30);
  return `Hace ${m} mes${m > 1 ? 'es' : ''}`;
}

export function StudentsPage(): React.JSX.Element {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const userId = session?.user.id;
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState(searchParams.get('q') ?? '');
  const [tab, setTab] = useState<'active' | 'pending'>('active');
  const [activating, setActivating] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);

  const inviteLink = inviteCode ? buildInviteLink(inviteCode, getJoinBaseUrl()) : null;

  useEffect(() => { setQuery(searchParams.get('q') ?? ''); }, [searchParams]);

  const loadStudents = () => {
    if (!userId) return;
    void (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, goal, created_at, client_status, avatar_url')
        .eq('trainer_id', userId)
        .order('created_at', { ascending: false });
      setStudents((data as Student[] | null) ?? []);
      setLoading(false);
    })();
  };

  useEffect(loadStudents, [userId]);

  // Load invite code from trainer_branding
  useEffect(() => {
    if (!userId) return;
    void (async () => {
      const { data } = await supabase
        .from('trainer_branding')
        .select('invite_code')
        .eq('trainer_id', userId)
        .maybeSingle();
      if (data && 'invite_code' in data) setInviteCode((data as { invite_code: string }).invite_code);
    })();
  }, [userId]);

  const copyLink = () => {
    if (!inviteLink) return;
    void navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const activate = async (id: string) => {
    setActivating(id);
    await supabase.from('profiles').update({ client_status: 'active' } as never).eq('id', id);
    setStudents((prev) => prev.map((s) => s.id === id ? { ...s, client_status: 'active' } : s));
    setActivating(null);
  };

  const active  = useMemo(() => students.filter((s) => s.client_status !== 'pending'), [students]);
  const pending = useMemo(() => students.filter((s) => s.client_status === 'pending'),  [students]);
  const current = tab === 'active' ? active : pending;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return current;
    return current.filter(
      (s) => (s.full_name ?? '').toLowerCase().includes(q) || (s.goal ?? '').toLowerCase().includes(q)
    );
  }, [current, query]);

  return (
    <div>
      <div className="students-page-header">
        <div>
          <h1 className="page-title">Clientes</h1>
          <p className="page-sub">Personas vinculadas a tu marca.</p>
        </div>
      </div>

      {/* Invite banner */}
      {inviteCode && inviteLink && (
        <div className="invite-banner">
          <div className="invite-banner-left">
            <div className="invite-banner-icon">🔗</div>
            <div>
              <div className="invite-banner-title">Link de invitación</div>
              <div className="invite-banner-sub">
                Enviá este link por WhatsApp o email. El alumno se registra con Google o email y queda vinculado automáticamente.
              </div>
            </div>
          </div>
          <div className="invite-banner-right">
            <div className="invite-code-box" style={{ maxWidth: 320 }}>
              <span className="invite-code-text" style={{ fontSize: 12, letterSpacing: 0, wordBreak: 'break-all' }}>{inviteLink}</span>
              <button className="invite-copy-btn" onClick={copyLink} title="Copiar link">
                {copied ? '✓ Copiado' : 'Copiar link'}
              </button>
            </div>
            <button
              className="invite-qr-btn"
              onClick={() => setShowQR((v) => !v)}
              title="Ver QR"
            >
              QR
            </button>
          </div>
        </div>
      )}

      {/* QR modal */}
      {showQR && inviteLink && (
        <div className="invite-qr-backdrop" onClick={() => setShowQR(false)}>
          <div className="invite-qr-modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>QR de invitación</div>
            <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 20 }}>
              El alumno escanea y se registra con Google o email en un minuto
            </div>
            <QRCodeSVG value={inviteLink} size={200} />
            <div style={{ marginTop: 16, fontSize: 11, color: 'var(--text-tertiary)', wordBreak: 'break-all', textAlign: 'center', padding: '0 8px' }}>
              {inviteLink}
            </div>
            <button className="btn secondary" style={{ marginTop: 20, width: '100%' }} onClick={() => setShowQR(false)}>
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="students-tabs">
        <button
          className={`students-tab${tab === 'active' ? ' active' : ''}`}
          onClick={() => setTab('active')}
        >
          Activos
          <span className="students-tab-count">{active.length}</span>
        </button>
        <button
          className={`students-tab${tab === 'pending' ? ' active' : ''}`}
          onClick={() => setTab('pending')}
        >
          Pendientes
          {pending.length > 0 && <span className="students-tab-count pending">{pending.length}</span>}
        </button>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-toolbar">
          <div className="search-field">
            <SearchIcon size={16} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre u objetivo…"
            />
          </div>
          <span className="row-count">
            {loading ? '…' : `${filtered.length} cliente${filtered.length === 1 ? '' : 's'}`}
          </span>
        </div>

        {loading ? (
          <div style={{ padding: 28 }} className="muted">Cargando…</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <span className="empty-ico"><UsersIcon size={22} /></span>
            <div className="t">
              {tab === 'active'
                ? (students.length === 0 ? 'Todavía no hay alumnos' : 'Sin resultados')
                : 'Sin clientes pendientes'}
            </div>
            <p className="muted" style={{ margin: 0 }}>
              {tab === 'active' && students.length === 0
                ? 'Compartí tu código de invitación para que se sumen al registrarse.'
                : tab === 'pending'
                  ? 'Cuando un alumno se registre aparecerá aquí para que lo apruebes.'
                  : 'Probá con otro término de búsqueda.'}
            </p>
          </div>
        ) : tab === 'active' ? (
          /* ── Active table ── */
          <table>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Objetivo</th>
                <th>Se unió</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} className="row-clickable" onClick={() => navigate(`/students/${s.id}`)}>
                  <td>
                    <div className="cell-user">
                      <StudentAvatar name={s.full_name} url={s.avatar_url} />
                      <div>
                        <div className="cell-name">{s.full_name ?? 'Alumno'}</div>
                        <div className="cell-sub">Acceso completo</div>
                      </div>
                    </div>
                  </td>
                  <td className="muted">{s.goal ?? '—'}</td>
                  <td className="muted">{timeAgo(s.created_at)}</td>
                  <td>
                    <button
                      className="btn secondary sm"
                      onClick={(e) => { e.stopPropagation(); navigate(`/students/${s.id}`); }}
                    >
                      Abrir →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          /* ── Pending table ── */
          <table>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Objetivo</th>
                <th>Solicitó</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id}>
                  <td>
                    <div className="cell-user">
                      <StudentAvatar name={s.full_name} url={s.avatar_url} style={!s.avatar_url ? { background: '#fef3c7', color: '#92400e' } : undefined} />
                      <div>
                        <div className="cell-name">{s.full_name ?? 'Nuevo alumno'}</div>
                        <div className="cell-sub">Esperando aprobación</div>
                      </div>
                    </div>
                  </td>
                  <td className="muted">{s.goal ?? '—'}</td>
                  <td className="muted">{timeAgo(s.created_at)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        className="btn primary sm"
                        onClick={() => void activate(s.id)}
                        disabled={activating === s.id}
                      >
                        {activating === s.id ? '…' : 'Activar'}
                      </button>
                      <button
                        className="btn secondary sm"
                        onClick={() => navigate(`/students/${s.id}`)}
                      >
                        Ver perfil
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <style>{`
        /* Invite banner */
        .invite-banner {
          display: flex; align-items: center; justify-content: space-between; gap: 20px;
          background: color-mix(in srgb, var(--primary) 6%, var(--surface));
          border: 1.5px solid color-mix(in srgb, var(--primary) 20%, transparent);
          border-radius: var(--radius); padding: 16px 20px; margin-bottom: 20px;
          flex-wrap: wrap;
        }
        .invite-banner-left { display: flex; align-items: flex-start; gap: 14px; flex: 1; min-width: 0; }
        .invite-banner-icon { font-size: 22px; flex-shrink: 0; margin-top: 1px; }
        .invite-banner-title { font-weight: 700; font-size: 14px; color: var(--text-primary); margin-bottom: 3px; }
        .invite-banner-sub { font-size: 12.5px; color: var(--text-secondary); line-height: 1.5; }
        .invite-banner-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
        .invite-code-box {
          display: flex; align-items: center; gap: 0;
          border: 1.5px solid var(--border-strong); border-radius: 8px; overflow: hidden;
          background: var(--surface);
        }
        .invite-code-text {
          font-family: monospace; font-size: 17px; font-weight: 700; letter-spacing: 3px;
          padding: 8px 16px; color: var(--text-primary); text-transform: uppercase;
        }
        .invite-copy-btn {
          padding: 8px 14px; background: var(--accent); color: var(--accent-contrast);
          border: none; cursor: pointer; font-size: 12.5px; font-weight: 600;
          transition: opacity 150ms; white-space: nowrap;
        }
        .invite-copy-btn:hover { opacity: .85; }
        .invite-qr-btn {
          padding: 8px 14px; background: var(--surface-elevated);
          border: 1.5px solid var(--border-strong); border-radius: 8px;
          cursor: pointer; font-size: 12.5px; font-weight: 700; color: var(--text-secondary);
          transition: background 120ms;
        }
        .invite-qr-btn:hover { background: var(--surface-hover); }

        /* QR modal */
        .invite-qr-backdrop {
          position: fixed; inset: 0; z-index: 9999;
          background: rgba(0,0,0,.45); backdrop-filter: blur(4px);
          display: flex; align-items: center; justify-content: center;
        }
        .invite-qr-modal {
          background: var(--surface); border-radius: var(--radius-lg); padding: 32px;
          display: flex; flex-direction: column; align-items: center;
          box-shadow: 0 24px 80px rgba(0,0,0,.25); min-width: 300px;
        }

        .students-page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 4px; }
        .students-tabs { display: flex; gap: 0; margin-bottom: 16px; border-bottom: 2px solid var(--border); }
        .students-tab {
          display: flex; align-items: center; gap: 7px;
          padding: 9px 18px; font-size: 13.5px; font-weight: 600;
          color: var(--text-tertiary); background: none; border: none; cursor: pointer;
          border-bottom: 2px solid transparent; margin-bottom: -2px;
          transition: color 150ms;
        }
        .students-tab:hover { color: var(--text-primary); }
        .students-tab.active { color: var(--text-primary); border-bottom-color: var(--primary); }
        .students-tab-count {
          min-width: 20px; height: 18px; padding: 0 5px;
          background: var(--surface-elevated); color: var(--text-secondary);
          border-radius: 9px; font-size: 11px; font-weight: 700;
          display: flex; align-items: center; justify-content: center;
        }
        .students-tab-count.pending { background: #fef3c7; color: #92400e; }
        .cell-sub { font-size: 11.5px; color: var(--text-tertiary); margin-top: 1px; }
        .btn.sm { font-size: 12px; padding: 5px 12px; }
      `}</style>
    </div>
  );
}
