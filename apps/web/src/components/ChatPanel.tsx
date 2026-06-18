import { useCallback, useEffect, useRef, useState } from 'react';
import type { MessageRow } from '@habito/shared/types/database';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';

function initials(name: string | null | undefined): string {
  if (!name) return 'A';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

/** Tilde de "enviado" / "leído" (doble) compacto, estilo mensajería. */
function CheckMark({ read }: { read: boolean }): React.JSX.Element {
  return read ? (
    <svg width="17" height="11" viewBox="0 0 17 11" fill="none" aria-hidden>
      <path d="M1 6L3.8 8.8L9.8 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6.4 6L9.2 8.8L15.8 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ) : (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden>
      <path d="M1 6L4 9L10 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChatAvatar({ name, url }: { name?: string | null; url?: string | null }): React.JSX.Element {
  return (
    <div className="chat-avatar" title={name ?? ''}>
      {url
        ? <img src={url} alt={name ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} />
        : initials(name)}
    </div>
  );
}

/**
 * Panel de chat reutilizable entre el inbox (Messages) y el detalle del alumno.
 * Carga sus propios mensajes, se suscribe a realtime, marca como leídos los del
 * alumno y maneja el envío. `onRead` permite al contenedor refrescar contadores.
 */
export function ChatPanel({ clientId, clientName, clientAvatar, placeholder = 'Escribí un mensaje…', onRead }: {
  clientId: string;
  clientName?: string | null;
  clientAvatar?: string | null;
  placeholder?: string;
  onRead?: () => void;
}): React.JSX.Element {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Guardamos onRead en un ref: así un onRead nuevo en cada render del padre no
  // re-dispara los efectos (era la causa del parpadeo constante).
  const onReadRef = useRef(onRead);
  onReadRef.current = onRead;

  const markRead = useCallback(async () => {
    await supabase.from('messages').update({ read: true })
      .eq('client_id', clientId).eq('sender_role', 'client').eq('read', false);
    onReadRef.current?.();
  }, [clientId]);

  // Carga inicial + marcar leídos.
  useEffect(() => {
    let active = true;
    setMessages([]);
    void (async () => {
      const { data } = await supabase.from('messages').select('*')
        .eq('client_id', clientId).order('created_at', { ascending: true });
      if (!active) return;
      setMessages((data as MessageRow[] | null) ?? []);
      void markRead();
    })();
    return () => { active = false; };
  }, [clientId, markRead]);

  // Realtime.
  useEffect(() => {
    const channel = supabase
      .channel(`chat-${clientId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `client_id=eq.${clientId}` },
        (payload) => {
          // UPDATE: recibo de lectura (el alumno leyó) → reemplazamos el mensaje.
          if (payload.eventType === 'UPDATE') {
            const updated = payload.new as MessageRow;
            setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
            return;
          }
          const msg = payload.new as MessageRow;
          setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]);
          if (msg.sender_role === 'client') {
            void supabase.from('messages').update({ read: true }).eq('id', msg.id);
            onReadRef.current?.();
          }
        },
      ).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [clientId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const onSend = useCallback(async () => {
    const content = draft.trim();
    if (!content || sending) return;
    setSending(true);
    const temp: MessageRow = { id: `temp-${Date.now()}`, client_id: clientId, content, sender_role: 'trainer', read: false, created_at: new Date().toISOString() };
    setMessages((prev) => [...prev, temp]);
    setDraft('');
    const { data, error } = await supabase.from('messages').insert({ client_id: clientId, content, sender_role: 'trainer' }).select().single();
    if (error || !data) {
      setMessages((prev) => prev.filter((m) => m.id !== temp.id));
      setDraft(content);
      showToast('error', 'No se pudo enviar el mensaje. Probá de nuevo.');
    } else {
      setMessages((prev) => prev.map((m) => m.id === temp.id ? (data as MessageRow) : m));
    }
    setSending(false);
  }, [draft, clientId, sending, showToast]);

  return (
    <>
      <div className="chat-scroll" ref={scrollRef}>
        {messages.length === 0
          ? <p className="muted" style={{ textAlign: 'center', margin: 'auto' }}>Todavía no hay mensajes.</p>
          : messages.map((m) => {
              const own = m.sender_role === 'trainer';
              return (
                <div key={m.id} className={`bubble-line${own ? ' own' : ''}`}>
                  {!own && <ChatAvatar name={clientName} url={clientAvatar} />}
                  <div className={`bubble-row${own ? ' own' : ''}`}>
                    <div className={`bubble${own ? ' own' : ''}`}>{m.content}</div>
                    <span className="bubble-time">
                      {new Date(m.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                      {own && (
                        <span className={`bubble-check${m.read ? ' read' : ''}`} title={m.read ? 'Leído' : 'Enviado'}>
                          <CheckMark read={!!m.read} />
                        </span>
                      )}
                    </span>
                  </div>
                  {own && <ChatAvatar name={profile?.full_name} url={profile?.avatar_url} />}
                </div>
              );
            })
        }
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
    </>
  );
}
