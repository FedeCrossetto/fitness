import React, { useCallback, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '../../types/navigation';
import { illustrations, layout, radius, spacing, Colors, useThemedStyles, useTheme } from '../../theme';
import { computeAchievements, type Achievement } from '../../services/streaks';
import { getTrophyStats, type TrophyStats } from '../../services/trophies';
import { AppText, CardSkeleton, ErrorState, IconButton } from '../../components/common';
import { useAuthStore } from '../../stores/authStore';
import { useTabBarScrollPadding } from '../../hooks/useTabBarScrollPadding';

type Props = NativeStackScreenProps<HomeStackParamList, 'Achievements'>;

const WEEK_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

export function AchievementsScreen({ navigation }: Props): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  const insets = useSafeAreaInsets();
  const scrollBottom = useTabBarScrollPadding();
  const session = useAuthStore((s) => s.session);
  const userId = session?.user.id;

  const [trophies, setTrophies] = useState<TrophyStats | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const [trophyStats, achievementList] = await Promise.all([
        getTrophyStats(userId),
        computeAchievements(userId),
      ]);
      setTrophies(trophyStats);
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
  }, [colors, styles]);

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
        contentContainerStyle={[styles.listContent, { paddingBottom: scrollBottom }]}
        ListHeaderComponent={
          <View style={styles.hero}>
            <View style={styles.heroRow}>
              <Image source={illustrations.trophy} style={styles.trophyHero} contentFit="contain" />
              <View style={styles.heroStats}>
                <AppText variant="metricLarge" color={colors.text.primary}>
                  {trophies?.total ?? 0}
                </AppText>
                <AppText variant="caps12" color={colors.text.tertiary}>
                  {trophies?.total === 1 ? 'trofeo' : 'trofeos'}
                </AppText>
                {(trophies?.currentStreak ?? 0) > 1 ? (
                  <View style={styles.streakPill}>
                    <Ionicons name="flame" size={13} color={colors.primary.default} />
                    <AppText variant="caps11" color={colors.primary.default}>
                      {trophies?.currentStreak} días seguidos
                    </AppText>
                  </View>
                ) : null}
              </View>
            </View>
            <View style={styles.weekRow}>
              {(trophies?.lastWeek ?? Array.from({ length: 7 }, () => false)).map((earned, i) => (
                <View key={`${WEEK_LABELS[i]}-${i}`} style={styles.weekDayWrap}>
                  {earned ? (
                    <Image source={illustrations.trophy} style={styles.weekTrophy} contentFit="contain" />
                  ) : (
                    <View style={styles.weekEmpty} />
                  )}
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
          Trofeos y logros
        </AppText>
        <View style={styles.headerSpacer} />
      </View>

      {content}
    </View>
  );
}

const createStyles = (colors: Colors) => StyleSheet.create({
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
  },
  hero: { paddingTop: spacing.sm },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginBottom: spacing.lg,
  },
  trophyHero: { width: 112, height: 112 },
  heroStats: { flex: 1, gap: spacing.xxs },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xxs,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.pill,
    backgroundColor: colors.primary.muted,
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  weekDayWrap: { alignItems: 'center', gap: spacing.xxs, flex: 1 },
  weekTrophy: { width: 32, height: 32 },
  weekEmpty: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.surface.elevated,
    borderWidth: 1,
    borderColor: colors.border.default,
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
