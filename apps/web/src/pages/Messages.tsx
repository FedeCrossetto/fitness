import { useState } from 'react';
import { MessageIcon, SearchIcon } from '@/components/icons';

const MOCK_THREADS = [
  { id: '1', name: 'Ezequiel Amado', lastMsg: 'Gracias por el plan! 💪', time: 'Hace 2h', unread: 2, online: true },
  { id: '2', name: 'Laura Martínez', lastMsg: 'Cuándo es el próximo check-in?', time: 'Hace 5h', unread: 1, online: false },
  { id: '3', name: 'Marcos Pérez', lastMsg: 'Completé el entreno de hoy', time: 'Ayer', unread: 0, online: true },
  { id: '4', name: 'Sol Fernández', lastMsg: 'Ok, lo intento mañana', time: 'Ayer', unread: 0, online: false },
  { id: '5', name: 'Diego Torres', lastMsg: 'Tengo dolor en la espalda baja', time: 'Lun', unread: 0, online: false },
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

export function MessagesPage(): React.JSX.Element {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  const threads = MOCK_THREADS.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  const selectedThread = MOCK_THREADS.find((t) => t.id === selected);

  return (
    <div>
      <h1 className="page-title">Messages</h1>
      <p className="page-sub">Comunicación directa con tus alumnos.</p>

      <div className="messages-layout card" style={{ padding: 0 }}>
        {/* Thread list */}
        <div className="messages-sidebar">
          <div className="table-toolbar" style={{ padding: '12px 14px' }}>
            <div className="search-field" style={{ width: '100%' }}>
              <SearchIcon size={14} />
              <input
                placeholder="Buscar conversación..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="thread-list">
            {threads.map((t) => (
              <div
                key={t.id}
                className={`thread-row${selected === t.id ? ' active' : ''}`}
                onClick={() => setSelected(t.id)}
                role="button"
                tabIndex={0}
              >
                <div className="thread-avatar">
                  <div className="avatar">{initials(t.name)}</div>
                  {t.online && <span className="online-dot" />}
                </div>
                <div className="thread-body">
                  <div className="thread-name">{t.name}</div>
                  <div className="thread-last">{t.lastMsg}</div>
                </div>
                <div className="thread-meta">
                  <span className="thread-time">{t.time}</span>
                  {t.unread > 0 && <span className="thread-badge">{t.unread}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Chat area */}
        <div className="messages-chat">
          {selectedThread ? (
            <div className="chat-empty" style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--text-tertiary)' }}>
              <MessageIcon size={32} />
              <p style={{ margin: 0, fontSize: 14 }}>Chat con <strong style={{ color: 'var(--text-primary)' }}>{selectedThread.name}</strong></p>
              <p style={{ margin: 0, fontSize: 12 }}>El chat en tiempo real está disponible en la versión completa.</p>
            </div>
          ) : (
            <div className="chat-empty">
              <MessageIcon size={40} />
              <p>Seleccioná una conversación para empezar</p>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .messages-layout { display: flex; height: 600px; overflow: hidden; }
        .messages-sidebar { width: 280px; flex-shrink: 0; border-right: 1px solid var(--border); display: flex; flex-direction: column; }
        .thread-list { flex: 1; overflow-y: auto; }
        .thread-row { display: flex; align-items: center; gap: 10px; padding: 12px 14px; cursor: pointer; transition: background 120ms; border-bottom: 1px solid var(--border); }
        .thread-row:hover { background: var(--surface-elevated); }
        .thread-row.active { background: var(--surface-hover); }
        .thread-avatar { position: relative; flex-shrink: 0; }
        .online-dot { position: absolute; bottom: 0; right: 0; width: 9px; height: 9px; border-radius: 50%; background: var(--green); border: 1.5px solid var(--surface); }
        .thread-body { flex: 1; min-width: 0; }
        .thread-name { font-size: 13.5px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .thread-last { font-size: 12px; color: var(--text-tertiary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 1px; }
        .thread-meta { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0; }
        .thread-time { font-size: 11px; color: var(--text-tertiary); }
        .thread-badge { min-width: 18px; height: 18px; padding: 0 5px; background: var(--accent); color: var(--accent-contrast); border-radius: 999px; font-size: 10px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
        .messages-chat { flex: 1; display: flex; align-items: center; justify-content: center; }
        .chat-empty { display: flex; flex-direction: column; align-items: center; gap: 10px; color: var(--text-tertiary); text-align: center; }
        .chat-empty p { margin: 0; font-size: 14px; }
      `}</style>
    </div>
  );
}
