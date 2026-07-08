import { MoreVerticalIcon } from '@/components/icons';

/** Menú kebab reutilizado en Clients.tsx, ProgramLibrary.tsx y ProgramEditor.tsx. */
export function CardMenu({
  open,
  onToggle,
  items,
}: {
  open: boolean;
  onToggle: () => void;
  items: { label: string; onClick: () => void; danger?: boolean }[];
}): React.JSX.Element {
  return (
    <div className="client-row-menu" onClick={(e) => e.stopPropagation()}>
      <button type="button" className="client-row-kebab" onClick={onToggle} aria-label="Más opciones">
        <MoreVerticalIcon size={18} />
      </button>
      {open && (
        <>
          <div className="client-row-menu-backdrop" onClick={onToggle} />
          <div className="client-row-menu-pop">
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                className={`client-row-menu-item${item.danger ? ' danger' : ''}`}
                onClick={() => { onToggle(); item.onClick(); }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
