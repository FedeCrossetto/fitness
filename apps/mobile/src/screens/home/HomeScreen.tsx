import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withDelay, withSpring, interpolate, Extrapolation } from 'react-native-reanimated';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { layout, radius, spacing, Colors, useThemedStyles, useTheme, illustrations } from '../../theme';
import { todayISO, formatShortDate, formatDayMonth } from '../../lib/dates';
import { useTranslation } from '../../stores/i18nStore';
import { useClientConfig } from '../../config/useClientConfig';
import {
  AppText,
  Avatar,
  Card,
  CardSkeleton,
  ProgressBar,
  ProgressiveBlurHeader,
  FadeInView,
  WeekStrip,
} from '../../components/common';
import { HomeMacroProgressCard } from '../../components/home/HomeMacroProgressCard';
import { HomeStreakCard } from '../../components/home/HomeStreakCard';
import { HomeProgressMetricCard } from '../../components/home/HomeProgressMetricCard';
import { NUTRITION_MACRO_COLORS } from '../../components/nutrition/nutritionTheme';
import { SubscriptionBanner } from '../../components/home/SubscriptionBanner';
import { ExpiryWarningBanner } from '../../components/home/ExpiryWarningBanner';
import { ActiveSessionBanner } from '../../components/training/ActiveSessionBanner';
import { ActiveIntervalSessionBanner } from '../../components/training/ActiveIntervalSessionBanner';
import { useAuthStore } from '../../stores/authStore';
import { useGoalsStore } from '../../stores/goalsStore';
import { computeMacroTotals, useNutritionStore } from '../../stores/nutritionStore';
import { useProgressStore } from '../../stores/progressStore';
import { getCompletedWorkoutNames, getNextWorkoutDay, getProgramStats } from '../../lib/trainingProgram';
import { useTrainingStore } from '../../stores/trainingStore';
import { useInboxStore } from '../../stores/inboxStore';
import { getTrophyStats } from '../../services/trophies';
import { computeStreak, type StreakInfo } from '../../services/streaks';
import { signedUrl } from '../../services/storage';
import { fetchTodaySteps } from '../../services/steps';
import { useStepsAutoSync } from '../../hooks/useStepsAutoSync';
import { useTabBarScrollPadding } from '../../hooks/useTabBarScrollPadding';
import { syncPushRegistration } from '../../services/notifications';
import { hapticSelect } from '../../lib/haptics';
import { useUiStore } from '../../stores/uiStore';
import type { HomeStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<HomeStackParamList, 'HomeMain'>;

export function HomeScreen({ navigation }: Props): React.JSX.Element {
  const { colors, isDark } = useTheme();
  const clientConfig = useClientConfig();
  const styles = useThemedStyles(createStyles);
  const { t, i18n } = useTranslation();

  const insets = useSafeAreaInsets();
  const scrollBottom = useTabBarScrollPadding();
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  const badgePulse = useSharedValue(1);
  useEffect(() => {
    badgePulse.value = withRepeat(
      withSequence(
        withDelay(4000, withSpring(1.35, { damping: 5, stiffness: 300 })),
        withSpring(1, { damping: 8, stiffness: 280 }),
      ),
      -1,
    );
  }, [badgePulse]);
  const badgeAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: badgePulse.value }],
  }));

  const headerShrink = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 90], [1, 0], Extrapolation.CLAMP),
    transform: [
      { scale: interpolate(scrollY.value, [0, 90], [1, 0.94], Extrapolation.CLAMP) },
      { translateY: interpolate(scrollY.value, [0, 90], [0, -8], Extrapolation.CLAMP) },
    ],
  }));

  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const userId = session?.user.id;
  const isTrainer = profile?.role === 'trainer' || profile?.role === 'admin';

  const goals = useGoalsStore((s) => s.goals);
  const goalsLoading = useGoalsStore((s) => s.loading);
  const loadGoalsToday = useGoalsStore((s) => s.loadToday);
  const syncAutoGoal = useGoalsStore((s) => s.syncAutoGoal);

  const meals = useNutritionStore((s) => s.meals);
  const nutritionLoading = useNutritionStore((s) => s.loading);
  const loadNutritionDay = useNutritionStore((s) => s.loadDay);
  const kcalGoal = useNutritionStore((s) => s.kcalGoal);
  const macroGoals = useNutritionStore((s) => s.macroGoals);

  const hydration = useProgressStore((s) => s.hydrationToday);
  const loadHydration = useProgressStore((s) => s.loadHydration);
  const steps = useProgressStore((s) => s.steps);
  const setSteps = useProgressStore((s) => s.setSteps);
  const healthConnected = useProgressStore((s) => s.healthConnected);
  const measurements = useProgressStore((s) => s.measurements);
  const loadMeasurements = useProgressStore((s) => s.loadMeasurements);
  const photos = useProgressStore((s) => s.photos);
  const loadPhotos = useProgressStore((s) => s.loadPhotos);
  const homePhotosHidden = useProgressStore((s) => s.homePhotosHidden);
  const toggleHomePhotosHidden = useProgressStore((s) => s.toggleHomePhotosHidden);

  const phases = useTrainingStore((s) => s.phases);
  const loadProgram = useTrainingStore((s) => s.loadProgram);
  const recentLogs = useTrainingStore((s) => s.recentLogs);
  const loadRecentLogs = useTrainingStore((s) => s.loadRecentLogs);

  const [trophyTotal, setTrophyTotal] = useState(0);
  const [streak, setStreak] = useState<StreakInfo>({ current: 0, lastWeek: [false, false, false, false, false, false, false] });
  const [refreshing, setRefreshing] = useState(false);

  const activeDate = useUiStore((s) => s.activeDate);
  const today = todayISO();
  const isToday = activeDate === today;

  const dayMeals = useMemo(
    () => meals.filter((m) => m.date === activeDate),
    [meals, activeDate],
  );

  const totals = useMemo(() => computeMacroTotals(dayMeals), [dayMeals]);

  const macroCardTitle = isToday
    ? t.home.macro_progress_title
    : i18n(t.home.macro_progress_day, { date: formatDayMonth(activeDate) });

  const loadAll = useCallback(async () => {
    if (!userId) return;
    await Promise.all([
      loadGoalsToday(userId),
      loadNutritionDay(userId, activeDate),
      loadHydration(userId),
      loadProgram(),
      loadRecentLogs(userId),
      loadMeasurements(userId),
      loadPhotos(userId),
    ]);
    const [trophyStats, streakInfo] = await Promise.all([
      getTrophyStats(userId),
      computeStreak(userId),
    ]);
    setTrophyTotal(trophyStats.total);
    setStreak(streakInfo);
    // Solo refrescar pasos si el usuario ya conectó explícitamente
    if (useProgressStore.getState().healthConnected) {
      const todaySteps = await fetchTodaySteps(true);
      if (todaySteps !== null) {
        setSteps(todaySteps);
        void syncAutoGoal(userId, 'steps', todaySteps);
      }
    }
  }, [userId, activeDate, loadGoalsToday, loadNutritionDay, loadHydration, loadProgram, loadRecentLogs, loadMeasurements, loadPhotos, setSteps, syncAutoGoal]);

  useEffect(() => {
    if (!userId) return;
    void loadNutritionDay(userId, activeDate);
  }, [userId, activeDate, loadNutritionDay]);

  useEffect(() => {
    if (userId) void syncPushRegistration(userId);
  }, [userId]);

  useStepsAutoSync(userId, syncAutoGoal);

  // Evita re-cargar todo en cada cambio de tab: el estado en memoria ya está al día.
  const lastLoadRef = useRef(0);
  useFocusEffect(
    useCallback(() => {
      if (Date.now() - lastLoadRef.current < 30_000) return;
      lastLoadRef.current = Date.now();
      void loadAll();
    }, [loadAll])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAll();
    lastLoadRef.current = Date.now();
    setRefreshing(false);
  }, [loadAll]);

  const completedGoals = goals.filter((g) => g.completed).length;
  const goalProgress = goals.length > 0 ? completedGoals / goals.length : 0;

  // Progress metrics derivados de las mediciones
  const weightHistory = useMemo(
    () => measurements.filter((m) => m.weight_kg !== null).sort((a, b) => (a.date < b.date ? 1 : -1)),
    [measurements]
  );
  const latestWeight = weightHistory[0] ?? null;
  const previousWeight = weightHistory[1] ?? null;
  const weightDelta =
    latestWeight?.weight_kg != null && previousWeight?.weight_kg != null
      ? (latestWeight.weight_kg as number) - (previousWeight.weight_kg as number)
      : null;
  const recentPhotos = photos.slice(0, 3);

  // El bucket de fotos es privado: resolvemos URLs firmadas para los thumbnails.
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    const pending = recentPhotos.filter((p) => photoUrls[p.photo_url] === undefined);
    if (pending.length === 0) return;
    let cancelled = false;
    void (async () => {
      const entries = await Promise.all(
        pending.map(async (p) => [p.photo_url, await signedUrl('progress-photos', p.photo_url)] as const)
      );
      if (cancelled) return;
      setPhotoUrls((prev) => {
        const next = { ...prev };
        for (const [path, url] of entries) if (url) next[path] = url;
        return next;
      });
    })();
    return () => { cancelled = true; };
  }, [recentPhotos, photoUrls]);

  const trainedToday = recentLogs.some((l) => l.date === today);
  const completedWorkoutNames = useMemo(() => getCompletedWorkoutNames(recentLogs), [recentLogs]);
  const programStats = useMemo(
    () => getProgramStats(phases, completedWorkoutNames),
    [phases, completedWorkoutNames],
  );
  const nextWorkoutDay = getNextWorkoutDay(phases, completedWorkoutNames);
  const nextWorkoutName = nextWorkoutDay?.workout?.title?.split(' — ')[0]
    ?? nextWorkoutDay?.title
    ?? null;
  const nextWorkoutDayLabel = nextWorkoutDay
    ? `Día ${nextWorkoutDay.day_number}`
    : null;

  const hydrationGoalMl = hydration?.goal_ml ?? clientConfig.defaultHydrationGoalMl;
  const hydrationProgress = hydration ? hydration.total_ml / Math.max(hydrationGoalMl, 1) : 0;
  const stepsProgress = steps > 0 ? steps / clientConfig.defaultStepsGoal : 0;

  const stepsSubtitle = healthConnected
    ? Platform.OS === 'ios'
      ? t.home.apple_health
      : t.home.health_connect
    : Platform.OS === 'ios'
      ? t.home.connect_ios
      : t.home.connect_android;

  const weightSubtitle = latestWeight
    ? weightDelta !== null
      ? i18n(t.progress.vs_prev, {
          delta: `${weightDelta > 0 ? '+' : ''}${weightDelta.toFixed(1)}`,
        })
      : formatShortDate(latestWeight.date)
    : t.progress.add_weight;

  const navigateToProgressPhotos = useCallback(() => {
    (navigation.getParent() as { navigate: (name: string, params?: object) => void } | undefined)
      ?.navigate('ProgressTab', { screen: 'ProgressPhotos' });
  }, [navigation]);

  const navigateToHealthSettings = useCallback(() => {
    navigation.navigate('Profile', { section: 'health' });
  }, [navigation]);

  const navigateToProgress = useCallback(
    (screen: 'Dashboard' | 'WeightDetail' | 'Measurements') => {
      (navigation.getParent() as { navigate: (name: string, params?: object) => void } | undefined)
        ?.navigate('ProgressTab', { screen });
    },
    [navigation]
  );

  const firstName = profile?.full_name?.split(' ')[0] ?? 'Atleta';

  const greetingText = useMemo(() => {
    const h = new Date().getHours();
    if (h >= 5 && h < 13) return 'Buenos días';
    if (h < 20) return 'Buenas tardes';
    return 'Buenas noches';
  }, []);

  const loadInbox = useInboxStore((s) => s.loadInbox);

  useFocusEffect(
    useCallback(() => {
      if (userId) void loadInbox(userId, profile?.trainer_id);
    }, [userId, profile?.trainer_id, loadInbox])
  );

  return (
    <View style={styles.flex}>
      <ProgressiveBlurHeader title={clientConfig.appName} scrollY={scrollY} />
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{
          paddingTop: insets.top + spacing.md,
          paddingBottom: scrollBottom,
          paddingHorizontal: layout.screenPadding,
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={colors.primary.default} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Encabezado con saludo + avatar */}
        <FadeInView delay={0}>
        <Animated.View style={[styles.header, headerShrink]}>
          {/* Izquierda: avatar + saludo */}
          <Pressable
            onPress={() => navigation.navigate('Profile')}
            accessibilityLabel="Ir a mi perfil"
            style={styles.headerLeft}
          >
            <View style={styles.headerAvatarRing}>
              <Avatar name={profile?.full_name} imageUrl={profile?.avatar_url} size={44} />
            </View>
            <View style={styles.headerGreeting}>
              <AppText variant="body12" color={colors.text.tertiary}>
                {greetingText}
              </AppText>
              <AppText variant="h1" color={colors.text.primary} style={styles.headerName}>
                {firstName}
              </AppText>
            </View>
          </Pressable>

          {/* Derecha: trofeo */}
          <Pressable
            onPress={() => navigation.navigate('Achievements')}
            accessibilityLabel={`${trophyTotal} trofeos. Ver logros`}
            style={styles.headerTrophyBtn}
            hitSlop={8}
          >
            <Image source={illustrations.trophy} style={styles.headerTrophyIcon} contentFit="contain" />
            <Animated.View style={[styles.headerBadge, badgeAnimStyle]}>
              <AppText variant="caps11" color={colors.primary.onText}>
                {trophyTotal > 9 ? '9+' : trophyTotal}
              </AppText>
            </Animated.View>
          </Pressable>
        </Animated.View>
        </FadeInView>

        {/* Strip de días */}
        <FadeInView delay={80}>
        <WeekStrip />

        </FadeInView>

        {isToday ? (
          <FadeInView delay={120}>
            <View style={styles.streakBlock}>
              <HomeStreakCard
                current={streak.current}
                lastWeek={streak.lastWeek}
                onPress={() => navigation.navigate('Achievements')}
              />
            </View>
          </FadeInView>
        ) : null}

        <FadeInView delay={160}>
        <ActiveSessionBanner />
        <ActiveIntervalSessionBanner />

        <SubscriptionBanner onPress={() => navigation.navigate('Subscription')} />
        <ExpiryWarningBanner onPress={() => navigation.navigate('Subscription')} />

        {/* Resumen del día */}
        <Card
          elevated
          style={[styles.dayCard, !isDark && styles.dayCardLight]}
          onPress={isToday ? () => navigation.navigate('Goals') : undefined}
        >
          <LinearGradient
            colors={
              isDark
                ? [colors.primary.muted, 'transparent']
                : [`${colors.gradients.kinetic[0]}55`, colors.surface.base]
            }
            locations={isDark ? [0, 1] : [0, 0.75]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.dayCardGlow}
            pointerEvents="none"
          />
          <View style={styles.dayCardContent}>
            <View style={styles.dayCardTop}>
              <View style={styles.dayCardTitleBlock}>
                <AppText variant="caps12" color={colors.text.tertiary}>
                  {t.home.goals_unit}
                </AppText>
                <AppText variant="body16SemiBold" color={colors.text.primary}>
                  {isToday ? t.home.today_title : t.home.past_title}
                </AppText>
              </View>
              <View style={[styles.dayCardCount, !isDark && styles.dayCardCountLight]}>
                <AppText variant="body14SemiBold" color={colors.primary.dark}>
                  {isToday ? `${completedGoals}/${goals.length || 0}` : '—'}
                </AppText>
              </View>
            </View>

            <View style={styles.dayCardProgressRow}>
              <ProgressBar
                progress={isToday ? goalProgress : 0}
                height={4}
                color={NUTRITION_MACRO_COLORS.carbs}
                trackColor={isDark ? undefined : colors.border.subtle}
                style={styles.dayCardBar}
              />
              {isToday && goals.length > 0 ? (
                <View style={styles.dayCardDots}>
                  {goals.map((goal) => (
                    <View
                      key={goal.id}
                      style={[styles.dayCardDot, goal.completed && styles.dayCardDotDone]}
                    />
                  ))}
                </View>
              ) : null}
            </View>

            <View style={styles.dayCardFooter}>
              <AppText variant="body12" color={colors.text.secondary} numberOfLines={1} style={styles.dayCardStatus}>
                {isToday
                  ? goalProgress >= 1
                    ? t.home.today_full
                    : completedGoals > 0
                      ? t.home.today_good
                      : t.home.today_start
                  : t.home.past_hint}
              </AppText>
              {isToday ? (
                <View style={styles.dayCardCta}>
                  <AppText
                    variant="body12SemiBold"
                    color={isDark ? colors.primary.default : colors.primary.dark}
                  >
                    {t.home.see_goals}
                  </AppText>
                  <Ionicons
                    name="chevron-forward"
                    size={13}
                    color={isDark ? colors.primary.default : colors.primary.dark}
                  />
                </View>
              ) : null}
            </View>
          </View>
        </Card>

        </FadeInView>

        <FadeInView delay={240}>
        {goalsLoading && goals.length === 0 ? <CardSkeleton /> : null}

        {nutritionLoading && dayMeals.length === 0 ? (
          <CardSkeleton />
        ) : (
          <HomeMacroProgressCard
            totals={totals}
            kcalGoal={kcalGoal}
            macroGoals={{ protein: macroGoals.protein, carbs: macroGoals.carbs }}
            title={macroCardTitle}
            onPress={() => navigation.getParent()?.navigate('NutritionTab' as never)}
          />
        )}

        </FadeInView>

        {/* Mi Progreso */}
        <FadeInView delay={320}>
        <View style={styles.sectionHeaderRow}>
          <AppText variant="h3" color={colors.text.primary}>
            {t.home.my_progress}
          </AppText>
          <Pressable
            onPress={() => navigation.getParent()?.navigate('ProgressTab' as never)}
            style={styles.seeAllBtn}
            accessibilityLabel={t.ui.see_all}
          >
            <AppText variant="body13SemiBold" color={colors.primary.default}>
              {t.ui.see_all}
            </AppText>
            <Ionicons name="arrow-forward" size={14} color={colors.primary.default} />
          </Pressable>
        </View>

        <View style={styles.progressGrid}>
          <View style={styles.progressGridRow}>
            <HomeProgressMetricCard
              label={t.home.weight}
              icon="scale-outline"
              value={latestWeight ? (latestWeight.weight_kg as number).toFixed(1) : '—'}
              suffix={latestWeight ? 'kg' : undefined}
              subtitle={weightSubtitle}
              accessibilityLabel="Ver peso corporal"
              onPress={() => navigateToProgress(latestWeight ? 'WeightDetail' : 'Measurements')}
            />
            <HomeProgressMetricCard
              label={t.home.steps}
              icon="walk"
              value={steps > 0 ? steps.toLocaleString('es-AR') : '—'}
              suffix={`/ ${clientConfig.defaultStepsGoal.toLocaleString('es-AR')}`}
              subtitle={stepsSubtitle}
              subtitleColor={healthConnected ? colors.text.tertiary : colors.text.secondary}
              subtitleIcon={healthConnected ? 'checkmark-circle' : undefined}
              progress={stepsProgress}
              accessibilityLabel={t.home.steps}
              onPress={navigateToHealthSettings}
            />
          </View>

          <View style={styles.progressGridRow}>
            <HomeProgressMetricCard
              label={t.home.hydration}
              icon="water"
              value={hydration ? (hydration.total_ml / 1000).toFixed(1) : '0.0'}
              suffix={`/ ${(hydrationGoalMl / 1000).toFixed(1)} L`}
              progress={hydrationProgress}
              accessibilityLabel="Ver hidratación"
              onPress={() => navigation.navigate('Hydration')}
            />
            <HomeProgressMetricCard
              label={t.home.next_workout}
              icon="barbell"
              value={
                trainedToday
                  ? t.home.trained_today
                  : nextWorkoutName ?? t.home.coach_hint
              }
              valueLarge={!trainedToday && Boolean(nextWorkoutName)}
              subtitle={
                trainedToday
                  ? undefined
                  : nextWorkoutDayLabel ?? (programStats.trainableCount === 0 ? t.home.no_program : undefined)
              }
              progress={
                programStats.trainableCount > 0
                  ? trainedToday
                    ? 1
                    : programStats.progress
                  : undefined
              }
              accessibilityLabel="Ver próximo entreno"
              onPress={() => navigation.getParent()?.navigate('TrainingTab' as never)}
            />
          </View>
        </View>

        {/* Fotos de progreso */}
        <Card style={[styles.photosCard, !isDark && styles.photosCardLight]}>
          <View style={styles.photosHeader}>
            <AppText variant="caps12" color={colors.text.tertiary}>
              {t.home.photos}
            </AppText>
            <View style={styles.photosActions}>
              <Pressable
                onPress={() => {
                  hapticSelect();
                  toggleHomePhotosHidden();
                }}
                style={({ pressed }) => [styles.photosActionBtn, pressed && styles.photosActionPressed]}
                accessibilityRole="button"
                accessibilityLabel={homePhotosHidden ? t.home.photos_show : t.home.photos_hide}
              >
                <Ionicons
                  name={homePhotosHidden ? 'eye-off-outline' : 'eye-outline'}
                  size={17}
                  color={colors.text.secondary}
                />
              </Pressable>
              <Pressable
                onPress={navigateToProgressPhotos}
                style={({ pressed }) => [styles.photosActionBtn, pressed && styles.photosActionPressed]}
                accessibilityRole="button"
                accessibilityLabel={t.ui.see_all}
              >
                <Ionicons name="chevron-forward" size={15} color={colors.text.tertiary} />
              </Pressable>
            </View>
          </View>

          <Pressable
            onPress={navigateToProgressPhotos}
            style={({ pressed }) => [styles.photosBody, pressed && styles.photosBodyPressed]}
            accessibilityRole="button"
            accessibilityLabel={t.home.photos}
          >
            {recentPhotos.length > 0 ? (
              <View style={styles.photoRow}>
                {recentPhotos.map((photo) => (
                  <View key={photo.id} style={styles.photoThumbWrap}>
                    <Image
                      source={photoUrls[photo.photo_url] ? { uri: photoUrls[photo.photo_url] } : undefined}
                      style={styles.photoThumb}
                      contentFit="cover"
                      transition={150}
                    />
                    {homePhotosHidden ? (
                      <BlurView
                        intensity={isDark ? 40 : 55}
                        tint={isDark ? 'dark' : 'light'}
                        style={styles.photoThumbBlur}
                      />
                    ) : null}
                  </View>
                ))}
                {photos.length > 3 ? (
                  <View style={styles.photoMore}>
                    <AppText variant="body13SemiBold" color={colors.text.secondary}>
                      +{photos.length - 3}
                    </AppText>
                  </View>
                ) : null}
              </View>
            ) : (
              <View style={styles.photoEmpty}>
                <View style={styles.photoEmptyIcon}>
                  <Ionicons name="camera-outline" size={22} color={colors.text.primary} />
                </View>
                <View style={styles.photoEmptyCopy}>
                  <AppText variant="body14Medium" color={colors.text.primary}>
                    {t.home.add_photo}
                  </AppText>
                  <AppText variant="body12" color={colors.text.tertiary}>
                    {t.home.photos_sub}
                  </AppText>
                </View>
                <Ionicons name="add-circle-outline" size={22} color={colors.text.tertiary} />
              </View>
            )}
          </Pressable>
        </Card>

        {/* Accesos rápidos */}
        <View style={styles.quickGrid}>
          {(
            [
              { key: 'messages', label: t.home.messages, icon: 'chatbubbles-outline' as const, adminOnly: false },
              { key: 'achievements', label: t.home.achievements, icon: 'trophy-outline' as const, adminOnly: false },
              { key: 'progress', label: t.home.my_progress, icon: 'stats-chart-outline' as const, adminOnly: false },
              { key: 'plan', label: t.home.my_plan, icon: 'card-outline' as const, adminOnly: false },
              { key: 'trainer', label: t.home.trainer, icon: 'people-circle-outline' as const, adminOnly: true },
            ]
          )
            .filter((item) => !item.adminOnly || isTrainer)
            .map((item) => (
              <Pressable
                key={item.key}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                onPress={() => {
                  switch (item.key) {
                    case 'messages':
                      navigation.navigate('Messages');
                      break;
                    case 'community':
                      navigation.navigate('Messages', { focus: 'groups' });
                      break;
                    case 'achievements':
                      navigation.navigate('Achievements');
                      break;
                    case 'progress':
                      navigateToProgress('Dashboard');
                      break;
                    case 'plan':
                      navigation.navigate('Subscription');
                      break;
                    case 'trainer':
                      navigation.navigate('TrainerPanel');
                      break;
                  }
                }}
                style={({ pressed }) => [styles.quickItem, pressed && styles.quickPressed]}
              >
                <Ionicons name={item.icon} size={22} color={colors.text.primary} />
                <AppText
                  variant="body12Medium"
                  color={colors.text.primary}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                  align="center"
                  style={styles.quickLabel}
                >
                  {item.label}
                </AppText>
              </Pressable>
            ))}
        </View>
        </FadeInView>

      </Animated.ScrollView>
    </View>
  );
}

const createStyles = (colors: Colors) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  headerAvatarRing: {
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.primary.default,
    padding: 2,
  },
  headerGreeting: { gap: 0 },
  headerName: { fontFamily: 'Inter_700Bold' },
  headerIconBtn: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface.elevated,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  headerTrophyBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  headerTrophyIcon: { width: 40, height: 40 },
  headerBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.primary.default,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.background,
  },
  streakBlock: {
    marginBottom: spacing.md,
  },
  dayCard: {
    marginBottom: spacing.md,
    overflow: 'hidden',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  dayCardLight: {
    backgroundColor: colors.surface.base,
    borderColor: colors.border.default,
  },
  dayCardGlow: { ...StyleSheet.absoluteFillObject },
  dayCardContent: { gap: spacing.xs },
  dayCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  dayCardTitleBlock: { flex: 1, gap: 1 },
  dayCardCount: {
    backgroundColor: colors.primary.muted,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: 3,
    minWidth: 40,
    alignItems: 'center',
  },
  dayCardCountLight: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  dayCardProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  dayCardBar: { flex: 1 },
  dayCardDots: { flexDirection: 'row', flexWrap: 'nowrap', gap: 4 },
  dayCardDot: {
    width: 6,
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  dayCardDotDone: {
    backgroundColor: colors.primary.default,
    borderColor: colors.primary.default,
  },
  dayCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  dayCardStatus: { flex: 1 },
  dayCardCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    flexShrink: 0,
  },
  miniHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  miniBar: { marginTop: spacing.sm },
  nextTitle: { marginTop: spacing.xs },
  miniSub: { marginTop: spacing.xxs },
  quickGrid: {
    flexDirection: 'row',
    alignItems: 'stretch',
    width: '100%',
    gap: spacing.xs,
  },
  quickItem: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface.elevated,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: 4,
  },
  quickPressed: { opacity: 0.7, transform: [{ scale: 0.96 }] },
  quickLabel: {
    width: '100%',
    paddingHorizontal: 2,
  },

  // Mi Progreso section
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
  },
  progressGrid: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  progressGridRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.sm,
  },

  // Photos section
  photosCard: {
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  photosCardLight: {
    borderColor: colors.border.default,
  },
  photosHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  photosActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
  },
  photosActionBtn: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface.elevated,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  photosActionPressed: { opacity: 0.75 },
  photosBody: {
    borderRadius: radius.md,
  },
  photosBodyPressed: { opacity: 0.9 },
  photoRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  photoThumbWrap: {
    flex: 1,
    height: 100,
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  photoThumb: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.surface.elevated,
  },
  photoThumbBlur: {
    ...StyleSheet.absoluteFillObject,
  },
  photoMore: {
    flex: 1,
    height: 100,
    borderRadius: radius.md,
    backgroundColor: colors.primary.muted,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  photoEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    backgroundColor: colors.background,
  },
  photoEmptyIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.surface.elevated,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoEmptyCopy: { flex: 1, gap: 2 },
});
