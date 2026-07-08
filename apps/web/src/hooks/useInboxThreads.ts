import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CommunityMessageRow, CommunityRow, MessageRow, ProfileRow } from '@reset-fitness/shared/types/database';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { refreshUnreadMessages } from '@/hooks/useUnreadMessages';
import { resolveAvatarUrl } from '@/lib/avatarUrl';

type ClientMin = Pick<ProfileRow, 'id' | 'full_name' | 'avatar_url'>;

export interface DirectThread {
  kind: 'direct';
  id: string;
  name: string;
  avatarUrl: string | null;
  lastMsg: string;
  lastAt: string;
  unread: number;
}

export interface GroupThread {
  kind: 'group';
  id: string;
  name: string;
  avatarUrl: string | null;
  lastMsg: string;
  lastAt: string;
  unread: number;
}

export type InboxThread = DirectThread | GroupThread;

export function threadKey(t: InboxThread): string {
  return `${t.kind}:${t.id}`;
}

/** Fuente única de la lista de hilos (alumnos + grupos), usada tanto por
 * `/messages` (Messages.tsx) como por el widget flotante — evita duplicar la
 * consulta a Supabase en cada uno. */
export function useInboxThreads(): { threads: InboxThread[]; loading: boolean; reload: () => Promise<void> } {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [threads, setThreads] = useState<InboxThread[]>([]);
  const [loading, setLoading] = useState(true);

  const loadThreads = useCallback(async () => {
    if (!userId) return;
    const [{ data: clients }, { data: msgs }, { data: communities }] = await Promise.all([
      supabase.from('profiles').select('id, full_name, avatar_url').eq('trainer_id', userId),
      supabase.from('messages').select('*').order('created_at', { ascending: false }),
      supabase.from('communities').select('*').eq('trainer_id', userId).eq('is_active', true),
    ]);

    const allMsgs = (msgs as MessageRow[] | null) ?? [];
    const directThreads: DirectThread[] = ((clients as ClientMin[] | null) ?? []).map((c) => {
      const mine = allMsgs.filter((m) => m.client_id === c.id);
      const last = mine[0];
      return {
        kind: 'direct',
        id: c.id,
        name: c.full_name ?? 'Alumno',
        avatarUrl: resolveAvatarUrl(c.avatar_url),
        lastMsg: last?.content ?? '',
        lastAt: last?.created_at ?? '',
        unread: mine.filter((m) => m.sender_role === 'client' && !m.read).length,
      };
    });

    const commRows = (communities as CommunityRow[] | null) ?? [];
    const groupThreads: GroupThread[] = [];

    if (commRows.length > 0) {
      const ids = commRows.map((c) => c.id);
      const { data: recentMsgs } = await supabase
        .from('community_messages')
        .select('community_id, content, created_at, sender_id, kind')
        .in('community_id', ids)
        .order('created_at', { ascending: false });

      const lastByCommunity = new Map<string, CommunityMessageRow>();
      for (const row of (recentMsgs as CommunityMessageRow[] | null) ?? []) {
        if (!lastByCommunity.has(row.community_id)) {
          lastByCommunity.set(row.community_id, row);
        }
      }

      for (const comm of commRows) {
        const last = lastByCommunity.get(comm.id);
        const since = comm.trainer_last_read_at ?? '1970-01-01T00:00:00Z';
        const { count } = await supabase
          .from('community_messages')
          .select('id', { count: 'exact', head: true })
          .eq('community_id', comm.id)
          .eq('kind', 'user')
          .neq('sender_id', userId)
          .gt('created_at', since);

        groupThreads.push({
          kind: 'group',
          id: comm.id,
          name: comm.name,
          avatarUrl: resolveAvatarUrl(comm.avatar_url),
          lastMsg: last?.content ?? '',
          lastAt: last?.created_at ?? comm.created_at,
          unread: count ?? 0,
        });
      }
    }

    const merged: InboxThread[] = [...directThreads, ...groupThreads];
    merged.sort((a, b) => (a.lastAt < b.lastAt ? 1 : a.lastAt > b.lastAt ? -1 : 0));
    setThreads(merged);
    setLoading(false);
    refreshUnreadMessages();
  }, [userId]);

  useEffect(() => { void loadThreads(); }, [loadThreads]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel('messages-inbox-unified')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => void loadThreads())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_messages' }, () => void loadThreads())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'communities' }, () => void loadThreads())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [userId, loadThreads]);

  return useMemo(() => ({ threads, loading, reload: loadThreads }), [threads, loading, loadThreads]);
}
