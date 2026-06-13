import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { illustrations, layout, radius, spacing, Colors, useThemedStyles, useTheme } from '../../theme';
import { greetingForNow, formatLongDate, todayISO } from '../../lib/dates';
import { clientConfig } from '../../config/clientConfig';
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
} from '../../components/common';
import { ActiveSessionBanner } from '../../components/training/ActiveSessionBanner';
import { useAuthStore } from '../../stores/authStore';
import { useGoalsStore } from '../../stores/goalsStore';
import { useNutritionStore } from '../../stores/nutritionStore';
import { useProgressStore } from '../../stores/progressStore';
import { useTrainingStore } from '../../stores/trainingStore';
import { computeStreak } from '../../services/streaks';
import { getTodaySteps } from '../../services/steps';
import { registerPushToken } from '../../services/notifications';
import type { HomeStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<HomeStackParamList, 'HomeMain'>;

export function HomeScreen({ navigation }: Props): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const userId = session?.user.id;

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
    ]);
    const [streakInfo, todaySteps] = await Promise.all([computeStreak(userId), getTodaySteps()]);
    setStreak(streakInfo.current);
    if (todaySteps !== null) {
      setSteps(todaySteps);
      void syncAutoGoal(userId, 'steps', todaySteps);
    }
  }, [userId, loadGoalsToday, loadNutritionDay, loadHydration, loadProgram, loadRecentLogs, setSteps, syncAutoGoal]);

  useEffect(() => {
    if (userId) void registerPushToken(userId);
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      void loadAll();
    }, [loadAll])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }, [loadAll]);

  const completedGoals = goals.filter((g) => g.completed).length;
  const goalProgress = goals.length > 0 ? completedGoals / goals.length : 0;
  const kcalProgress = kcalGoal > 0 ? totals.kcal / kcalGoal : 0;
  const hydrationProgress = hydration ? hydration.total_ml / Math.max(hydration.goal_ml, 1) : 0;

  const trainedToday = recentLogs.some((l) => l.date === todayISO());
  const nextWorkoutDay = phases
    .flatMap((p) => p.days)
    .find((d) => d.day_type !== 'descanso' && d.workout !== null);

  const firstName = profile?.full_name?.split(' ')[0] ?? 'Atleta';

  return (
    <View style={styles.flex}>
      <ProgressiveBlurHeader title={clientConfig.appName} scrollY={scrollY} />
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{
          paddingTop: insets.top + spacing.md,
          paddingBottom: layout.tabBarHeight + spacing.xxl,
          paddingHorizontal: layout.screenPadding,
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={colors.primary.default} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Encabezado con saludo + mascota */}
        <View style={styles.header}>
          <View style={styles.headerText}>
            <AppText variant="body14" color={colors.text.tertiary}>
              {formatLongDate(todayISO())}
            </AppText>
            <AppText variant="h1" color={colors.text.primary} style={styles.greeting}>
              {greetingForNow()}, {firstName}
            </AppText>
            <View style={styles.streakRow}>
              <Ionicons name="flame" size={16} color={colors.primary.default} />
              <AppText variant="body13SemiBold" color={colors.primary.default}>
                {streak > 0 ? `Racha de ${streak} ${streak === 1 ? 'día' : 'días'}` : 'Arrancá tu racha hoy'}
              </AppText>
            </View>
          </View>
          <Pressable onPress={() => navigation.navigate('Profile')} accessibilityLabel="Ir a mi perfil">
            <Avatar name={profile?.full_name} imageUrl={profile?.avatar_url} size={48} />
          </Pressable>
        </View>

        <ActiveSessionBanner />

        {/* Anillo de objetivo del día */}
        <Card elevated style={styles.dayCard} onPress={() => navigation.navigate('Goals')}>
          <View style={styles.dayCardRow}>
            <ProgressRing progress={goalProgress} size={110} strokeWidth={10}>
              <AppText variant="metricMedium" color={colors.text.primary}>
                {completedGoals}/{goals.length || 0}
              </AppText>
              <AppText variant="caps11" color={colors.text.tertiary}>
                Metas
              </AppText>
            </ProgressRing>
            <View style={styles.dayCardInfo}>
              <AppText variant="h3" color={colors.text.primary}>
                Tu día de hoy
              </AppText>
              <AppText variant="body13" color={colors.text.secondary} style={styles.dayCardSub}>
                {goalProgress >= 1
                  ? '¡Día completo! Sos imparable.'
                  : completedGoals > 0
                    ? 'Buen ritmo, seguí así.'
                    : 'Completá tus metas para sumar racha.'}
              </AppText>
              <View style={styles.dayCardLink}>
                <AppText variant="body13SemiBold" color={colors.primary.default}>
                  Ver metas
                </AppText>
                <Ionicons name="arrow-forward" size={14} color={colors.primary.default} />
              </View>
            </View>
            <Image source={illustrations.pillarHeader.progress} style={styles.dayMascot} contentFit="contain" />
          </View>
        </Card>

        {goalsLoading && goals.length === 0 ? <CardSkeleton /> : null}

        {/* Métricas del día */}
        <View style={styles.metricsRow}>
          <MetricCard
            label="Calorías"
            value={String(Math.round(totals.kcal))}
            unit={`/ ${kcalGoal} kcal`}
            icon="flame-outline"
            onPress={() => navigation.getParent()?.navigate('NutritionTab' as never)}
            style={styles.metricHalf}
          />
          <MetricCard
            label="Pasos"
            value={steps > 0 ? steps.toLocaleString('es-AR') : '—'}
            unit={`/ ${clientConfig.defaultStepsGoal.toLocaleString('es-AR')}`}
            icon="walk-outline"
            onPress={() => navigation.getParent()?.navigate('ProgressTab' as never)}
            style={styles.metricHalf}
          />
        </View>

        {/* Macros del día */}
        <Card style={styles.macrosCard}>
          <AppText variant="caps12" color={colors.text.tertiary} style={styles.macrosTitle}>
            Macros de hoy
          </AppText>
          {(
            [
              { key: 'P', label: 'Proteínas', value: totals.protein, goal: macroGoals.protein, color: colors.primary.default },
              { key: 'C', label: 'Carbohidratos', value: totals.carbs, goal: macroGoals.carbs, color: colors.primary.dark },
              { key: 'G', label: 'Grasas', value: totals.fat, goal: macroGoals.fat, color: colors.primary.deep },
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

        {/* Hidratación + Entreno */}
        <View style={styles.metricsRow}>
          <Card style={styles.metricHalf} onPress={() => navigation.navigate('Hydration')}>
            <View style={styles.miniHeader}>
              <AppText variant="caps12" color={colors.text.tertiary}>
                Hidratación
              </AppText>
              <Ionicons name="water-outline" size={16} color={colors.pillars.nutrition} />
            </View>
            <AppText variant="metricMedium" color={colors.text.primary}>
              {hydration ? (hydration.total_ml / 1000).toFixed(1) : '0.0'}
              <AppText variant="body13Medium" color={colors.text.tertiary}>
                {' '}
                / {((hydration?.goal_ml ?? clientConfig.defaultHydrationGoalMl) / 1000).toFixed(1)} L
              </AppText>
            </AppText>
            <ProgressBar progress={hydrationProgress} style={styles.miniBar} color={colors.pillars.nutrition} />
          </Card>

          <Card style={styles.metricHalf} onPress={() => navigation.getParent()?.navigate('TrainingTab' as never)}>
            <View style={styles.miniHeader}>
              <AppText variant="caps12" color={colors.text.tertiary}>
                Próximo entreno
              </AppText>
              <Ionicons name="barbell-outline" size={16} color={colors.pillars.training} />
            </View>
            <AppText variant="body16SemiBold" color={colors.text.primary} numberOfLines={2}>
              {trainedToday ? '¡Ya entrenaste hoy!' : nextWorkoutDay?.title ?? 'Sin programa aún'}
            </AppText>
            <AppText variant="body12" color={colors.text.tertiary} style={styles.miniSub}>
              {trainedToday ? 'Descansá y recuperá' : nextWorkoutDay?.workout?.title ?? 'Hablá con tu coach'}
            </AppText>
          </Card>
        </View>

        {/* Anillo de calorías + accesos rápidos */}
        <SectionHeader title="Accesos rápidos" />
        <View style={styles.quickGrid}>
          {(
            [
              { label: 'Comunidad', icon: 'people-outline', screen: 'Community' },
              { label: 'Coach', icon: 'chatbubbles-outline', screen: 'CoachChat' },
              { label: 'Logros', icon: 'trophy-outline', screen: 'Achievements' },
              { label: 'Mi plan', icon: 'card-outline', screen: 'Subscription' },
            ] as const
          ).map((item) => (
            <Pressable
              key={item.screen}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              onPress={() => navigation.navigate(item.screen)}
              style={({ pressed }) => [styles.quickItem, pressed && styles.quickPressed]}
            >
              <View style={styles.quickIcon}>
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
                kcal restantes para tu objetivo
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
  greeting: { marginTop: 2 },
  streakRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs, marginTop: spacing.xs },
  dayCard: { marginBottom: spacing.md },
  dayCardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  dayCardInfo: { flex: 1 },
  dayCardSub: { marginTop: spacing.xxs },
  dayCardLink: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs, marginTop: spacing.sm },
  dayMascot: { width: 64, height: 80, position: 'absolute', right: -spacing.xs, bottom: -spacing.md, opacity: 0.9 },
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
});
