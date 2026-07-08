import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChatPanel } from '@/components/ChatPanel';
import { CommunityGroupChatPanel } from '@/components/CommunityGroupChatPanel';
import { GroupAvatar, UserAvatar } from '@/components/UserAvatar';
import { useInboxThreads, threadKey, type InboxThread } from '@/hooks/useInboxThreads';
import { MessageIcon, SettingsIcon, ChevronDownIcon } from '@/components/icons';

function relativeTime(iso: string): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'Ahora';
  if (min < 60) return `${min}h`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

/** Widget flotante bottom-right — reemplaza el link "Chats" del sidebar.
 * Reutiliza useInboxThreads (misma fuente que /messages) y ChatPanel/
 * CommunityGroupChatPanel para el hilo abierto. El botón "maximizar" navega
 * a /messages, opcionalmente con el hilo actual como query param. */
export function FloatingChatWidget(): React.JSX.Element {
  const navigate = useNavigate();
  const { threads, loading } = useInboxThreads();
  const [open, setOpen] = useState(false);
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const totalUnread = useMemo(() => threads.reduce((sum, t) => sum + t.unread, 0), [threads]);
  const active = threads.find((t) => threadKey(t) === activeKey) ?? null;

  const maximize = (thread: InboxThread | null) => {
    const params = thread ? (thread.kind === 'direct' ? `?client=${thread.id}` : `?group=${thread.id}`) : '';
    navigate(`/messages${params}`);
  };

  if (!open) {
    return (
      <button type="button" className="chat-widget-fab" onClick={() => setOpen(true)} aria-label="Abrir chats">
        <MessageIcon size={20} />
        {totalUnread > 0 && <span className="chat-widget-fab-badge">{totalUnread}</span>}
      </button>
    );
  }

  return (
    <div className="chat-widget-panel">
      <div className="chat-widget-header">
        {active ? (
          <button type="button" className="chat-widget-back" onClick={() => setActiveKey(null)}>‹</button>
        ) : (
          <span style={{ fontWeight: 700 }}>Chats</span>
        )}
        {active && (
          <div className="chat-widget-header-title">
            {active.kind === 'group' ? (
              <GroupAvatar name={active.name} url={active.avatarUrl} size="sm" />
            ) : (
              <UserAvatar name={active.name} url={active.avatarUrl} size="sm" />
            )}
            <span style={{ fontWeight: 650, fontSize: 13.5 }}>{active.name}</span>
          </div>
        )}
        <div className="chat-widget-header-actions">
          <button type="button" className="chat-widget-icon-btn" title="Maximizar" onClick={() => maximize(active)}>
            <SettingsIcon size={15} />
          </button>
          <button type="button" className="chat-widget-icon-btn" title="Minimizar" onClick={() => setOpen(false)}>
            <ChevronDownIcon size={15} />
          </button>
        </div>
      </div>

      {active ? (
        <div className="chat-widget-thread">
          {active.kind === 'direct' ? (
            <ChatPanel
              key={active.id}
              clientId={active.id}
              clientName={active.name}
              clientAvatar={active.avatarUrl}
              placeholder={`Escribile a ${active.name.split(' ')[0]}…`}
            />
          ) : (
            <CommunityGroupChatPanel key={active.id} communityId={active.id} />
          )}
        </div>
      ) : (
        <div className="chat-widget-list">
          {loading ? (
            <p className="muted" style={{ padding: 14, fontSize: 12.5 }}>Cargando…</p>
          ) : threads.length === 0 ? (
            <p className="muted" style={{ padding: 14, fontSize: 12.5 }}>Sin conversaciones todavía.</p>
          ) : (
            threads.map((t) => {
              const key = threadKey(t);
              return (
                <div key={key} className="chat-widget-thread-row" onClick={() => setActiveKey(key)} role="button" tabIndex={0}>
                  {t.kind === 'group' ? (
                    <GroupAvatar name={t.name} url={t.avatarUrl} size="sm" />
                  ) : (
                    <UserAvatar name={t.name} url={t.avatarUrl} size="sm" />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {t.kind === 'group' ? `👥 ${t.name}` : t.name}
                    </div>
                    <div className="muted" style={{ fontSize: 11.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {t.lastMsg || 'Sin mensajes todavía'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    <span className="muted" style={{ fontSize: 10.5 }}>{relativeTime(t.lastAt)}</span>
                    {t.unread > 0 && <span className="chat-widget-fab-badge" style={{ position: 'static' }}>{t.unread}</span>}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
