import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { layout, radius, spacing, Colors, useThemedStyles, useTheme } from '../../theme';
import { formatTime } from '../../lib/dates';
import { supabase } from '../../lib/supabase';
import {
  AppText,
  Avatar,
  CardSkeleton,
  EmptyState,
  ErrorState,
  IconButton,
  Input,
} from '../../components/common';
import { useAuthStore } from '../../stores/authStore';
import { useInboxStore } from '../../stores/inboxStore';
import type { CommunityMessageRow, CommunityRow } from '../../types/database';
import type { HomeStackParamList } from '../../types/navigation';
import { useTabBarScrollPadding } from '../../hooks/useTabBarScrollPadding';

type Props = NativeStackScreenProps<HomeStackParamList, 'CommunityChat'>;

type SenderProfile = { full_name: string | null; avatar_url: string | null };

function asWrite<T>(payload: Partial<T>): never {
  return payload as never;
}

async function fetchSenderProfiles(ids: string[]): Promise<Record<string, SenderProfile>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return {};
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url')
    .in('id', unique);
  const map: Record<string, SenderProfile> = {};
  for (const row of (data as { id: string; full_name: string | null; avatar_url: string | null }[] | null) ?? []) {
    map[row.id] = { full_name: row.full_name, avatar_url: row.avatar_url };
  }
  return map;
}

export function CommunityChatScreen({ navigation, route }: Props): React.JSX.Element {
  const { communityId, communityName, communityAvatarUrl } = route.params;
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  const insets = useSafeAreaInsets();
  const scrollBottom = useTabBarScrollPadding();
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const userId = session?.user.id;

  const [messages, setMessages] = useState<CommunityMessageRow[]>([]);
  const [senderProfiles, setSenderProfiles] = useState<Record<string, SenderProfile>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [communityAvatar, setCommunityAvatar] = useState<string | null>(communityAvatarUrl ?? null);
  const listRef = useRef<FlatList<CommunityMessageRow>>(null);

  useEffect(() => {
    if (communityAvatarUrl) {
      setCommunityAvatar(communityAvatarUrl);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from('communities')
        .select('avatar_url')
        .eq('id', communityId)
        .maybeSingle();
      if (!cancelled && data) {
        setCommunityAvatar((data as Pick<CommunityRow, 'avatar_url'>).avatar_url);
      }
    })();
    return () => { cancelled = true; };
  }, [communityId, communityAvatarUrl]);

  const hydrateSenders = useCallback(async (rows: CommunityMessageRow[]) => {
    const ids = rows.map((m) => m.sender_id).filter((id): id is string => !!id);
    const fetched = await fetchSenderProfiles(ids);
    if (Object.keys(fetched).length === 0) return;
    setSenderProfiles((prev) => ({ ...prev, ...fetched }));
  }, []);

  const markRead = useCallback(async () => {
    if (!userId) return;
    const trainerId = useAuthStore.getState().profile?.trainer_id;
    await supabase
      .from('community_members')
      .update(asWrite({ last_read_at: new Date().toISOString() }))
      .eq('community_id', communityId)
      .eq('user_id', userId);
    void useInboxStore.getState().loadInbox(userId, trainerId);
  }, [communityId, userId]);

  const loadMessages = useCallback(async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('community_messages')
        .select('*')
        .eq('community_id', communityId)
        .order('created_at', { ascending: true });
      if (fetchError) throw fetchError;
      const rows = (data as CommunityMessageRow[]) ?? [];
      setMessages(rows);
      void hydrateSenders(rows);
      await markRead();
    } catch {
      setError('No pudimos cargar el chat.');
    } finally {
      setLoading(false);
    }
  }, [communityId, markRead, hydrateSenders]);

  useFocusEffect(
    useCallback(() => {
      void loadMessages();
    }, [loadMessages])
  );

  useEffect(() => {
    const channel = supabase
      .channel(`community-${communityId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'community_messages',
          filter: `community_id=eq.${communityId}`,
        },
        (payload) => {
          const incoming = payload.new as CommunityMessageRow;
          setMessages((prev) => (prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming]));
          if (incoming.sender_id) {
            void fetchSenderProfiles([incoming.sender_id]).then((fetched) => {
              if (Object.keys(fetched).length > 0) {
                setSenderProfiles((prev) => ({ ...prev, ...fetched }));
              }
            });
          }
          void markRead();
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [communityId, markRead]);

  const onSend = useCallback(async () => {
    const content = draft.trim();
    if (!content || !userId || sending) return;
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
    const { data, error: insertError } = await supabase
      .from('community_messages')
      .insert({ community_id: communityId, sender_id: userId, content, kind: 'user' })
      .select()
      .single();
    if (insertError || !data) {
      setMessages((prev) => prev.filter((m) => m.id !== temp.id));
      setDraft(content);
    } else {
      setMessages((prev) => prev.map((m) => (m.id === temp.id ? (data as CommunityMessageRow) : m)));
    }
    setSending(false);
  }, [draft, communityId, userId, sending]);

  const renderItem = ({ item, index }: { item: CommunityMessageRow; index: number }) => {
    if (item.kind !== 'user') {
      return (
        <View style={styles.systemWrap}>
          <AppText variant="body12" color={colors.text.tertiary} align="center">
            {item.content}
          </AppText>
        </View>
      );
    }

    const own = item.sender_id === userId;
    const sender = item.sender_id
      ? senderProfiles[item.sender_id] ?? (own && profile
        ? { full_name: profile.full_name, avatar_url: profile.avatar_url }
        : null)
      : null;
    const prev = messages[index - 1];
    const showSenderHeader = !own && (
      !prev || prev.kind !== 'user' || prev.sender_id !== item.sender_id
    );

    const avatar = (
      <Avatar
        name={sender?.full_name ?? (own ? profile?.full_name : 'Alumno')}
        imageUrl={sender?.avatar_url ?? (own ? profile?.avatar_url : null)}
        size={28}
      />
    );

    return (
      <View style={[styles.messageLine, own ? styles.messageLineOwn : styles.messageLineOther]}>
        {!own && avatar}
        <View style={[styles.messageCol, own ? styles.messageColOwn : styles.messageColOther]}>
          {showSenderHeader && (
            <AppText variant="body12Medium" color={colors.text.secondary} style={styles.senderName}>
              {sender?.full_name ?? 'Alumno'}
            </AppText>
          )}
          <View style={[styles.bubble, own ? styles.bubbleOwn : styles.bubbleOther]}>
            <AppText variant="body16" color={own ? colors.primary.onText : colors.text.primary}>
              {item.content}
            </AppText>
          </View>
          <AppText variant="caps11" color={colors.text.disabled} style={styles.time}>
            {formatTime(item.created_at)}
          </AppText>
        </View>
        {own && avatar}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <View style={styles.header}>
        <IconButton icon="chevron-back" onPress={() => navigation.goBack()} accessibilityLabel="Volver" />
        <Avatar
          name={communityName ?? 'Grupo'}
          imageUrl={communityAvatar}
          size={40}
          shape="rounded"
        />
        <View style={styles.headerText}>
          <AppText variant="h3" color={colors.text.primary} numberOfLines={1}>
            {communityName ?? 'Comunidad'}
          </AppText>
          <AppText variant="body12" color={colors.text.tertiary}>
            Chat grupal
          </AppText>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.content}>
          <CardSkeleton />
        </View>
      ) : error ? (
        <ErrorState message={error} onRetry={() => void loadMessages()} />
      ) : (
        <>
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            renderItem={renderItem}
            contentContainerStyle={[
              styles.listContent,
              messages.length === 0 && styles.listEmpty,
              { paddingBottom: spacing.md },
            ]}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <EmptyState
                pillar="generic"
                title="Sin mensajes"
                message="Sé el primero en escribir al grupo."
              />
            }
          />
          <View style={[styles.composer, { paddingBottom: scrollBottom }]}>
            <Input
              value={draft}
              onChangeText={setDraft}
              placeholder="Escribí un mensaje…"
              containerStyle={styles.inputWrap}
              returnKeyType="send"
              onSubmitEditing={() => void onSend()}
            />
            <IconButton
              icon="send"
              onPress={() => { if (!sending && draft.trim()) void onSend(); }}
              accessibilityLabel="Enviar"
              backgroundColor={colors.primary.default}
              color={colors.primary.onText}
            />
          </View>
        </>
      )}
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: layout.screenPadding,
      paddingBottom: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border.subtle,
    },
    headerText: { flex: 1, marginHorizontal: spacing.xs },
    headerSpacer: { width: layout.minHitTarget },
    content: { padding: layout.screenPadding },
    listContent: { paddingHorizontal: layout.screenPadding, paddingTop: spacing.md },
    listEmpty: { flexGrow: 1, justifyContent: 'center' },
    systemWrap: {
      alignSelf: 'center',
      backgroundColor: colors.surface.elevated,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      marginVertical: spacing.sm,
      maxWidth: '85%',
    },
    messageLine: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: spacing.xs,
      marginBottom: spacing.sm,
      maxWidth: '88%',
    },
    messageLineOwn: { alignSelf: 'flex-end' },
    messageLineOther: { alignSelf: 'flex-start' },
    messageCol: { flexShrink: 1, minWidth: 0 },
    messageColOwn: { alignItems: 'flex-end' },
    messageColOther: { alignItems: 'flex-start' },
    senderName: { marginBottom: 4, marginLeft: 2 },
    bubble: {
      borderRadius: radius.lg,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    bubbleOwn: { backgroundColor: colors.primary.default },
    bubbleOther: { backgroundColor: colors.surface.elevated, borderWidth: 1, borderColor: colors.border.subtle },
    time: { marginTop: 2 },
    composer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: spacing.sm,
      paddingHorizontal: layout.screenPadding,
      paddingTop: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border.subtle,
      backgroundColor: colors.background,
    },
    inputWrap: { flex: 1, marginBottom: 0 },
  });
