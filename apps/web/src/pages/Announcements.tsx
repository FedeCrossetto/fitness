import { MegaphoneIcon, PlusIcon } from '@/components/icons';

export function AnnouncementsPage(): React.JSX.Element {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>Announcements</h1>
        <button className="btn" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <PlusIcon size={15} /> Nuevo anuncio
        </button>
      </div>
      <p className="page-sub">Enviá comunicados a todos tus alumnos o a grupos específicos.</p>

      <div className="card page-empty">
        <div className="page-empty-ico"><MegaphoneIcon size={24} /></div>
        <h2>Sin anuncios enviados</h2>
        <p>
          Usá los anuncios para informar novedades, cambios de horario o motivar
          a todos tus alumnos con un mensaje masivo.
        </p>
        <button className="btn">Crear primer anuncio</button>
      </div>
    </div>
  );
}
