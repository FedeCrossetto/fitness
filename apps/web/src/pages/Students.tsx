import { useEffect, useState } from 'react';
import type { ProfileRow } from '@habito/shared/types/database';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

type Student = Pick<ProfileRow, 'id' | 'full_name' | 'goal' | 'created_at'>;

export function StudentsPage(): React.JSX.Element {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div>
      <h1 className="page-title">Alumnos</h1>
      <p className="page-sub">Las personas vinculadas a tu marca mediante el código de invitación.</p>

      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div style={{ padding: 24 }} className="muted">
            Cargando…
          </div>
        ) : students.length === 0 ? (
          <div style={{ padding: 24 }} className="muted">
            Todavía no hay alumnos vinculados. Compartí tu código de invitación para que se sumen al registrarse.
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Objetivo</th>
                <th>Se unió</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id}>
                  <td>{s.full_name ?? 'Alumno'}</td>
                  <td className="muted">{s.goal ?? '—'}</td>
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
