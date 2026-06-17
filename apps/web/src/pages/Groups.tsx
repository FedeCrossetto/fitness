import { GroupsIcon, PlusIcon } from '@/components/icons';
import { useNavigate } from 'react-router-dom';

export function GroupsPage(): React.JSX.Element {
  const navigate = useNavigate();
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>Groups</h1>
        <button className="btn" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <PlusIcon size={15} /> Nuevo grupo
        </button>
      </div>
      <p className="page-sub">Organizá tus alumnos en grupos para entrenamientos compartidos.</p>

      <div className="card page-empty" style={{ marginTop: 12 }}>
        <div className="page-empty-ico"><GroupsIcon size={24} /></div>
        <h2>Todavía no tenés grupos</h2>
        <p>
          Creá grupos para enviar planes de entrenamiento a varios alumnos a la vez,
          hacer check-ins colectivos y gestionar desafíos grupales.
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn" onClick={() => navigate('/students')}>
            Ver alumnos
          </button>
          <button className="btn secondary">Saber más</button>
        </div>
      </div>
    </div>
  );
}
