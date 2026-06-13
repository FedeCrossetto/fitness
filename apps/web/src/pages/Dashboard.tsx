import { useEffect, useState } from 'react';
import type { TrainerBrandingRow } from '@habito/shared/types/database';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

export function DashboardPage(): React.JSX.Element {
  const { session, profile } = useAuth();
  const userId = session?.user.id;
  const [studentCount, setStudentCount] = useState<number | null>(null);
  const [branding, setBranding] = useState<TrainerBrandingRow | null>(null);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    void (async () => {
      const [{ count }, { data }] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('trainer_id', userId),
        supabase.from('trainer_branding').select('*').maybeSingle(),
      ]);
      if (!active) return;
      setStudentCount(count ?? 0);
      setBranding((data as TrainerBrandingRow | null) ?? null);
    })();
    return () => {
      active = false;
    };
  }, [userId]);

  return (
    <div>
      <h1 className="page-title">Hola, {profile?.full_name ?? 'entrenador'}</h1>
      <p className="page-sub">Resumen de tu app.</p>

      <div className="grid">
        <div className="stat">
          <div className="n">{studentCount ?? '—'}</div>
          <div className="l">Alumnos</div>
        </div>
        <div className="stat">
          <div className="n">{branding?.app_name ?? '—'}</div>
          <div className="l">Nombre de la app</div>
        </div>
        <div className="stat">
          <div className="n">{branding?.invite_code ?? '—'}</div>
          <div className="l">Código de invitación</div>
        </div>
        <div className="stat">
          <div className="n" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              className="swatch"
              style={{ margin: 0, width: 28, height: 28, background: branding?.color_primary ?? 'var(--surface-elevated)' }}
            />
            {branding?.color_primary ?? '—'}
          </div>
          <div className="l">Color primario</div>
        </div>
      </div>
    </div>
  );
}
