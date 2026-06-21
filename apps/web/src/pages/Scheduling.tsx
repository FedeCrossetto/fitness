import { CalendarIcon, PlusIcon } from '@/components/icons';

const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const HOURS = Array.from({ length: 10 }, (_, i) => `${8 + i}:00`);

const EVENTS = [
  { day: 0, hour: 9, label: 'Check-in Ezequiel', color: '#16181a' },
  { day: 1, hour: 10, label: 'Entreno grupal', color: '#16a34a' },
  { day: 2, hour: 8, label: 'Laura M.', color: '#f59e0b' },
  { day: 3, hour: 11, label: 'Clase online', color: '#16181a' },
  { day: 4, hour: 9, label: 'Marcos P.', color: '#16a34a' },
];

export function SchedulingPage(): React.JSX.Element {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>Scheduling</h1>
        <button className="btn" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <PlusIcon size={15} /> Nueva sesión
        </button>
      </div>
      <p className="page-sub">Organizá tus sesiones, clases grupales y check-ins semanales.</p>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
          <CalendarIcon size={16} />
          <span style={{ fontWeight: 650, fontSize: 15 }}>Semana actual</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <button className="btn secondary" style={{ padding: '6px 12px', fontSize: 12.5 }}>← Anterior</button>
            <button className="btn secondary" style={{ padding: '6px 12px', fontSize: 12.5 }}>Siguiente →</button>
          </div>
        </div>

        {/* Mini calendar grid */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', minWidth: 640 }}>
            <thead>
              <tr>
                <th style={{ width: 54, textAlign: 'right', paddingRight: 10, color: 'var(--text-tertiary)', fontSize: 11, fontWeight: 500, borderRight: '1px solid var(--border)' }} />
                {DAYS.map((d) => (
                  <th key={d} style={{ textAlign: 'center', padding: '10px 4px', fontSize: 12, fontWeight: 650, color: 'var(--text-secondary)', borderRight: '1px solid var(--border)' }}>
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {HOURS.map((hour, hi) => (
                <tr key={hour}>
                  <td style={{ textAlign: 'right', paddingRight: 10, fontSize: 11, color: 'var(--text-tertiary)', verticalAlign: 'top', paddingTop: 6, borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
                    {hour}
                  </td>
                  {DAYS.map((_, di) => {
                    const event = EVENTS.find((e) => e.day === di && e.hour === 8 + hi);
                    return (
                      <td key={di} style={{ height: 44, borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)', padding: 3, verticalAlign: 'top' }}>
                        {event && (
                          <div style={{
                            background: event.color + '22',
                            borderLeft: `3px solid ${event.color}`,
                            borderRadius: 4,
                            padding: '3px 6px',
                            fontSize: 11,
                            fontWeight: 550,
                            color: event.color,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            cursor: 'pointer',
                          }}>
                            {event.label}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
