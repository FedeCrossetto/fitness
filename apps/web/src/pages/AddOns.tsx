import { PuzzleIcon } from '@/components/icons';

const ADDONS = [
  { name: 'AI Workout Builder', desc: 'Generá planes de entrenamiento personalizados con inteligencia artificial.', badge: 'BETA', enabled: false },
  { name: 'Nutrition Tracking', desc: 'Seguimiento de macros y calorías integrado con la app mobile.', badge: null, enabled: true },
  { name: 'Progress Photos', desc: 'Comparativas de fotos antes/después para visualizar el progreso.', badge: null, enabled: true },
  { name: 'Video Exercise Library', desc: 'Más de 3.000 videos de ejercicios con instrucciones detalladas.', badge: 'PRO', enabled: false },
  { name: 'White Label App', desc: 'Publicá tu propia app con tu marca en App Store y Google Play.', badge: 'PRO', enabled: false },
];

export function AddOnsPage(): React.JSX.Element {
  return (
    <div>
      <h1 className="page-title">Add-ons</h1>
      <p className="page-sub">Potenciá tu panel con funcionalidades adicionales.</p>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
        {ADDONS.map((a) => (
          <div key={a.name} className="card" style={{ marginBottom: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="stat-ico"><PuzzleIcon size={16} /></div>
                <span style={{ fontWeight: 650, fontSize: 14 }}>{a.name}</span>
              </div>
              {a.badge && (
                <span className={`badge solid ${a.badge === 'PRO' ? 'violet' : 'amber'}`} style={{ flexShrink: 0 }}>
                  {a.badge}
                </span>
              )}
            </div>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>{a.desc}</p>
            <button className={`btn${a.enabled ? ' secondary' : ''}`} style={{ alignSelf: 'flex-start', fontSize: 12.5, padding: '7px 14px' }}>
              {a.enabled ? 'Configurar' : 'Activar'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
