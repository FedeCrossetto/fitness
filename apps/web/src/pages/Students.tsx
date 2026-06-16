import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { ProfileRow } from '@habito/shared/types/database';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { SearchIcon, UsersIcon } from '@/components/icons';

type Student = Pick<ProfileRow, 'id' | 'full_name' | 'goal' | 'created_at'>;

function initials(name: string | null): string {
  if (!name) return 'A';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

export function StudentsPage(): React.JSX.Element {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const userId = session?.user.id;
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState(searchParams.get('q') ?? '');

  useEffect(() => {
    setQuery(searchParams.get('q') ?? '');
  }, [searchParams]);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    void (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, goal, created_at')
        .eq('trainer_id', userId)
        .order('full_name');
      if (active) {
        setStudents((data as Student[] | null) ?? []);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [userId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) => (s.full_name ?? '').toLowerCase().includes(q) || (s.goal ?? '').toLowerCase().includes(q)
    );
  }, [students, query]);

  return (
    <div>
      <h1 className="page-title">Alumnos</h1>
      <p className="page-sub">Las personas vinculadas a tu marca mediante el código de invitación.</p>

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
            {loading ? '…' : `${filtered.length} alumno${filtered.length === 1 ? '' : 's'}`}
          </span>
        </div>

        {loading ? (
          <div style={{ padding: 24 }} className="muted">
            Cargando…
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <span className="empty-ico"><UsersIcon size={22} /></span>
            <div className="t">
              {students.length === 0 ? 'Todavía no hay alumnos' : 'Sin resultados'}
            </div>
            <p className="muted" style={{ margin: 0 }}>
              {students.length === 0
                ? 'Compartí tu código de invitación para que se sumen al registrarse.'
                : 'Probá con otro término de búsqueda.'}
            </p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Alumno</th>
                <th>Objetivo</th>
                <th>Estado</th>
                <th>Se unió</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} className="row-clickable" onClick={() => navigate(`/students/${s.id}`)}>
                  <td>
                    <div className="cell-user">
                      <span className="avatar sm">{initials(s.full_name)}</span>
                      <span className="cell-name">{s.full_name ?? 'Alumno'}</span>
                    </div>
                  </td>
                  <td className="muted">{s.goal ?? '—'}</td>
                  <td>
                    <span className="badge active"><span className="dot" />Activo</span>
                  </td>
                  <td className="muted">{new Date(s.created_at).toLocaleDateString('es-AR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
