import { useState } from 'react';
import { TrophyIcon, PlusIcon, CalendarIcon } from '@/components/icons';

type Challenge = {
  id: string;
  name: string;
  participants: number;
  start: string;
  end: string;
  status: 'active' | 'upcoming' | 'ended';
};

const MOCK: Challenge[] = [
  { id: '1', name: '30 días de fuerza', participants: 8, start: '2026-06-01', end: '2026-06-30', status: 'active' },
  { id: '2', name: 'Cardio de julio', participants: 5, start: '2026-07-01', end: '2026-07-31', status: 'upcoming' },
];

const STATUS_LABELS: Record<Challenge['status'], string> = {
  active: 'Activo',
  upcoming: 'Próximo',
  ended: 'Finalizado',
};
const STATUS_CLASS: Record<Challenge['status'], string> = {
  active: 'badge solid green',
  upcoming: 'badge solid amber',
  ended: 'badge solid gray',
};

export function ChallengesPage(): React.JSX.Element {
  const [challenges] = useState<Challenge[]>(MOCK);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>Challenges</h1>
        <button className="btn" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <PlusIcon size={15} /> Nuevo desafío
        </button>
      </div>
      <p className="page-sub">Motivá a tus alumnos con desafíos grupales y de tiempo limitado.</p>

      {challenges.length === 0 ? (
        <div className="card page-empty">
          <div className="page-empty-ico"><TrophyIcon size={24} /></div>
          <h2>No hay desafíos activos</h2>
          <p>Creá tu primer desafío para motivar a tus alumnos con metas compartidas y rankings.</p>
          <button className="btn">Crear desafío</button>
        </div>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
          {challenges.map((c) => (
            <div key={c.id} className="card" style={{ cursor: 'pointer', marginBottom: 0 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                <div className="stat-ico" style={{ background: 'var(--surface-elevated)' }}>
                  <TrophyIcon size={18} />
                </div>
                <span className={STATUS_CLASS[c.status]}>{STATUS_LABELS[c.status]}</span>
              </div>
              <div style={{ fontWeight: 650, fontSize: 16, marginBottom: 6 }}>{c.name}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-tertiary)', fontSize: 12.5, marginBottom: 4 }}>
                <CalendarIcon size={13} />
                {new Date(c.start).toLocaleDateString('es-AR')} → {new Date(c.end).toLocaleDateString('es-AR')}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                {c.participants} participante{c.participants !== 1 ? 's' : ''}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
