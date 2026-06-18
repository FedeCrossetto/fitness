import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { layout, radius, spacing, Colors, useThemedStyles, useTheme } from '../../theme';
import { todayISO, formatShortDate } from '../../lib/dates';
import { supabase } from '../../lib/supabase';
import { useTranslation } from '../../stores/i18nStore';
import { useClientConfig } from '../../config/useClientConfig';
import {
  AppText,
  Avatar,
  Card,
  CardSkeleton,
  MetricCard,
  ProgressBar,
  ProgressRing,
  ProgressiveBlurHeader,
  SectionHeader,
  WeekStrip,
} from '../../components/common';
import { ActiveSessionBanner } from '../../components/training/ActiveSessionBanner';
import { useAuthStore } from '../../stores/authStore';
import { useGoalsStore } from '../../stores/goalsStore';
import { useNutritionStore } from '../../stores/nutritionStore';
import { useProgressStore } from '../../stores/progressStore';
import { useTrainingStore } from '../../stores/trainingStore';
import { computeStreak } from '../../services/streaks';
import { signedUrl } from '../../services/storage';
import { fetchTodaySteps } from '../../services/steps';
import { useStepsAutoSync } from '../../hooks/useStepsAutoSync';
import { useTabBarScrollPadding } from '../../hooks/useTabBarScrollPadding';
import { syncPushRegistration } from '../../services/notifications';
import { hapticSelect } from '../../lib/haptics';
import { useUiStore } from '../../stores/uiStore';
import { Platform } from 'react-native';
import type { HomeStackParamList } from '../../types/navigation';

const CALORIES_ORANGE = '#F97316';

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

  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const userId = session?.user.id;
  const isTrainer = profile?.role === 'trainer' || profile?.role === 'admin';

  const goals = useGoalsStore((s) => s.goals);
  const goalsLoading = useGoalsStore((s) => s.loading);
  const loadGoalsToday = useGoalsStore((s) => s.loadToday);
  const syncAutoGoal = useGoalsStore((s) => s.syncAutoGoal);

  const meals = useNutritionStore((s) => s.meals);
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

  const [streak, setStreak] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const totals = useMemo(
    () =>
      meals.reduce(
        (acc, m) => {
          if (!m.is_included) return acc;
          return {
            kcal: acc.kcal + (m.energy_kcal ?? 0),
            protein: acc.protein + (m.protein_g ?? 0),
            carbs: acc.carbs + (m.carbs_g ?? 0),
            fat: acc.fat + (m.fat_g ?? 0),
          };
        },
        { kcal: 0, protein: 0, carbs: 0, fat: 0 }
      ),
    [meals]
  );

  const loadAll = useCallback(async () => {
    if (!userId) return;
    await Promise.all([
      loadGoalsToday(userId),
      loadNutritionDay(userId),
      loadHydration(userId),
      loadProgram(),
      loadRecentLogs(userId),
      loadMeasurements(userId),
      loadPhotos(userId),
    ]);
    const streakInfo = await computeStreak(userId);
    setStreak(streakInfo.current);
    // Solo refrescar pasos si el usuario ya conectó explícitamente
    if (useProgressStore.getState().healthConnected) {
      const todaySteps = await fetchTodaySteps(true);
      if (todaySteps !== null) {
        setSteps(todaySteps);
        void syncAutoGoal(userId, 'steps', todaySteps);
      }
    }
  }, [userId, loadGoalsToday, loadNutritionDay, loadHydration, loadProgram, loadRecentLogs, setSteps, syncAutoGoal]);

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
  const kcalProgress = kcalGoal > 0 ? totals.kcal / kcalGoal : 0;

  const activeDate = useUiStore((s) => s.activeDate);
  const today = todayISO();
  const isToday = activeDate === today;

  // Progress metrics derivados de las mediciones
  const weightHistory = useMemo(
    () => measurements.filter((m) => m.weight_kg !== null).sort((a, b) => (a.date < b.date ? 1 : -1)),
    [measurements]
  );
  const latestWeight = weightHistory[0] ?? null;
  const latestFat = measurements.find((m) => m.body_fat_pct !== null) ?? null;
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
  const nextWorkoutDay = phases
    .flatMap((p) => p.days)
    .find((d) => d.day_type !== 'descanso' && d.workout !== null);
  const nextWorkoutName = nextWorkoutDay?.workout?.title?.split(' — ')[0]
    ?? nextWorkoutDay?.title
    ?? null;
  const nextWorkoutDayLabel = nextWorkoutDay?.title?.match(/D[ií]a\s+\d+/i)?.[0] ?? null;

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

  // Mensajes sin leer del coach → badge en el header, en vivo.
  const [unreadMsgs, setUnreadMsgs] = useState(0);
  useEffect(() => {
    if (!userId) return;
    let active = true;
    const fetchUnread = async () => {
      const { count } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', userId)
        .eq('sender_role', 'trainer')
        .eq('read', false);
      if (active) setUnreadMsgs(count ?? 0);
    };
    void fetchUnread();
    const channel = supabase
      .channel(`home-msgs-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `client_id=eq.${userId}` }, () => void fetchUnread())
      .subscribe();
    return () => { active = false; void supabase.removeChannel(channel); };
  }, [userId]);

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
        <View style={styles.header}>
          <View style={styles.headerText}>
            <AppText variant="h1" color={colors.text.primary} style={styles.greeting}>
              {t.greeting.morning}, {firstName}
            </AppText>
            <View style={styles.streakRow}>
              <Ionicons name="flame" size={16} color={CALORIES_ORANGE} />
              <AppText variant="body13SemiBold" color={colors.primary.default}>
                {streak > 0
                  ? i18n(t.greeting.streak, { n: streak, unit: streak === 1 ? t.greeting.streak_day : t.greeting.streak_days })
                  : t.greeting.streak_start}
              </AppText>
            </View>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              onPress={() => navigation.navigate('CoachChat')}
              accessibilityLabel={unreadMsgs > 0 ? `Mensajes, ${unreadMsgs} sin leer` : 'Mensajes con tu coach'}
              style={styles.headerIconBtn}
              hitSlop={8}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={22} color={colors.text.primary} />
              {unreadMsgs > 0 ? (
                <View style={styles.headerBadge}>
                  <AppText variant="caps11" color={colors.primary.onText}>
                    {unreadMsgs > 9 ? '9+' : unreadMsgs}
                  </AppText>
                </View>
              ) : null}
            </Pressable>
            <Pressable onPress={() => navigation.navigate('Profile')} accessibilityLabel="Ir a mi perfil">
              <Avatar name={profile?.full_name} imageUrl={profile?.avatar_url} size={48} />
            </Pressable>
          </View>
        </View>

        {/* Strip de días */}
        <WeekStrip />

        <ActiveSessionBanner />

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
                color={goalProgress >= 1 ? colors.states.success : colors.primary.default}
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

        {goalsLoading && goals.length === 0 ? <CardSkeleton /> : null}

        {/* Métricas del día */}
        <View style={styles.metricsRow}>
          <MetricCard
            label={t.home.calories}
            value={String(Math.round(totals.kcal))}
            unit={`/ ${kcalGoal} kcal`}
            icon="flame"
            accent={CALORIES_ORANGE}
            onPress={() => navigation.getParent()?.navigate('NutritionTab' as never)}
            style={styles.metricHalf}
          />
          <MetricCard
            label={t.home.steps}
            value={steps > 0 ? steps.toLocaleString('es-AR') : '—'}
            unit={`/ ${clientConfig.defaultStepsGoal.toLocaleString('es-AR')}`}
            icon="walk"
            labelBadge={
              healthConnected
                ? Platform.OS === 'ios' ? t.home.apple_health : t.home.health_connect
                : Platform.OS === 'ios'
                  ? t.home.connect_ios
                  : t.home.connect_android
            }
            labelBadgeIcon={healthConnected ? 'checkmark-circle' : undefined}
            labelBadgeColor={colors.primary.default}
            onPress={navigateToHealthSettings}
            style={styles.metricHalf}
          />
        </View>

        {/* Macros del día */}
        <Card style={styles.macrosCard}>
          <AppText variant="caps12" color={colors.text.tertiary} style={styles.macrosTitle}>
            {t.home.macros}
          </AppText>
          {(
            [
              { key: 'P', label: t.home.proteins, value: totals.protein, goal: macroGoals.protein, color: colors.primary.default },
              { key: 'C', label: t.home.carbs, value: totals.carbs, goal: macroGoals.carbs, color: colors.primary.dark },
              { key: 'G', label: t.home.fats, value: totals.fat, goal: macroGoals.fat, color: colors.primary.deep },
            ] as const
          ).map((macro) => (
            <View key={macro.key} style={styles.macroRow}>
              <AppText variant="body13Medium" color={colors.text.secondary} style={styles.macroLabel}>
                {macro.label}
              </AppText>
              <ProgressBar progress={macro.goal > 0 ? macro.value / macro.goal : 0} color={macro.color} style={styles.macroBar} />
              <AppText variant="body12Medium" color={colors.text.tertiary} style={styles.macroValue}>
                {Math.round(macro.value)}/{macro.goal}g
              </AppText>
            </View>
          ))}
        </Card>

        {/* Mi Progreso */}
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
          {/* Peso corporal */}
          <Pressable
            style={styles.progressCard}
            onPress={() => navigateToProgress(latestWeight ? 'WeightDetail' : 'Measurements')}
            accessibilityLabel="Ver peso corporal"
          >
            <View style={styles.progressCardHead}>
              <AppText variant="caps11" color={colors.text.tertiary} style={styles.progressCardLabelInline}>
                {t.home.weight}
              </AppText>
              <View style={styles.progressCardIcon} />
            </View>
            <View style={styles.progressCardMeta}>
              {latestWeight ? (
                <AppText variant="body12" color={colors.text.tertiary} numberOfLines={1}>
                  {formatShortDate(latestWeight.date)}
                </AppText>
              ) : null}
            </View>
            <View style={styles.progressCardBody}>
              {latestWeight ? (
                <View style={styles.progressValueRow}>
                  <AppText variant="metricMedium" color={colors.text.primary}>
                    {(latestWeight.weight_kg as number).toFixed(1)}
                  </AppText>
                  <AppText variant="body13Medium" color={colors.text.tertiary} style={styles.progressUnit}>
                    kg
                  </AppText>
                </View>
              ) : (
                <AppText variant="body16SemiBold" color={colors.text.tertiary} style={styles.progressEmpty}>
                  ...
                </AppText>
              )}
            </View>
            {latestWeight ? (
              <View style={[styles.progressBar, { backgroundColor: colors.primary.default }]} />
            ) : null}
          </Pressable>

          {/* % Grasa */}
          <Pressable
            style={styles.progressCard}
            onPress={() => navigateToProgress('Measurements')}
            accessibilityLabel="Ver porcentaje de grasa corporal"
          >
            <View style={styles.progressCardHead}>
              <AppText variant="caps11" color={colors.text.tertiary} style={styles.progressCardLabelInline}>
                {t.home.body_fat}
              </AppText>
              <View style={styles.progressCardIcon} />
            </View>
            <View style={styles.progressCardMeta}>
              {latestFat ? (
                <AppText variant="body12" color={colors.text.tertiary} numberOfLines={1}>
                  {formatShortDate(latestFat.date)}
                </AppText>
              ) : null}
            </View>
            <View style={styles.progressCardBody}>
              {latestFat ? (
                <View style={styles.progressValueRow}>
                  <AppText variant="metricMedium" color={colors.text.primary}>
                    {(latestFat.body_fat_pct as number).toFixed(1)}
                  </AppText>
                  <AppText variant="body13Medium" color={colors.text.tertiary} style={styles.progressUnit}>
                    %
                  </AppText>
                </View>
              ) : (
                <AppText variant="body16SemiBold" color={colors.text.tertiary} style={styles.progressEmpty}>
                  ...
                </AppText>
              )}
            </View>
          </Pressable>

          {/* Hidratación */}
          <Pressable
            style={styles.progressCard}
            onPress={() => navigation.navigate('Hydration')}
            accessibilityLabel="Ver hidratación"
          >
            <View style={styles.progressCardHead}>
              <AppText variant="caps11" color={colors.text.tertiary} style={styles.progressCardLabelInline}>
                {t.home.hydration}
              </AppText>
              <View style={styles.progressCardIcon}>
                <Ionicons name="water" size={14} color={colors.water} />
              </View>
            </View>
            <View style={styles.progressCardMeta} />
            <View style={styles.progressCardBody}>
              <View style={styles.progressValueRow}>
                <AppText variant="metricMedium" color={colors.text.primary}>
                  {hydration ? (hydration.total_ml / 1000).toFixed(1) : '0.0'}
                </AppText>
                <AppText variant="body13Medium" color={colors.text.tertiary} style={styles.progressUnit}>
                  / {((hydration?.goal_ml ?? clientConfig.defaultHydrationGoalMl) / 1000).toFixed(1)} L
                </AppText>
              </View>
            </View>
            <ProgressBar
              progress={hydration ? hydration.total_ml / Math.max(hydration.goal_ml, 1) : 0}
              style={styles.progressHydrationBar}
              color={colors.water}
            />
          </Pressable>

          {/* Próximo entreno */}
          <Pressable
            style={styles.progressCard}
            onPress={() => navigation.getParent()?.navigate('TrainingTab' as never)}
            accessibilityLabel="Ver próximo entreno"
          >
            <View style={styles.progressCardHead}>
              <AppText variant="caps11" color={colors.text.tertiary} style={styles.progressCardLabelInline}>
                {t.home.next_workout}
              </AppText>
              <View style={styles.progressCardIcon}>
                <Ionicons name="barbell" size={14} color={colors.pillars.training} />
              </View>
            </View>
            <View style={styles.progressCardMeta}>
              {!trainedToday && nextWorkoutDayLabel ? (
                <AppText variant="body12" color={colors.text.tertiary} numberOfLines={1}>
                  {nextWorkoutDayLabel}
                </AppText>
              ) : null}
            </View>
            <View style={styles.progressCardBody}>
              {trainedToday ? (
                <AppText variant="body16SemiBold" color={colors.text.primary} numberOfLines={2}>
                  {t.home.trained_today}
                </AppText>
              ) : nextWorkoutName ? (
                <AppText variant="body16SemiBold" color={colors.text.primary} numberOfLines={2}>
                  {nextWorkoutName}
                </AppText>
              ) : (
                <AppText variant="body13" color={colors.text.tertiary} numberOfLines={2}>
                  {t.home.coach_hint}
                </AppText>
              )}
            </View>
            {!trainedToday && nextWorkoutName ? (
              <View style={[styles.progressBar, { backgroundColor: colors.pillars.training }]} />
            ) : null}
          </Pressable>
        </View>

        {/* Fotos de progreso */}
        <Card style={[styles.photosCard, !isDark && styles.photosCardLight]}>
          <View style={styles.photosHeader}>
            <View style={styles.photosTitleBlock}>
              <View style={styles.photosTitleRow}>
                <View style={styles.photosIconWrap}>
                  <Ionicons name="images" size={16} color={colors.primary.default} />
                </View>
                <AppText variant="body14SemiBold" color={colors.text.primary}>
                  {t.home.photos}
                </AppText>
              </View>
              <AppText variant="body12" color={colors.text.tertiary} style={styles.photosSubtitle}>
                {t.home.photos_sub}
              </AppText>
            </View>
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
                  size={18}
                  color={colors.text.secondary}
                />
              </Pressable>
              <Pressable
                onPress={navigateToProgressPhotos}
                style={({ pressed }) => [styles.photosActionBtn, pressed && styles.photosActionPressed]}
                accessibilityRole="button"
                accessibilityLabel={t.ui.see_all}
              >
                <Ionicons name="chevron-forward" size={16} color={colors.text.tertiary} />
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
                  <Ionicons name="camera-outline" size={22} color={colors.primary.default} />
                </View>
                <View style={styles.photoEmptyCopy}>
                  <AppText variant="body14Medium" color={colors.text.primary}>
                    {t.home.add_photo}
                  </AppText>
                  <AppText variant="body12" color={colors.text.tertiary}>
                    {t.home.photos_sub}
                  </AppText>
                </View>
                <Ionicons name="add-circle-outline" size={22} color={colors.primary.default} />
              </View>
            )}
          </Pressable>
        </Card>

        {/* Accesos rápidos */}
        <SectionHeader title={t.home.quick_access} />
        <View style={styles.quickGrid}>
          {(
            [
              { label: t.home.community, icon: 'people-outline', screen: 'Community', adminOnly: false },
              { label: t.home.coach,     icon: 'chatbubbles-outline', screen: 'CoachChat', adminOnly: false },
              { label: t.home.achievements, icon: 'trophy-outline', screen: 'Achievements', adminOnly: false },
              { label: t.home.my_plan,   icon: 'card-outline', screen: 'Subscription', adminOnly: false },
              { label: t.home.trainer,   icon: 'people-circle-outline', screen: 'TrainerPanel', adminOnly: true },
            ] as const
          )
            .filter((item) => !item.adminOnly || isTrainer)
            .map((item) => (
              <Pressable
                key={item.screen}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                onPress={() => navigation.navigate(item.screen)}
                style={({ pressed }) => [styles.quickItem, pressed && styles.quickPressed]}
              >
                <View style={[
                  styles.quickIcon,
                  item.adminOnly && { backgroundColor: colors.primary.muted },
                ]}>
                  <Ionicons name={item.icon} size={20} color={colors.primary.default} />
                </View>
                <AppText variant="body12Medium" color={colors.text.secondary}>
                  {item.label}
                </AppText>
              </Pressable>
            ))}
        </View>

        {/* Resumen kcal extendido */}
        <Card elevated style={styles.kcalCard} onPress={() => navigation.getParent()?.navigate('NutritionTab' as never)}>
          <View style={styles.kcalRow}>
            <View style={styles.kcalInfo}>
              <AppText variant="caps12" color={colors.text.tertiary}>
                Balance calórico
              </AppText>
              <AppText variant="metricLarge" color={colors.text.primary}>
                {Math.max(0, Math.round(kcalGoal - totals.kcal))}
              </AppText>
          <AppText variant="body13" color={colors.text.secondary}>
              {t.home.kcal_left}
            </AppText>
            </View>
            <ProgressRing progress={kcalProgress} size={92} strokeWidth={9} color={colors.pillars.training}>
              <AppText variant="body14SemiBold" color={colors.text.primary}>
                {Math.round(kcalProgress * 100)}%
              </AppText>
            </ProgressRing>
          </View>
        </Card>
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
  headerText: { flex: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface.elevated,
  },
  headerBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.primary.default,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.background,
  },
  greeting: { marginTop: 2 },
  streakRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs, marginTop: spacing.xs },
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
  metricsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  metricHalf: { flex: 1 },
  macrosCard: { marginBottom: spacing.sm },
  macrosTitle: { marginBottom: spacing.sm },
  macroRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  macroLabel: { width: 110 },
  macroBar: { flex: 1 },
  macroValue: { width: 70, textAlign: 'right' },
  miniHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  miniBar: { marginTop: spacing.sm },
  nextTitle: { marginTop: spacing.xs },
  miniSub: { marginTop: spacing.xxs },
  quickGrid: { flexDirection: 'row', gap: spacing.sm },
  quickItem: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface.base,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
  },
  quickPressed: { opacity: 0.8 },
  quickIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.primary.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kcalCard: { marginTop: spacing.xl },
  kcalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kcalInfo: { flex: 1 },

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
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  progressCard: {
    width: '48%',
    flexGrow: 1,
    minHeight: 118,
    backgroundColor: colors.surface.base,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderRadius: radius.lg,
    padding: spacing.md,
    overflow: 'hidden',
  },
  progressCardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 14,
  },
  progressCardLabelInline: {
    letterSpacing: 0.6,
    flex: 1,
  },
  progressCardIcon: {
    width: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressCardMeta: {
    height: 18,
    marginTop: spacing.xxs,
    justifyContent: 'center',
  },
  progressCardBody: {
    minHeight: 40,
    justifyContent: 'flex-end',
    marginTop: spacing.xxs,
  },
  progressHydrationBar: {
    marginTop: spacing.sm,
  },
  progressValueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.xxs,
  },
  progressUnit: {
    marginBottom: spacing.xs,
  },
  progressEmpty: {
    letterSpacing: 2,
  },
  progressBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
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
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  photosTitleBlock: { flex: 1, gap: 2 },
  photosTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  photosIconWrap: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    backgroundColor: colors.primary.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photosSubtitle: { marginLeft: 28 + spacing.xs },
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
    width: 80,
    height: 80,
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
    width: 80,
    height: 80,
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
    backgroundColor: colors.primary.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoEmptyCopy: { flex: 1, gap: 2 },
});
