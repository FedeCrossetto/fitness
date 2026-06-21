import { useCallback, useEffect, useRef, useState } from 'react';
import type { CommunityMessageRow, ProfileRow } from '@reset-fitness/shared/types/database';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { refreshUnreadMessages } from '@/hooks/useUnreadMessages';

import { resolveAvatarUrl, initials } from '@/lib/avatarUrl';

function ChatAvatar({ name, url }: { name?: string | null; url?: string | null }): React.JSX.Element {
  const resolved = resolveAvatarUrl(url);
  return (
    <div className="chat-avatar" title={name ?? ''}>
      {resolved
        ? <img src={resolved} alt={name ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} />
        : initials(name)}
    </div>
  );
}

type SenderProfile = Pick<ProfileRow, 'id' | 'full_name' | 'avatar_url'>;

interface CommunityGroupChatPanelProps {
  communityId: string;
  placeholder?: string;
  onRead?: () => void;
}

export function CommunityGroupChatPanel({
  communityId,
  placeholder = 'Escribí un mensaje al grupo…',
  onRead,
}: CommunityGroupChatPanelProps): React.JSX.Element {
  const { session, profile, isTrainer } = useAuth();
  const { showToast } = useToast();
  const userId = session?.user.id;
  const [messages, setMessages] = useState<CommunityMessageRow[]>([]);
  const [senders, setSenders] = useState<Map<string, SenderProfile>>(new Map());
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const markRead = useCallback(async () => {
    if (!userId) return;
    if (isTrainer) {
      const { error } = await supabase
        .from('communities')
        .update({ trainer_last_read_at: new Date().toISOString() })
        .eq('id', communityId);
      if (error) return;
    } else {
      const { error } = await supabase
        .from('community_members')
        .update({ last_read_at: new Date().toISOString() })
        .eq('community_id', communityId)
        .eq('user_id', userId);
      if (error) return;
    }
    onRead?.();
    await refreshUnreadMessages();
  }, [communityId, userId, isTrainer, onRead]);

  const loadMessages = useCallback(async () => {
    const { data, error } = await supabase
      .from('community_messages')
      .select('*')
      .eq('community_id', communityId)
      .order('created_at', { ascending: true });
    if (error) return;
    const rows = (data as CommunityMessageRow[] | null) ?? [];
    setMessages(rows);

    const senderIds = [...new Set(rows.map((m) => m.sender_id).filter(Boolean))] as string[];
    if (senderIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', senderIds);
      const map = new Map<string, SenderProfile>();
      for (const p of (profiles as SenderProfile[] | null) ?? []) {
        map.set(p.id, p);
      }
      setSenders(map);
    }
    await markRead();
  }, [communityId, markRead]);

  useEffect(() => {
    setMessages([]);
    void loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    const channel = supabase
      .channel(`community-chat-${communityId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'community_messages', filter: `community_id=eq.${communityId}` },
        async (payload) => {
          const msg = payload.new as CommunityMessageRow;
          setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
          if (msg.sender_id && !senders.has(msg.sender_id)) {
            const { data } = await supabase
              .from('profiles')
              .select('id, full_name, avatar_url')
              .eq('id', msg.sender_id)
              .maybeSingle();
            if (data) {
              setSenders((prev) => new Map(prev).set(msg.sender_id!, data as SenderProfile));
            }
          }
          void markRead();
        },
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [communityId, markRead]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const onSend = useCallback(async () => {
    const content = draft.trim();
    if (!content || sending || !userId) return;
    setSending(true);
    const temp: CommunityMessageRow = {
      id: `temp-${Date.now()}`,
      community_id: communityId,
      sender_id: userId,
      content,
      kind: 'user',
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, temp]);
    setDraft('');
    const { data, error } = await supabase
      .from('community_messages')
      .insert({ community_id: communityId, sender_id: userId, content, kind: 'user' })
      .select()
      .single();
    if (error || !data) {
      setMessages((prev) => prev.filter((m) => m.id !== temp.id));
      setDraft(content);
      showToast('error', 'No se pudo enviar el mensaje.');
    } else {
      setMessages((prev) => prev.map((m) => (m.id === temp.id ? (data as CommunityMessageRow) : m)));
    }
    setSending(false);
  }, [draft, communityId, sending, userId, showToast]);

  return (
    <>
      <div className="chat-scroll" ref={scrollRef}>
        {messages.length === 0 ? (
          <p className="muted" style={{ textAlign: 'center', margin: 'auto' }}>
            Todavía no hay mensajes en este grupo.
          </p>
        ) : (
          messages.map((m) => {
            const isSystem = m.kind !== 'user';
            if (isSystem) {
              return (
                <div key={m.id} className="community-system-msg">
                  {m.content}
                </div>
              );
            }
            const own = m.sender_id === userId;
            const sender = m.sender_id ? senders.get(m.sender_id) : null;
            const name = own ? (profile?.full_name ?? 'Vos') : (sender?.full_name ?? 'Miembro');
            return (
              <div key={m.id} className={`bubble-line${own ? ' own' : ''}`}>
                {!own && <ChatAvatar name={name} url={sender?.avatar_url} />}
                <div className={`bubble-row${own ? ' own' : ''}`}>
                  {!own && <span className="community-sender-name">{name}</span>}
                  <div className={`bubble${own ? ' own' : ''}`}>{m.content}</div>
                  <span className="bubble-time">
                    {new Date(m.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                {own && <ChatAvatar name={profile?.full_name} url={profile?.avatar_url} />}
              </div>
            );
          })
        )}
      </div>
      <div className="composer">
        <input
          className="field-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void onSend(); } }}
          placeholder={placeholder}
        />
        <button className="btn" onClick={() => void onSend()} disabled={sending || !draft.trim()}>Enviar</button>
      </div>
      <style>{`
        .community-system-msg {
          text-align: center;
          font-size: 12.5px;
          color: var(--text-tertiary);
          background: var(--surface-elevated);
          border-radius: 999px;
          padding: 6px 14px;
          margin: 8px auto;
          max-width: 85%;
        }
        .community-sender-name {
          font-size: 11px;
          font-weight: 600;
          color: var(--text-tertiary);
          margin-bottom: 2px;
        }
      `}</style>
    </>
  );
}
