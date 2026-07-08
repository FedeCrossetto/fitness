import { useCallback, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChatPanel } from '@/components/ChatPanel';
import { CommunityGroupChatPanel } from '@/components/CommunityGroupChatPanel';
import { MessageIcon, SearchIcon } from '@/components/icons';
import { LoadingRows, EmptyState } from '@/components/ui';
import { GroupAvatar, UserAvatar } from '@/components/UserAvatar';
import { useInboxThreads, threadKey, type InboxThread } from '@/hooks/useInboxThreads';

type InboxFilter = 'all' | 'direct' | 'group';

function relativeTime(iso: string): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'Ahora';
  if (min < 60) return `Hace ${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `Hace ${h}h`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'Ayer';
  if (d < 7) return `Hace ${d}d`;
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
}

export function MessagesPage(): React.JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<InboxFilter>('all');
  const { threads, loading, reload: loadThreads } = useInboxThreads();

  const selectedKey = useMemo(() => {
    const client = searchParams.get('client');
    const group = searchParams.get('group');
    if (client) return `direct:${client}`;
    if (group) return `group:${group}`;
    return null;
  }, [searchParams]);

  const selectThread = useCallback((thread: InboxThread | null) => {
    if (!thread) {
      setSearchParams({});
      return;
    }
    if (thread.kind === 'direct') {
      setSearchParams({ client: thread.id });
    } else {
      setSearchParams({ group: thread.id });
    }
  }, [setSearchParams]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return threads.filter((t) => {
      if (filter === 'direct' && t.kind !== 'direct') return false;
      if (filter === 'group' && t.kind !== 'group') return false;
      if (q && !t.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [threads, search, filter]);

  const selectedThread = threads.find((t) => threadKey(t) === selectedKey) ?? null;

  return (
    <div>
      <h1 className="page-title">Mensajes</h1>
      <p className="page-sub">Chats con alumnos y grupos en un solo lugar.</p>

      <div className="messages-layout card" style={{ padding: 0 }}>
        <div className="messages-sidebar">
          <div className="table-toolbar" style={{ padding: '12px 14px', gap: 10, flexDirection: 'column', alignItems: 'stretch' }}>
            <div className="search-field" style={{ width: '100%' }}>
              <SearchIcon size={14} />
              <input
                placeholder="Buscar conversación..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="inbox-filters">
              {(['all', 'direct', 'group'] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  className={`inbox-filter${filter === key ? ' active' : ''}`}
                  onClick={() => setFilter(key)}
                >
                  {key === 'all' ? 'Todos' : key === 'direct' ? 'Alumnos' : 'Grupos'}
                </button>
              ))}
            </div>
          </div>
          <div className="thread-list">
            {loading ? (
              <LoadingRows rows={5} />
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={<MessageIcon size={22} />}
                title={search ? 'Sin resultados' : 'Sin conversaciones'}
                sub={search ? 'Probá con otro nombre.' : 'Cuando te escriban o crees un grupo, aparece acá.'}
              />
            ) : (
              filtered.map((t) => {
                const key = threadKey(t);
                const active = selectedKey === key;
                return (
                  <div
                    key={key}
                    className={`thread-row${active ? ' active' : ''}`}
                    onClick={() => selectThread(t)}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="thread-avatar">
                      {t.kind === 'group' ? (
                        <GroupAvatar name={t.name} url={t.avatarUrl} size="sm" />
                      ) : (
                        <UserAvatar name={t.name} url={t.avatarUrl} size="sm" />
                      )}
                    </div>
                    <div className="thread-body">
                      <div className="thread-name">
                        {t.kind === 'group' ? `👥 ${t.name}` : t.name}
                      </div>
                      <div className="thread-last">{t.lastMsg || 'Sin mensajes todavía'}</div>
                    </div>
                    <div className="thread-meta">
                      <span className="thread-time">{relativeTime(t.lastAt)}</span>
                      {t.unread > 0 && <span className="thread-badge">{t.unread}</span>}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="messages-chat">
          {selectedThread?.kind === 'direct' ? (
            <div className="chat-card-inner">
              <div className="chat-head">
                <UserAvatar name={selectedThread.name} url={selectedThread.avatarUrl} size="sm" />
                <span className="chat-head-name">{selectedThread.name}</span>
              </div>
              <ChatPanel
                key={selectedThread.id}
                clientId={selectedThread.id}
                clientName={selectedThread.name}
                clientAvatar={selectedThread.avatarUrl}
                placeholder={`Escribile a ${selectedThread.name.split(' ')[0]}…`}
                onRead={loadThreads}
              />
            </div>
          ) : selectedThread?.kind === 'group' ? (
            <div className="chat-card-inner">
              <div className="chat-head">
                <GroupAvatar name={selectedThread.name} url={selectedThread.avatarUrl} size="sm" />
                <span className="chat-head-name">{selectedThread.name}</span>
                <Link to={`/groups/${selectedThread.id}`} className="chat-head-link">Gestionar grupo</Link>
              </div>
              <CommunityGroupChatPanel
                key={selectedThread.id}
                communityId={selectedThread.id}
                onRead={loadThreads}
              />
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
        .messages-sidebar { width: 300px; flex-shrink: 0; border-right: 1px solid var(--border); display: flex; flex-direction: column; }
        .inbox-filters { display: flex; gap: 6px; }
        .inbox-filter { flex: 1; border: 1px solid var(--border); background: var(--surface); border-radius: 999px; padding: 6px 10px; font-size: 12px; cursor: pointer; color: var(--text-secondary); }
        .inbox-filter.active { background: var(--chat-soft); border-color: var(--chat); color: var(--chat); font-weight: 600; }
        .thread-list { flex: 1; overflow-y: auto; padding: 8px; display: flex; flex-direction: column; gap: 2px; }
        .thread-row { display: flex; align-items: center; gap: 11px; padding: 10px 12px; cursor: pointer; border-radius: 12px; transition: background 120ms ease; }
        .thread-row:hover { background: var(--surface-elevated); }
        .thread-row.active { background: var(--chat-soft); }
        .thread-row.active .thread-name { color: var(--chat); }
        .thread-avatar { position: relative; flex-shrink: 0; }
        .group-avatar { display: flex; align-items: center; justify-content: center; background: var(--surface-elevated); color: var(--chat); }
        .thread-body { flex: 1; min-width: 0; }
        .thread-name { font-size: 13.5px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .thread-last { font-size: 12px; color: var(--text-tertiary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 1px; }
        .thread-meta { display: flex; flex-direction: column; align-items: flex-end; gap: 5px; flex-shrink: 0; }
        .thread-time { font-size: 11px; color: var(--text-tertiary); }
        .thread-badge { min-width: 18px; height: 18px; padding: 0 5px; background: var(--brand-lime); color: var(--brand-lime-on); border-radius: 999px; font-size: 10px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
        .messages-chat { flex: 1; display: flex; min-width: 0; }
        .chat-card-inner { flex: 1; display: flex; flex-direction: column; min-width: 0; }
        .chat-head { display: flex; align-items: center; gap: 10px; padding: 14px 18px; border-bottom: 1px solid var(--border); }
        .chat-head-name { font-weight: 600; font-size: 14px; flex: 1; }
        .chat-head-link { font-size: 12.5px; color: var(--chat); text-decoration: none; font-weight: 600; }
        .chat-head-link:hover { text-decoration: underline; }
        .chat-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; color: var(--text-tertiary); text-align: center; }
        .chat-empty p { margin: 0; font-size: 14px; }
      `}</style>
    </div>
  );
}
