import { create } from 'zustand';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { isAfterTimestamp } from '../lib/timestamps';
import type { CommunityMessageRow, CommunityRow } from '../types/database';

export interface InboxThread {
  key: string;
  kind: 'coach' | 'group';
  title: string;
  preview: string;
  lastAt: string | null;
  unread: number;
  communityId?: string;
  avatarUrl?: string | null;
}

interface InboxState {
  threads: InboxThread[];
  loading: boolean;
  error: string | null;
  totalUnread: number;
  loadInbox: (userId: string, trainerId?: string | null) => Promise<void>;
  subscribeInbox: (userId: string, trainerId?: string | null) => () => void;
  reset: () => void;
}

let inboxChannel: RealtimeChannel | null = null;

export const useInboxStore = create<InboxState>((set, get) => ({
  threads: [],
  loading: false,
  error: null,
  totalUnread: 0,

  loadInbox: async (userId, trainerId) => {
    set({ loading: true, error: null });
    try {
      let coachName = 'Mi coach';
      let coachAvatarUrl: string | null = null;
      if (trainerId) {
        const { data: coachProfile } = await supabase
          .from('profiles')
          .select('full_name, avatar_url')
          .eq('id', trainerId)
          .maybeSingle();
        if (coachProfile?.full_name) coachName = coachProfile.full_name;
        coachAvatarUrl = coachProfile?.avatar_url ?? null;
      }

      const { data: directMsgs, error: msgError } = await supabase
        .from('messages')
        .select('*')
        .eq('client_id', userId)
        .order('created_at', { ascending: false });
      if (msgError) throw msgError;

      const msgs = directMsgs ?? [];
      const lastCoach = msgs[0];
      const { count: coachUnread } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', userId)
        .eq('sender_role', 'trainer')
        .eq('read', false);

      const coachThread: InboxThread = {
        key: 'coach',
        kind: 'coach',
        title: coachName ? coachName : 'Mi coach',
        preview: lastCoach?.content ?? 'Escribile cuando quieras',
        lastAt: lastCoach?.created_at ?? null,
        unread: coachUnread ?? 0,
        avatarUrl: coachAvatarUrl,
      };

      const { data: memberships, error: memError } = await supabase
        .from('community_members')
        .select('community_id, last_read_at')
        .eq('user_id', userId);
      if (memError) throw memError;

      const communityIds = (memberships ?? []).map((m) => m.community_id);
      const groupThreads: InboxThread[] = [];

      if (communityIds.length > 0) {
        const { data: communities } = await supabase
          .from('communities')
          .select('*')
          .in('id', communityIds)
          .eq('is_active', true);

        const { data: recentMsgs } = await supabase
          .from('community_messages')
          .select('community_id, content, created_at')
          .in('community_id', communityIds)
          .order('created_at', { ascending: false });

        const lastByCommunity = new Map<string, { content: string; created_at: string }>();
        for (const row of recentMsgs ?? []) {
          if (!lastByCommunity.has(row.community_id)) {
            lastByCommunity.set(row.community_id, { content: row.content, created_at: row.created_at });
          }
        }

        const readMap = new Map((memberships ?? []).map((m) => [m.community_id, m.last_read_at]));

        const { data: groupMsgs } = await supabase
          .from('community_messages')
          .select('community_id, created_at, sender_id, kind')
          .in('community_id', communityIds)
          .eq('kind', 'user')
          .neq('sender_id', userId);

        for (const comm of (communities ?? []) as CommunityRow[]) {
          const last = lastByCommunity.get(comm.id);
          const since = readMap.get(comm.id) ?? '1970-01-01T00:00:00Z';
          const unread = ((groupMsgs as Pick<CommunityMessageRow, 'community_id' | 'created_at'>[] | null) ?? [])
            .filter((m) => m.community_id === comm.id && isAfterTimestamp(m.created_at, since))
            .length;

          groupThreads.push({
            key: `group:${comm.id}`,
            kind: 'group',
            communityId: comm.id,
            title: comm.name,
            preview: last?.content ?? 'Chat grupal',
            lastAt: last?.created_at ?? comm.created_at,
            unread,
            avatarUrl: comm.avatar_url,
          });
        }

        groupThreads.sort((a, b) => {
          const aT = a.lastAt ?? '';
          const bT = b.lastAt ?? '';
          return aT < bT ? 1 : aT > bT ? -1 : 0;
        });
      }

      const threads = [coachThread, ...groupThreads];
      const totalUnread = threads.reduce((sum, t) => sum + t.unread, 0);
      set({ threads, totalUnread, loading: false });
    } catch {
      set({ loading: false, error: 'No pudimos cargar tus mensajes.' });
    }
  },

  subscribeInbox: (userId, trainerId) => {
    if (inboxChannel) {
      void supabase.removeChannel(inboxChannel);
      inboxChannel = null;
    }

    const refresh = () => { void get().loadInbox(userId, trainerId); };

    inboxChannel = supabase
      .channel(`inbox-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `client_id=eq.${userId}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_messages' }, refresh)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'community_members', filter: `user_id=eq.${userId}` }, refresh)
      .subscribe();

    return () => {
      if (inboxChannel) {
        void supabase.removeChannel(inboxChannel);
        inboxChannel = null;
      }
    };
  },

  reset: () => {
    if (inboxChannel) {
      void supabase.removeChannel(inboxChannel);
      inboxChannel = null;
    }
    set({ threads: [], loading: false, error: null, totalUnread: 0 });
  },
}));
