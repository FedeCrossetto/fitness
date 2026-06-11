import React, { useCallback, useMemo, useState } from 'react';
import { Dimensions, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, illustrations, layout, radius, spacing } from '../../theme';
import { formatShortDate } from '../../lib/dates';
import {
  AppText,
  Button,
  Card,
  CardSkeleton,
  EmptyState,
  ErrorState,
  MetricCard,
  SectionHeader,
} from '../../components/common';
import { LineChart } from '../../components/charts/LineChart';
import { useAuthStore } from '../../stores/authStore';
import { useProgressStore } from '../../stores/progressStore';
import { useUiStore } from '../../stores/uiStore';
import { getTodaySteps } from '../../services/steps';
import { initHealthKit, readHealthSnapshot } from '../../services/health';
import type { HealthSnapshot } from '../../services/health';
import type { ProgressStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<ProgressStackParamList, 'Dashboard'>;

const CHART_WIDTH = Dimensions.get('window').width - layout.screenPadding * 2 - spacing.md * 2;

export function ProgressDashboardScreen({ navigation }: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();

  const session = useAuthStore((s) => s.session);
  const userId = session?.user.id;

  const measurements = useProgressStore((s) => s.measurements);
  const measurementsLoading = useProgressStore((s) => s.measurementsLoading);
  const measurementsError = useProgressStore((s) => s.measurementsError);
  const loadMeasurements = useProgressStore((s) => s.loadMeasurements);
  const steps = useProgressStore((s) => s.steps);
  const setSteps = useProgressStore((s) => s.setSteps);

  const [refreshing, setRefreshing] = useState(false);
  const [snapshot, setSnapshot] = useState<HealthSnapshot | null>(null);
  const [connecting, setConnecting] = useState(false);

  const loadAll = useCallback(async () => {
    if (!userId) return;
    await loadMeasurements(userId);
    const [todaySteps, healthSnapshot] = await Promise.all([getTodaySteps(), readHealthSnapshot()]);
    if (todaySteps !== null) setSteps(todaySteps);
    setSnapshot(healthSnapshot);
  }, [userId, loadMeasurements, setSteps]);

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

  // Mediciones con peso, ordenadas ascendente por fecha para el gráfico
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

  const latestFat = measurements.find((m) => m.body_fat_pct !== null)?.body_fat_pct ?? null;
  const leanMass = currentWeight !== null && latestFat !== null ? currentWeight * (1 - latestFat / 100) : null;

  const connectHealth = useCallback(async () => {
    setConnecting(true);
    const ok = await initHealthKit();
    if (ok) {
      const healthSnapshot = await readHealthSnapshot();
      setSnapshot(healthSnapshot);
      useUiStore.getState().showToast('success', 'Apple Health conectado');
    } else {
      useUiStore.getState().showToast('error', 'No pudimos conectar con Apple Health en este dispositivo.');
    }
    setConnecting(false);
  }, []);

  const isLoading = measurementsLoading && measurements.length === 0;
  const hasError = measurementsError !== null && measurements.length === 0;

  return (
    <ScrollView
      style={styles.flex}
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
      {/* Cabecera del pilar */}
      <View style={styles.header}>
        <View style={styles.headerText}>
          <AppText variant="caps12" color={colors.text.tertiary}>
            Tu evolución
          </AppText>
          <AppText variant="h1" color={colors.text.primary} style={styles.title}>
            Progreso
          </AppText>
        </View>
        <Image source={illustrations.pillarHeader.progress} style={styles.mascot} contentFit="contain" />
      </View>

      {isLoading ? (
        <>
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </>
      ) : hasError ? (
        <ErrorState message={measurementsError} onRetry={() => void loadAll()} />
      ) : (
        <>
          {/* Tarjeta principal de peso */}
          {weightHistory.length === 0 ? (
            <EmptyState
              pillar="progress"
              title="Sin registros todavía"
              message="Registrá tu primer peso para ver tu evolución"
              actionLabel="Registrar peso"
              onAction={() => navigation.navigate('Measurements')}
            />
          ) : (
            <Card elevated style={styles.weightCard} onPress={() => navigation.navigate('WeightDetail')}>
              <View style={styles.weightHeader}>
                <AppText variant="caps12" color={colors.text.tertiary}>
                  Peso corporal
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
                  style={styles.weightDelta}
                >
                  {weightDelta > 0 ? '+' : ''}
                  {weightDelta.toFixed(1)} kg vs medición anterior
                </AppText>
              ) : null}
              <View style={styles.chartWrap}>
                <LineChart data={chartData} width={CHART_WIDTH} height={150} formatValue={(v) => `${v.toFixed(1)} kg`} />
              </View>
            </Card>
          )}

          {/* Grid de métricas */}
          <View style={styles.metricsRow}>
            <MetricCard
              label="% Grasa"
              value={latestFat !== null ? latestFat.toFixed(1) : '—'}
              unit={latestFat !== null ? '%' : undefined}
              icon="analytics-outline"
              style={styles.metricHalf}
            />
            <MetricCard
              label="Masa magra"
              value={leanMass !== null ? leanMass.toFixed(1) : '—'}
              unit={leanMass !== null ? 'kg' : undefined}
              icon="body-outline"
              style={styles.metricHalf}
            />
          </View>
          <View style={styles.metricsRow}>
            <MetricCard
              label="Pasos hoy"
              value={steps > 0 ? steps.toLocaleString('es-AR') : '—'}
              icon="walk-outline"
              style={styles.metricHalf}
            />
            <MetricCard
              label="Sueño"
              value={snapshot?.sleepHours !== null && snapshot?.sleepHours !== undefined ? snapshot.sleepHours.toFixed(1) : '—'}
              unit={snapshot?.sleepHours !== null && snapshot?.sleepHours !== undefined ? 'h' : undefined}
              icon="moon-outline"
              style={styles.metricHalf}
            />
          </View>
          <View style={styles.metricsRow}>
            <MetricCard
              label="Frecuencia cardíaca"
              value={snapshot?.heartRate !== null && snapshot?.heartRate !== undefined ? String(Math.round(snapshot.heartRate)) : '—'}
              unit={snapshot?.heartRate !== null && snapshot?.heartRate !== undefined ? 'bpm' : undefined}
              icon="heart-outline"
              style={styles.metricHalf}
            />
            <View style={styles.metricHalf} />
          </View>

          {/* Apple Health */}
          <Card style={styles.healthCard}>
            <View style={styles.healthRow}>
              <View style={styles.healthIcon}>
                <Ionicons name="heart-circle-outline" size={24} color={colors.primary.default} />
              </View>
              <View style={styles.healthInfo}>
                <AppText variant="body16SemiBold" color={colors.text.primary}>
                  Apple Health
                </AppText>
                <AppText variant="body13" color={colors.text.secondary} style={styles.healthSub}>
                  {snapshot
                    ? 'Conectado: tus datos se sincronizan automáticamente.'
                    : 'Leemos peso, pasos, FC y sueño para completar tu progreso'}
                </AppText>
              </View>
              {snapshot ? <Ionicons name="checkmark-circle" size={22} color={colors.primary.default} /> : null}
            </View>
            {!snapshot ? (
              <Button
                label="Conectar Apple Health"
                variant="secondary"
                size="md"
                icon="link-outline"
                loading={connecting}
                onPress={() => void connectHealth()}
                style={styles.healthButton}
              />
            ) : null}
          </Card>

          {/* Accesos */}
          <SectionHeader title="Herramientas" />
          {(
            [
              {
                key: 'photos',
                icon: 'camera-outline',
                title: 'Fotos de progreso',
                sub: 'Comparate semana a semana',
                onPress: () => navigation.navigate('ProgressPhotos'),
              },
              {
                key: 'measurements',
                icon: 'resize-outline',
                title: 'Medidas',
                sub: 'Peso, % grasa y medidas corporales',
                onPress: () => navigation.navigate('Measurements'),
              },
              {
                key: 'hydration',
                icon: 'water-outline',
                title: 'Hidratación',
                sub: 'Registrá tu consumo de agua diario',
                onPress: () => navigation.navigate('HydrationDetail'),
              },
            ] as const
          ).map((item) => (
            <Card key={item.key} style={styles.accessCard} onPress={item.onPress}>
              <View style={styles.accessRow}>
                <View style={styles.accessIcon}>
                  <Ionicons name={item.icon} size={20} color={colors.primary.default} />
                </View>
                <View style={styles.accessInfo}>
                  <AppText variant="body16SemiBold" color={colors.text.primary}>
                    {item.title}
                  </AppText>
                  <AppText variant="body13" color={colors.text.tertiary}>
                    {item.sub}
                  </AppText>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.text.tertiary} />
              </View>
            </Card>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  headerText: { flex: 1 },
  title: { marginTop: 2 },
  mascot: { width: 72, height: 88 },
  weightCard: { marginBottom: spacing.md },
  weightHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  weightRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xxs },
  weightUnit: { marginBottom: spacing.xs },
  weightDelta: { marginTop: spacing.xxs },
  chartWrap: { marginTop: spacing.md },
  metricsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  metricHalf: { flex: 1 },
  healthCard: { marginTop: spacing.xs, marginBottom: spacing.md },
  healthRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  healthIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.primary.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  healthInfo: { flex: 1 },
  healthSub: { marginTop: 2 },
  healthButton: { marginTop: spacing.md },
  accessCard: { marginBottom: spacing.sm },
  accessRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  accessIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.primary.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accessInfo: { flex: 1 },
});
