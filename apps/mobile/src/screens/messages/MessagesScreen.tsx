import React, { useCallback } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '../../types/navigation';
import { layout, radius, spacing, Colors, useThemedStyles, useTheme } from '../../theme';
import { formatShortDate } from '../../lib/dates';
import {
  AppText,
  Avatar,
  CardSkeleton,
  EmptyState,
  ErrorState,
  IconButton,
} from '../../components/common';
import { useAuthStore } from '../../stores/authStore';
import { useInboxStore, type InboxThread } from '../../stores/inboxStore';
import { useTabBarScrollPadding } from '../../hooks/useTabBarScrollPadding';
import { useTranslation } from '../../stores/i18nStore';

type Props = NativeStackScreenProps<HomeStackParamList, 'Messages'>;

export function MessagesScreen({ navigation }: Props): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();

  const insets = useSafeAreaInsets();
  const scrollBottom = useTabBarScrollPadding();
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const userId = session?.user.id;

  const threads = useInboxStore((s) => s.threads);
  const loading = useInboxStore((s) => s.loading);
  const error = useInboxStore((s) => s.error);
  const loadInbox = useInboxStore((s) => s.loadInbox);

  useFocusEffect(
    useCallback(() => {
      if (userId) void loadInbox(userId, profile?.trainer_id);
    }, [userId, profile?.trainer_id, loadInbox])
  );

  const onPressThread = (thread: InboxThread) => {
    if (thread.kind === 'coach') {
      navigation.navigate('CoachChat');
      return;
    }
    if (thread.communityId) {
      navigation.navigate('CommunityChat', {
        communityId: thread.communityId,
        communityName: thread.title,
        communityAvatarUrl: thread.avatarUrl,
      });
    }
  };

  const renderItem = ({ item, index }: { item: InboxThread; index: number }) => (
    <View>
      {index === 1 ? (
        <AppText variant="caps12" color={colors.text.tertiary} style={styles.sectionLabel}>
          Grupos
        </AppText>
      ) : null}
      <Pressable
        accessibilityRole="button"
        onPress={() => onPressThread(item)}
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      >
        <View style={styles.avatarWrap}>
          <Avatar
            name={item.title}
            imageUrl={item.avatarUrl}
            size={48}
            shape={item.kind === 'group' ? 'rounded' : 'circle'}
          />
        </View>
        <View style={styles.rowBody}>
          <AppText variant="body16SemiBold" color={colors.text.primary} numberOfLines={1}>
            {item.kind === 'coach' ? item.title : item.title}
          </AppText>
          <AppText variant="body13" color={colors.text.tertiary} numberOfLines={1}>
            {item.preview}
          </AppText>
        </View>
        <View style={styles.rowMeta}>
          {item.lastAt ? (
            <AppText variant="caps11" color={colors.text.disabled}>
              {formatShortDate(item.lastAt.slice(0, 10))}
            </AppText>
          ) : null}
          {item.unread > 0 ? (
            <View style={styles.badge}>
              <AppText variant="caps11" color={colors.primary.onText}>
                {item.unread > 9 ? '9+' : String(item.unread)}
              </AppText>
            </View>
          ) : null}
          <Ionicons name="chevron-forward" size={18} color={colors.text.disabled} />
        </View>
      </Pressable>
      {index === 0 && threads.length > 1 ? <View style={styles.separator} /> : null}
    </View>
  );

  return (
    <View style={[styles.flex, { paddingTop: insets.top + spacing.md }]}>
      <View style={styles.header}>
        <IconButton icon="chevron-back" onPress={() => navigation.goBack()} accessibilityLabel={t.ui.back} />
        <AppText variant="h2" color={colors.text.primary} style={styles.title}>
          {t.home.messages}
        </AppText>
        <View style={styles.headerSpacer} />
      </View>

      {loading && threads.length === 0 ? (
        <View style={styles.content}>
          <CardSkeleton />
          <CardSkeleton />
        </View>
      ) : error && threads.length === 0 ? (
        <ErrorState message={error} onRetry={() => userId && void loadInbox(userId, profile?.trainer_id)} />
      ) : threads.length === 0 ? (
        <EmptyState
          pillar="generic"
          title="Sin mensajes"
          message="Cuando tu coach o tus grupos te escriban, aparecen acá."
        />
      ) : (
        <FlatList
          data={threads}
          keyExtractor={(item) => item.key}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: layout.screenPadding, paddingBottom: scrollBottom }}
        />
      )}
    </View>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: layout.screenPadding,
      marginBottom: spacing.md,
    },
    title: { flex: 1, textAlign: 'center' },
    headerSpacer: { width: layout.minHitTarget },
    content: { paddingHorizontal: layout.screenPadding },
    sectionLabel: { marginTop: spacing.sm, marginBottom: spacing.xs },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.md,
    },
    rowPressed: { opacity: 0.85 },
    avatarWrap: { flexShrink: 0 },
    rowBody: { flex: 1, minWidth: 0, gap: 2 },
    rowMeta: { alignItems: 'flex-end', gap: spacing.xxs },
    badge: {
      minWidth: 20,
      height: 20,
      borderRadius: radius.pill,
      backgroundColor: colors.primary.default,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 6,
    },
    separator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border.subtle,
      marginVertical: spacing.xs,
    },
  });
