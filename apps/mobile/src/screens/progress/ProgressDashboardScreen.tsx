import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, Dimensions, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Device from 'expo-device';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ProgressStackParamList } from '../../types/navigation';
import { layout, radius, spacing, Colors, useThemedStyles, useTheme } from '../../theme';
import { formatShortDate } from '../../lib/dates';
import {
  AppText,
  Button,
  Card,
  CardSkeleton,
  EmptyState,
  ErrorState,
  HeaderAvatar,
} from '../../components/common';
import { BarChart, LineChart } from '../../components/charts';
import { MeasurementHistoryList, ProgressToolsMenu } from '../../components/progress';
import { useAuthStore } from '../../stores/authStore';
import { useProgressStore } from '../../stores/progressStore';
import { useTrainingStore } from '../../stores/trainingStore';
import { useUiStore } from '../../stores/uiStore';
import { useTranslation } from '../../stores/i18nStore';
import { readHealthSnapshot } from '../../services/health';
import { connectTodaySteps } from '../../services/steps';
import { showPlatformHealthError } from '../../services/healthPlatform';
import type { HealthSnapshot } from '../../services/health';
import { useTabBarScrollPadding } from '../../hooks/useTabBarScrollPadding';

type Props = NativeStackScreenProps<ProgressStackParamList, 'Dashboard'>;

const CHART_WIDTH = Dimensions.get('window').width - layout.screenPadding * 2 - spacing.md * 2;

interface StatCellProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  unit?: string;
}

function StatCell({ icon, label, value, unit }: StatCellProps): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <View style={statStyles.cell}>
      <Ionicons name={icon} size={15} color={colors.text.tertiary} />
      <AppText variant="caps11" color={colors.text.tertiary} numberOfLines={1}>
        {label}
      </AppText>
      <View style={statStyles.valueRow}>
        <AppText variant="body16SemiBold" color={colors.text.primary}>
          {value}
        </AppText>
        {unit ? (
          <AppText variant="body12Medium" color={colors.text.tertiary}>
            {unit}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

export function ProgressDashboardScreen({ navigation }: Props): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { t, language } = useTranslation();

  const insets = useSafeAreaInsets();
  const scrollBottom = useTabBarScrollPadding();

  const session = useAuthStore((s) => s.session);
  const userId = session?.user.id;

  const measurements = useProgressStore((s) => s.measurements);
  const measurementsLoading = useProgressStore((s) => s.measurementsLoading);
  const measurementsError = useProgressStore((s) => s.measurementsError);
  const loadMeasurements = useProgressStore((s) => s.loadMeasurements);
  const steps = useProgressStore((s) => s.steps);
  const setSteps = useProgressStore((s) => s.setSteps);
  const setHealthConnected = useProgressStore((s) => s.setHealthConnected);
  const recentLogs = useTrainingStore((s) => s.recentLogs);
  const loadRecentLogs = useTrainingStore((s) => s.loadRecentLogs);

  const [refreshing, setRefreshing] = useState(false);
  const [snapshot, setSnapshot] = useState<HealthSnapshot | null>(null);
  const [connecting, setConnecting] = useState(false);

  const goMeasurements = useCallback(() => navigation.navigate('Measurements'), [navigation]);

  const loadAll = useCallback(async () => {
    if (!userId) return;
    await Promise.all([loadMeasurements(userId), loadRecentLogs(userId)]);
    if (useProgressStore.getState().healthConnected) {
      const healthSnapshot = await readHealthSnapshot();
      if (healthSnapshot?.steps !== null && healthSnapshot?.steps !== undefined) {
        setSteps(healthSnapshot.steps);
      }
      setSnapshot(healthSnapshot);
    }
  }, [userId, loadMeasurements, loadRecentLogs, setSteps]);

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

  const weightHistory = useMemo(
    () =>
      measurements
        .filter((m) => m.weight_kg !== null)
        .sort((a, b) => (a.date < b.date ? -1 : 1)),
    [measurements]
  );

  const chartData = useMemo(
    () =>
      weightHistory.map((m) => ({
        label: formatShortDate(m.date),
        value: m.weight_kg as number,
      })),
    [weightHistory]
  );

  const currentWeight = weightHistory.length > 0 ? (weightHistory[weightHistory.length - 1]!.weight_kg as number) : null;
  const previousWeight = weightHistory.length > 1 ? (weightHistory[weightHistory.length - 2]!.weight_kg as number) : null;
  const weightDelta = currentWeight !== null && previousWeight !== null ? currentWeight - previousWeight : null;

  const weeklyActivity = useMemo(() => {
    const days: { label: string; value: number }[] = [];
    const dayLetters = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      const minutes = recentLogs
        .filter((l) => l.date === iso)
        .reduce((acc, l) => acc + (l.duration_min ?? 0), 0);
      days.push({ label: dayLetters[d.getDay()]!, value: minutes });
    }
    return days;
  }, [recentLogs]);
  const hasWeeklyActivity = weeklyActivity.some((d) => d.value > 0);

  const latestFat = measurements.find((m) => m.body_fat_pct !== null)?.body_fat_pct ?? null;
  const leanMass = currentWeight !== null && latestFat !== null ? currentWeight * (1 - latestFat / 100) : null;

  const locale = language === 'en' ? 'en-US' : 'es-AR';

  const connectHealth = useCallback(async () => {
    setConnecting(true);
    const result = await connectTodaySteps();
    if (result.ok) {
      setSteps(result.steps);
      setHealthConnected(true);
      const healthSnapshot = await readHealthSnapshot();
      setSnapshot(healthSnapshot);
      useUiStore.getState().showToast('success', t.progress.connect);
    } else {
      void showPlatformHealthError(result, {
        no_access: t.progress.hk_no_access,
        health_no_perm_ios: t.progress.hk_perm_msg,
        health_no_perm_and: t.progress.hk_perm_msg,
        health_needs_hc_update: t.progress.hk_sub,
        health_open: t.progress.connect,
        health_open_hc: t.progress.connect,
        install_hc: t.progress.connect,
        cancel: t.ui.cancel,
      });
    }
    setConnecting(false);
  }, [setHealthConnected, setSteps, t]);

  const disconnectHealth = useCallback(() => {
    Alert.alert(t.progress.disc_title, t.progress.disc_msg, [
      { text: t.ui.cancel, style: 'cancel' },
      {
        text: t.progress.disc_action,
        style: 'destructive',
        onPress: () => {
          setSnapshot(null);
          setSteps(0);
          setHealthConnected(false);
          useUiStore.getState().showToast('success', t.progress.hk_disconnected);
        },
      },
    ]);
  }, [setSteps, setHealthConnected, t]);

  const isLoading = measurementsLoading && measurements.length === 0;
  const hasError = measurementsError !== null && measurements.length === 0;
  const hasWeight = weightHistory.length > 0;

  return (
    <ScrollView
      style={styles.flex}
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
      <View style={styles.header}>
        <View style={styles.headerText}>
          <AppText variant="caps12" color={colors.text.tertiary}>
            {t.progress.evolution}
          </AppText>
          <AppText variant="h1" color={colors.text.primary} style={styles.title}>
            {t.progress.title}
          </AppText>
        </View>
        <HeaderAvatar />
      </View>

      {isLoading ? (
        <>
          <CardSkeleton />
          <CardSkeleton />
        </>
      ) : hasError ? (
        <ErrorState message={measurementsError} onRetry={() => void loadAll()} />
      ) : (
        <>
          {!hasWeight ? (
            <View style={styles.emptyState}>
              <EmptyState
                pillar="progress"
                title={t.progress.no_records}
                message={t.progress.record_weight}
                actionLabel={t.progress.add_weight}
                onAction={goMeasurements}
              />
            </View>
          ) : (
            <Card elevated style={styles.heroCard} onPress={() => navigation.navigate('WeightDetail')}>
              <View style={styles.weightHeader}>
                <AppText variant="caps12" color={colors.text.tertiary}>
                  {t.progress.weight}
                </AppText>
                <Ionicons name="chevron-forward" size={16} color={colors.text.tertiary} />
              </View>
              <View style={styles.weightRow}>
                <AppText variant="metricLarge" color={colors.text.primary}>
                  {currentWeight!.toFixed(1)}
                </AppText>
                <AppText variant="body14Medium" color={colors.text.tertiary} style={styles.weightUnit}>
                  kg
                </AppText>
              </View>
              {weightDelta !== null ? (
                <AppText
                  variant="body13SemiBold"
                  color={weightDelta <= 0 ? colors.primary.default : colors.text.tertiary}
                >
                  {t.progress.vs_prev.replace('{{delta}}', `${weightDelta > 0 ? '+' : ''}${weightDelta.toFixed(1)}`)}
                </AppText>
              ) : null}

              <View style={styles.chartWrap}>
                <LineChart
                  data={chartData}
                  width={CHART_WIDTH}
                  height={140}
                  soft
                  curved
                />
              </View>

              {measurements.length > 0 ? (
                <>
                  <View style={styles.divider} />
                  <AppText variant="caps12" color={colors.text.tertiary} style={styles.historyLabel}>
                    {t.progress.recent_history}
                  </AppText>
                  <MeasurementHistoryList
                    measurements={measurements}
                    limit={3}
                    footerLabel={t.progress.see_full_history}
                    onFooterPress={goMeasurements}
                  />
                </>
              ) : null}
            </Card>
          )}

          <Card style={styles.sectionCard}>
            <AppText variant="h3" color={colors.text.primary} style={styles.inlineSectionTitle}>
              {t.progress.tools}
            </AppText>
            <ProgressToolsMenu
              onMeasurements={goMeasurements}
              onPhotos={() => navigation.navigate('ProgressPhotos')}
              onHydration={() => navigation.navigate('HydrationDetail')}
              onWeightDetail={() => navigation.navigate('WeightDetail')}
              showWeightDetail={hasWeight}
            />
          </Card>

          <Card style={styles.sectionCard}>
            <AppText variant="h3" color={colors.text.primary} style={styles.inlineSectionTitle}>
              {t.progress.overview}
            </AppText>
            <View style={styles.statsGrid}>
              <StatCell
                icon="analytics-outline"
                label={t.progress.fat_pct}
                value={latestFat !== null ? latestFat.toFixed(1) : '—'}
                unit={latestFat !== null ? '%' : undefined}
              />
              <StatCell
                icon="body-outline"
                label={t.progress.lean_mass}
                value={leanMass !== null ? leanMass.toFixed(1) : '—'}
                unit={leanMass !== null ? 'kg' : undefined}
              />
              <StatCell
                icon="walk-outline"
                label={t.progress.steps}
                value={steps > 0 ? steps.toLocaleString(locale) : '—'}
              />
              <StatCell
                icon="moon-outline"
                label={t.progress.sleep}
                value={
                  snapshot?.sleepHours !== null && snapshot?.sleepHours !== undefined
                    ? snapshot.sleepHours.toFixed(1)
                    : '—'
                }
                unit={snapshot?.sleepHours !== null && snapshot?.sleepHours !== undefined ? 'h' : undefined}
              />
              <StatCell
                icon="heart-outline"
                label={t.progress.heart_rate}
                value={
                  snapshot?.heartRate !== null && snapshot?.heartRate !== undefined
                    ? String(Math.round(snapshot.heartRate))
                    : '—'
                }
                unit={snapshot?.heartRate !== null && snapshot?.heartRate !== undefined ? 'bpm' : undefined}
              />
              {hasWeeklyActivity ? (
                <StatCell
                  icon="barbell-outline"
                  label={t.progress.weekly_min}
                  value={`${weeklyActivity.reduce((a, d) => a + d.value, 0)}`}
                  unit="min"
                />
              ) : (
                <View style={statStyles.cell} />
              )}
            </View>

            {hasWeeklyActivity ? (
              <View style={styles.activityWrap}>
                <BarChart
                  data={weeklyActivity}
                  width={CHART_WIDTH}
                  height={100}
                  formatValue={(v) => `${Math.round(v)} min`}
                />
              </View>
            ) : null}

            <View style={styles.divider} />

            <View style={styles.healthRow}>
              <View style={styles.healthIcon}>
                <Ionicons name="heart-circle-outline" size={22} color={colors.primary.default} />
              </View>
              <View style={styles.healthInfo}>
                <AppText variant="body14SemiBold" color={colors.text.primary}>
                  {t.progress.apple_health}
                </AppText>
                <AppText variant="body12" color={colors.text.tertiary} numberOfLines={2}>
                  {snapshot
                    ? t.progress.hk_connected
                    : !Device.isDevice
                      ? t.progress.hk_simulator
                      : t.progress.hk_sub}
                </AppText>
              </View>
              {snapshot ? (
                <Ionicons name="checkmark-circle" size={20} color={colors.primary.default} />
              ) : Device.isDevice ? (
                <Button
                  label={t.progress.connect}
                  variant="secondary"
                  size="md"
                  loading={connecting}
                  onPress={() => void connectHealth()}
                />
              ) : null}
            </View>
            {Device.isDevice && snapshot ? (
              <Button
                label={t.progress.disconnect}
                variant="ghost"
                size="md"
                icon="unlink-outline"
                onPress={disconnectHealth}
                style={styles.healthButton}
              />
            ) : null}
          </Card>
        </>
      )}
    </ScrollView>
  );
}

const statStyles = StyleSheet.create({
  cell: { flex: 1, minWidth: '30%', gap: 2, paddingVertical: spacing.xs },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
});

const createStyles = (colors: Colors) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  headerText: { flex: 1 },
  title: { marginTop: 2 },
  emptyState: { marginBottom: spacing.md },
  heroCard: { marginBottom: spacing.md },
  sectionCard: { marginBottom: spacing.md },
  inlineSectionTitle: { marginBottom: spacing.sm },
  weightHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xxs,
  },
  weightRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xxs },
  weightUnit: { marginBottom: spacing.xs },
  chartWrap: { marginTop: spacing.sm, marginHorizontal: -spacing.xxs },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border.subtle,
    marginVertical: spacing.md,
  },
  historyLabel: { marginBottom: spacing.xxs },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  activityWrap: { marginTop: spacing.sm },
  healthRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  healthIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.primary.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  healthInfo: { flex: 1 },
  healthButton: { marginTop: spacing.sm },
});
