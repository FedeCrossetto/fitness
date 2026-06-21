import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { CommunityMessageRow, CommunityRow } from '../types/database';

export interface CommunityListItem extends CommunityRow {
  member_count: number;
  unread_count: number;
  last_message: string | null;
  last_message_at: string | null;
}

interface CommunityState {
  communities: CommunityListItem[];
  loading: boolean;
  error: string | null;
  loadCommunities: (userId: string) => Promise<void>;
}

export const useCommunityStore = create<CommunityState>((set) => ({
  communities: [],
  loading: false,
  error: null,

  loadCommunities: async (userId) => {
    set({ loading: true, error: null });
    try {
      const { data: memberships, error: memError } = await supabase
        .from('community_members')
        .select('community_id, last_read_at')
        .eq('user_id', userId);
      if (memError) throw memError;

      const communityIds = (memberships ?? []).map((m) => m.community_id);
      if (communityIds.length === 0) {
        set({ communities: [], loading: false });
        return;
      }

      const { data: communities, error: commError } = await supabase
        .from('communities')
        .select('*')
        .in('id', communityIds)
        .eq('is_active', true)
        .order('updated_at', { ascending: false });
      if (commError) throw commError;

      const { data: memberCounts } = await supabase
        .from('community_members')
        .select('community_id')
        .in('community_id', communityIds);

      const countMap = new Map<string, number>();
      for (const row of memberCounts ?? []) {
        countMap.set(row.community_id, (countMap.get(row.community_id) ?? 0) + 1);
      }

      const { data: recentMessages } = await supabase
        .from('community_messages')
        .select('community_id, content, created_at')
        .in('community_id', communityIds)
        .order('created_at', { ascending: false });

      const lastMsgMap = new Map<string, { content: string; created_at: string }>();
      for (const msg of recentMessages ?? []) {
        if (!lastMsgMap.has(msg.community_id)) {
          lastMsgMap.set(msg.community_id, { content: msg.content, created_at: msg.created_at });
        }
      }

      const readMap = new Map((memberships ?? []).map((m) => [m.community_id, m.last_read_at]));

      const unreadPromises = communityIds.map(async (cid) => {
        const lastRead = readMap.get(cid);
        let query = supabase
          .from('community_messages')
          .select('id', { count: 'exact', head: true })
          .eq('community_id', cid)
          .neq('sender_id', userId);
        if (lastRead) query = query.gt('created_at', lastRead);
        const { count } = await query;
        return [cid, count ?? 0] as const;
      });
      const unreadEntries = await Promise.all(unreadPromises);
      const unreadMap = new Map(unreadEntries);

      const list: CommunityListItem[] = ((communities ?? []) as CommunityRow[]).map((c) => {
        const last = lastMsgMap.get(c.id);
        return {
          ...c,
          member_count: countMap.get(c.id) ?? 0,
          unread_count: unreadMap.get(c.id) ?? 0,
          last_message: last?.content ?? null,
          last_message_at: last?.created_at ?? null,
        };
      });

      set({ communities: list, loading: false });
    } catch {
      set({ loading: false, error: 'No pudimos cargar tus comunidades.' });
    }
  },
}));

export type { CommunityMessageRow };
