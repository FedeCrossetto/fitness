import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { ProfileRow } from '@habito/shared/types/database';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { SearchIcon, UsersIcon } from '@/components/icons';

type Student = Pick<ProfileRow, 'id' | 'full_name' | 'goal' | 'created_at'> & {
  client_status: 'pending' | 'active';
};

function initials(name: string | null): string {
  if (!name) return 'A';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
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

  useEffect(() => { setQuery(searchParams.get('q') ?? ''); }, [searchParams]);

  const loadStudents = () => {
    if (!userId) return;
    void (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, goal, created_at, client_status')
        .eq('trainer_id', userId)
        .order('created_at', { ascending: false });
      setStudents((data as Student[] | null) ?? []);
      setLoading(false);
    })();
  };

  useEffect(loadStudents, [userId]);

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
                      <span className="avatar sm">{initials(s.full_name)}</span>
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
                      <span className="avatar sm" style={{ background: '#fef3c7', color: '#92400e' }}>
                        {initials(s.full_name)}
                      </span>
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
