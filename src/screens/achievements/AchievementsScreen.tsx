import React, { useCallback, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, illustrations, layout, radius, spacing } from '../../theme';
import { computeAchievements, computeStreak, type Achievement, type StreakInfo } from '../../services/streaks';
import { AppText, CardSkeleton, ErrorState, IconButton } from '../../components/common';
import { useAuthStore } from '../../stores/authStore';
import type { HomeStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<HomeStackParamList, 'Achievements'>;

const WEEK_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

export function AchievementsScreen({ navigation }: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const session = useAuthStore((s) => s.session);
  const userId = session?.user.id;

  const [streak, setStreak] = useState<StreakInfo | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const [streakInfo, achievementList] = await Promise.all([
        computeStreak(userId),
        computeAchievements(userId),
      ]);
      setStreak(streakInfo);
      setAchievements(achievementList);
    } catch {
      setError('No pudimos cargar tus logros.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const renderAchievement = useCallback(({ item }: { item: Achievement }) => {
    const iconName = (item.achieved ? item.icon : `${item.icon}-outline`) as keyof typeof Ionicons.glyphMap;
    return (
      <View style={[styles.achievementCard, item.achieved ? styles.achieved : styles.locked]}>
        {!item.achieved ? (
          <View style={styles.lockBadge}>
            <Ionicons name="lock-closed" size={10} color={colors.text.tertiary} />
          </View>
        ) : null}
        <View style={[styles.achievementIcon, item.achieved && styles.achievementIconDone]}>
          <Ionicons
            name={iconName}
            size={22}
            color={item.achieved ? colors.primary.default : colors.text.tertiary}
          />
        </View>
        <AppText variant="body14SemiBold" color={colors.text.primary} style={styles.achievementTitle}>
          {item.title}
        </AppText>
        <AppText variant="body12" color={colors.text.secondary}>
          {item.description}
        </AppText>
      </View>
    );
  }, []);

  let content: React.JSX.Element;
  if (loading && achievements.length === 0) {
    content = (
      <View style={styles.statePad}>
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </View>
    );
  } else if (error && achievements.length === 0) {
    content = <ErrorState message={error} onRetry={() => void load()} />;
  } else {
    content = (
      <FlatList
        data={achievements}
        keyExtractor={(a) => a.key}
        renderItem={renderAchievement}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.hero}>
            <Image source={illustrations.victory} style={styles.mascot} contentFit="contain" />
            <AppText variant="metricLarge" color={colors.text.primary}>
              {streak?.current ?? 0} {streak?.current === 1 ? 'día' : 'días'}
            </AppText>
            <AppText variant="caps12" color={colors.text.tertiary} style={styles.heroLabel}>
              Racha actual
            </AppText>
            <View style={styles.weekRow}>
              {(streak?.lastWeek ?? Array.from({ length: 7 }, () => false)).map((active, i) => (
                <View key={`${WEEK_LABELS[i]}-${i}`} style={styles.weekDayWrap}>
                  <View style={[styles.weekDot, active && styles.weekDotActive]} />
                  <AppText variant="body12" color={colors.text.disabled}>
                    {WEEK_LABELS[i]}
                  </AppText>
                </View>
              ))}
            </View>
            <AppText variant="caps13" color={colors.text.tertiary} style={styles.sectionTitle}>
              Logros
            </AppText>
          </View>
        }
      />
    );
  }

  return (
    <View style={styles.flex}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <IconButton icon="chevron-back" onPress={() => navigation.goBack()} accessibilityLabel="Volver" />
        <AppText variant="h3" color={colors.text.primary} style={styles.headerTitle}>
          Logros y rachas
        </AppText>
        <View style={styles.headerSpacer} />
      </View>

      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: layout.screenPadding,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  headerTitle: { flex: 1, textAlign: 'center' },
  headerSpacer: { width: layout.minHitTarget },
  statePad: { paddingHorizontal: layout.screenPadding },
  listContent: {
    paddingHorizontal: layout.screenPadding,
    paddingBottom: layout.tabBarHeight + spacing.xxl,
  },
  hero: { alignItems: 'center', paddingTop: spacing.sm },
  mascot: { width: 140, height: 160, marginBottom: spacing.sm },
  heroLabel: { marginTop: spacing.xxs },
  weekRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  weekDayWrap: { alignItems: 'center', gap: spacing.xxs },
  weekDot: {
    width: 12,
    height: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.surface.elevated,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  weekDotActive: {
    backgroundColor: colors.primary.default,
    borderColor: colors.primary.default,
  },
  sectionTitle: { alignSelf: 'flex-start', marginTop: spacing.xl, marginBottom: spacing.sm },
  gridRow: { gap: spacing.sm },
  achievementCard: {
    flex: 1,
    backgroundColor: colors.surface.base,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  achieved: { borderColor: colors.primary.dark },
  locked: { opacity: 0.45 },
  lockBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 20,
    height: 20,
    borderRadius: radius.pill,
    backgroundColor: colors.surface.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  achievementIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.surface.elevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  achievementIconDone: { backgroundColor: colors.primary.muted },
  achievementTitle: { marginBottom: spacing.xxs },
});
