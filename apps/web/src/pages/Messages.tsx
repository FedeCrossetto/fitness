import { useCallback, useEffect, useMemo, useState } from 'react';
import type { MessageRow, ProfileRow } from '@habito/shared/types/database';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { ChatPanel } from '@/components/ChatPanel';
import { MessageIcon, SearchIcon } from '@/components/icons';

type ClientMin = Pick<ProfileRow, 'id' | 'full_name' | 'avatar_url'>;

interface Thread {
  clientId: string;
  name: string;
  avatarUrl: string | null;
  lastMsg: string;
  lastAt: string;
  unread: number;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

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
  const { session } = useAuth();
  const userId = session?.user.id;
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);

  const loadThreads = useCallback(async () => {
    if (!userId) return;
    const [{ data: clients }, { data: msgs }] = await Promise.all([
      supabase.from('profiles').select('id, full_name, avatar_url').eq('trainer_id', userId),
      supabase.from('messages').select('*').order('created_at', { ascending: false }),
    ]);
    const allMsgs = (msgs as MessageRow[] | null) ?? [];
    const built: Thread[] = ((clients as ClientMin[] | null) ?? []).map((c) => {
      const mine = allMsgs.filter((m) => m.client_id === c.id);
      const last = mine[0];
      return {
        clientId: c.id,
        name: c.full_name ?? 'Alumno',
        avatarUrl: c.avatar_url,
        lastMsg: last?.content ?? '',
        lastAt: last?.created_at ?? '',
        unread: mine.filter((m) => m.sender_role === 'client' && !m.read).length,
      };
    });
    // Conversaciones con actividad primero, por fecha del último mensaje.
    built.sort((a, b) => (a.lastAt < b.lastAt ? 1 : a.lastAt > b.lastAt ? -1 : 0));
    setThreads(built);
    setLoading(false);
  }, [userId]);

  useEffect(() => { void loadThreads(); }, [loadThreads]);

  // Realtime: refresca la lista ante cualquier mensaje nuevo/leído.
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel('messages-inbox')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => void loadThreads())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [userId, loadThreads]);

  const filtered = useMemo(
    () => threads.filter((t) => t.name.toLowerCase().includes(search.trim().toLowerCase())),
    [threads, search],
  );

  const selectedThread = threads.find((t) => t.clientId === selected) ?? null;

  return (
    <div>
      <h1 className="page-title">Mensajes</h1>
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
            {loading ? (
              <p className="muted" style={{ padding: 16, fontSize: 13 }}>Cargando…</p>
            ) : filtered.length === 0 ? (
              <p className="muted" style={{ padding: 16, fontSize: 13 }}>Sin conversaciones.</p>
            ) : (
              filtered.map((t) => (
                <div
                  key={t.clientId}
                  className={`thread-row${selected === t.clientId ? ' active' : ''}`}
                  onClick={() => setSelected(t.clientId)}
                  role="button"
                  tabIndex={0}
                >
                  <div className="thread-avatar">
                    <div className="avatar" style={t.avatarUrl ? { padding: 0, overflow: 'hidden' } : undefined}>
                      {t.avatarUrl
                        ? <img src={t.avatarUrl} alt={t.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} />
                        : initials(t.name)}
                    </div>
                  </div>
                  <div className="thread-body">
                    <div className="thread-name">{t.name}</div>
                    <div className="thread-last">{t.lastMsg || 'Sin mensajes todavía'}</div>
                  </div>
                  <div className="thread-meta">
                    <span className="thread-time">{relativeTime(t.lastAt)}</span>
                    {t.unread > 0 && <span className="thread-badge">{t.unread}</span>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Chat area */}
        <div className="messages-chat">
          {selectedThread ? (
            <div className="chat-card-inner">
              <div className="chat-head">
                <div className="avatar sm" style={selectedThread.avatarUrl ? { padding: 0, overflow: 'hidden' } : undefined}>
                  {selectedThread.avatarUrl
                    ? <img src={selectedThread.avatarUrl} alt={selectedThread.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} />
                    : initials(selectedThread.name)}
                </div>
                <span className="chat-head-name">{selectedThread.name}</span>
              </div>
              <ChatPanel
                key={selectedThread.clientId}
                clientId={selectedThread.clientId}
                clientName={selectedThread.name}
                clientAvatar={selectedThread.avatarUrl}
                placeholder={`Escribile a ${selectedThread.name.split(' ')[0]}…`}
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
        .messages-sidebar { width: 280px; flex-shrink: 0; border-right: 1px solid var(--border); display: flex; flex-direction: column; }
        .thread-list { flex: 1; overflow-y: auto; }
        .thread-row { display: flex; align-items: center; gap: 10px; padding: 12px 14px; cursor: pointer; transition: background 120ms; border-bottom: 1px solid var(--border); }
        .thread-row:hover { background: var(--surface-elevated); }
        .thread-row.active { background: var(--surface-hover); }
        .thread-avatar { position: relative; flex-shrink: 0; }
        .thread-body { flex: 1; min-width: 0; }
        .thread-name { font-size: 13.5px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .thread-last { font-size: 12px; color: var(--text-tertiary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 1px; }
        .thread-meta { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0; }
        .thread-time { font-size: 11px; color: var(--text-tertiary); }
        .thread-badge { min-width: 18px; height: 18px; padding: 0 5px; background: var(--accent); color: var(--accent-contrast); border-radius: 999px; font-size: 10px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
        .messages-chat { flex: 1; display: flex; min-width: 0; }
        .chat-card-inner { flex: 1; display: flex; flex-direction: column; min-width: 0; }
        .chat-head { display: flex; align-items: center; gap: 10px; padding: 12px 16px; border-bottom: 1px solid var(--border); }
        .chat-head-name { font-weight: 600; font-size: 14px; }
        .chat-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; color: var(--text-tertiary); text-align: center; }
        .chat-empty p { margin: 0; font-size: 14px; }
      `}</style>
    </div>
  );
}
