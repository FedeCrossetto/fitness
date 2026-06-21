import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { isAfterTimestamp } from '@/lib/timestamps';
import type { CommunityMessageRow, CommunityRow } from '@reset-fitness/shared/types/database';

type RefreshListener = () => void | Promise<void>;
const refreshListeners = new Set<RefreshListener>();

/** Fuerza recálculo del badge de mensajes sin leer (p. ej. tras abrir un chat). */
export async function refreshUnreadMessages(): Promise<void> {
  await Promise.all([...refreshListeners].map((listener) => Promise.resolve(listener())));
}

async function countUnread(userId: string): Promise<number> {
  const [{ count: directUnread }, { data: communities, error: commError }] = await Promise.all([
    supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('sender_role', 'client')
      .eq('read', false),
    supabase
      .from('communities')
      .select('id, trainer_last_read_at')
      .eq('trainer_id', userId)
      .eq('is_active', true),
  ]);

  let groupUnread = 0;
  const commRows = (communities as Pick<CommunityRow, 'id' | 'trainer_last_read_at'>[] | null) ?? [];

  if (!commError && commRows.length > 0) {
    const sinceByCommunity = new Map(
      commRows.map((c) => [c.id, c.trainer_last_read_at ?? '1970-01-01T00:00:00Z']),
    );
    const ids = commRows.map((c) => c.id);
    const { data: groupMsgs } = await supabase
      .from('community_messages')
      .select('community_id, created_at, sender_id, kind')
      .in('community_id', ids)
      .eq('kind', 'user')
      .neq('sender_id', userId);

    for (const msg of (groupMsgs as Pick<CommunityMessageRow, 'community_id' | 'created_at' | 'sender_id' | 'kind'>[] | null) ?? []) {
      const since = sinceByCommunity.get(msg.community_id);
      if (since && isAfterTimestamp(msg.created_at, since)) groupUnread += 1;
    }
  }

  return (directUnread ?? 0) + groupUnread;
}

/**
 * Mensajes sin leer: chats 1:1 de alumnos + mensajes de grupos no leídos por el entrenador.
 */
export function useUnreadMessages(): number {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!userId) return;
    let active = true;

    const fetchCount = async () => {
      const total = await countUnread(userId);
      if (active) setCount(total);
    };

    const onRefresh = () => void fetchCount();
    refreshListeners.add(onRefresh);

    void fetchCount();

    const onVisible = () => {
      if (document.visibilityState === 'visible') void fetchCount();
    };
    document.addEventListener('visibilitychange', onVisible);

    const channel = supabase
      .channel('unread-messages')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, onRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_messages' }, onRefresh)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'communities' }, onRefresh)
      .subscribe();

    return () => {
      active = false;
      refreshListeners.delete(onRefresh);
      document.removeEventListener('visibilitychange', onVisible);
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  return count;
}
