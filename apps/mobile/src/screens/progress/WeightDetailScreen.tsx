import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { layout, spacing, Colors, useThemedStyles, useTheme } from '../../theme';
import { addDays, formatLongDate, formatShortDate, todayISO } from '../../lib/dates';
import { weightDeltaColor } from '../../lib/weightDeltaColor';
import { hapticSuccess } from '../../lib/haptics';
import {
  AppText,
  BottomSheet,
  Button,
  Card,
  CardSkeleton,
  EmptyState,
  ErrorState,
  IconButton,
  Input,
  SegmentedTabs,
} from '../../components/common';
import { WeightTrendChart } from '../../components/progress';
import { useAuthStore } from '../../stores/authStore';
import { useProgressStore } from '../../stores/progressStore';
import { useUiStore } from '../../stores/uiStore';
import { i, validateBodyMeasurements } from '@reset-fitness/shared';
import { formatMeasurementValidationError } from '../../lib/bodyMeasurementValidation';
import { useTranslation } from '../../stores/i18nStore';
import type { BodyMeasurementRow } from '../../types/database';
import { useTabBarScrollPadding } from '../../hooks/useTabBarScrollPadding';
import type { ProgressStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<ProgressStackParamList, 'WeightDetail'>;

const CARD_CHART_BLEED = spacing.md;
const RANGES = ['1M', '3M', 'Todo'] as const;

function parseDecimal(value: string): number | null {
  const n = Number.parseFloat(value.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function WeightDetailScreen({ navigation }: Props): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();

  const insets = useSafeAreaInsets();
  const scrollBottom = useTabBarScrollPadding();

  const session = useAuthStore((s) => s.session);
  const userId = session?.user.id;

  const measurements = useProgressStore((s) => s.measurements);
  const measurementsLoading = useProgressStore((s) => s.measurementsLoading);
  const measurementsError = useProgressStore((s) => s.measurementsError);
  const loadMeasurements = useProgressStore((s) => s.loadMeasurements);
  const saveMeasurement = useProgressStore((s) => s.saveMeasurement);

  const [rangeIndex, setRangeIndex] = useState(2);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [weightInput, setWeightInput] = useState('');
  const [fatInput, setFatInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [chartWidth, setChartWidth] = useState(0);
  const [weightError, setWeightError] = useState<string | undefined>();
  const [fatError, setFatError] = useState<string | undefined>();

  const onChartLayout = useCallback((event: LayoutChangeEvent) => {
    setChartWidth(event.nativeEvent.layout.width);
  }, []);

  useEffect(() => {
    if (userId) void loadMeasurements(userId);
  }, [userId, loadMeasurements]);

  // Solo mediciones con peso, descendente por fecha (como vienen del store)
  const weightRows = useMemo(
    () => measurements.filter((m) => m.weight_kg !== null),
    [measurements]
  );

  const filteredRows = useMemo(() => {
    if (rangeIndex === 2) return weightRows;
    const cutoff = addDays(todayISO(), rangeIndex === 0 ? -30 : -90);
    return weightRows.filter((m) => m.date >= cutoff);
  }, [weightRows, rangeIndex]);

  const chartData = useMemo(
    () =>
      [...filteredRows]
        .sort((a, b) => (a.date < b.date ? -1 : 1))
        .map((m) => ({ label: formatShortDate(m.date), value: m.weight_kg as number })),
    [filteredRows]
  );

  const openSheet = useCallback(() => {
    const latest = weightRows[0];
    setWeightInput(latest?.weight_kg !== null && latest?.weight_kg !== undefined ? String(latest.weight_kg) : '');
    setFatInput('');
    setSheetVisible(true);
  }, [weightRows]);

  const onSave = useCallback(async () => {
    if (!userId) return;
    const weight = parseDecimal(weightInput);
    if (weight === null) {
      const message = i(t.progress.measurements_enter_valid, { label: t.progress.weight });
      setWeightError(message);
      useUiStore.getState().showToast('error', message);
      return;
    }
    const fat = fatInput.trim().length > 0 ? parseDecimal(fatInput) : null;
    if (fatInput.trim().length > 0 && fat === null) {
      const message = i(t.progress.measurements_enter_valid, { label: t.progress.fat_pct });
      setFatError(message);
      useUiStore.getState().showToast('error', message);
      return;
    }

    const validation = validateBodyMeasurements({
      weight_kg: weight,
      ...(fat !== null ? { body_fat_pct: fat } : {}),
    });
    if (!validation.ok) {
      const message = formatMeasurementValidationError(validation, t);
      if (validation.field === 'weight_kg') setWeightError(message);
      if (validation.field === 'body_fat_pct') setFatError(message);
      useUiStore.getState().showToast('error', message);
      return;
    }

    setWeightError(undefined);
    setFatError(undefined);
    setSaving(true);
    const ok = await saveMeasurement(userId, {
      weight_kg: weight,
      ...(fat !== null ? { body_fat_pct: fat } : {}),
    });
    setSaving(false);
    if (ok) {
      hapticSuccess();
      useUiStore.getState().showToast('success', t.progress.measurements_saved);
      setSheetVisible(false);
    } else {
      useUiStore.getState().showToast('error', t.progress.measurements_db_range);
    }
  }, [userId, weightInput, fatInput, saveMeasurement, t]);

  const isLoading = measurementsLoading && measurements.length === 0;
  const hasError = measurementsError !== null && measurements.length === 0;

  const renderItem = useCallback(
    ({ item, index }: { item: BodyMeasurementRow; index: number }) => {
      const prev = filteredRows[index + 1];
      const delta =
        prev?.weight_kg !== null && prev?.weight_kg !== undefined
          ? (item.weight_kg as number) - prev.weight_kg
          : null;
      return (
        <Card style={styles.rowCard}>
          <View style={styles.rowInner}>
            <View style={styles.rowInfo}>
              <AppText variant="body14SemiBold" color={colors.text.primary}>
                {formatLongDate(item.date)}
              </AppText>
              {item.body_fat_pct !== null ? (
                <AppText variant="body12" color={colors.text.tertiary} style={styles.rowSub}>
                  {item.body_fat_pct.toFixed(1)}% grasa
                </AppText>
              ) : null}
            </View>
            <View style={styles.rowValues}>
              <AppText variant="metricSmall" color={colors.text.primary}>
                {(item.weight_kg as number).toFixed(1)} kg
              </AppText>
              {delta !== null ? (
                <View style={styles.deltaRow}>
                  <Ionicons
                    name={delta <= 0 ? 'arrow-down' : 'arrow-up'}
                    size={12}
                    color={weightDeltaColor(delta, colors)}
                  />
                  <AppText
                    variant="body12Medium"
                    color={weightDeltaColor(delta, colors)}
                  >
                    {delta > 0 ? '+' : ''}
                    {delta.toFixed(1)} kg
                  </AppText>
                </View>
              ) : null}
            </View>
          </View>
        </Card>
      );
    },
    [filteredRows, colors, styles]
  );

  return (
    <View style={[styles.flex, { paddingTop: insets.top + spacing.md }]}>
      <View style={styles.header}>
        <IconButton icon="chevron-back" onPress={() => navigation.goBack()} accessibilityLabel="Volver" />
        <AppText variant="h3" color={colors.text.primary}>
          Peso corporal
        </AppText>
        <IconButton icon="add" onPress={openSheet} accessibilityLabel="Registrar peso" />
      </View>

      {isLoading ? (
        <View style={styles.content}>
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </View>
      ) : hasError ? (
        <ErrorState message={measurementsError} onRetry={() => userId && void loadMeasurements(userId)} />
      ) : weightRows.length === 0 ? (
        <EmptyState
          pillar="progress"
          title="Sin registros de peso"
          message="Registrá tu primer peso para empezar a ver tu evolución"
          actionLabel="Registrar peso"
          onAction={openSheet}
        />
      ) : (
        <FlatList
          data={filteredRows}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={[styles.listContent, { paddingBottom: scrollBottom }]}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View>
              <SegmentedTabs tabs={[...RANGES]} activeIndex={rangeIndex} onChange={setRangeIndex} />
              <Card elevated style={styles.chartCard}>
                <View style={styles.chartBleed} onLayout={onChartLayout}>
                  {chartWidth > 0 && chartData.length > 0 ? (
                    <WeightTrendChart
                      data={chartData}
                      width={chartWidth}
                      height={168}
                    />
                  ) : chartData.length === 0 ? (
                    <AppText variant="body14" color={colors.text.tertiary} align="center" style={styles.noRange}>
                      No hay mediciones en este rango.
                    </AppText>
                  ) : null}
                </View>
              </Card>
              <Button label="Registrar peso" icon="add" onPress={openSheet} fullWidth style={styles.cta} />
              <AppText variant="caps12" color={colors.text.tertiary} style={styles.listTitle}>
                Historial
              </AppText>
            </View>
          }
        />
      )}

      <BottomSheet visible={sheetVisible} onClose={() => setSheetVisible(false)} title="Registrar peso">
        <Input
          label="Peso (kg)"
          icon="scale-outline"
          keyboardType="decimal-pad"
          value={weightInput}
          onChangeText={(v) => {
            setWeightError(undefined);
            setWeightInput(v);
          }}
          placeholder="Ej: 78.5"
          error={weightError}
          containerStyle={styles.sheetInput}
        />
        <Input
          label="% Grasa corporal (opcional)"
          icon="analytics-outline"
          keyboardType="decimal-pad"
          value={fatInput}
          onChangeText={(v) => {
            setFatError(undefined);
            setFatInput(v);
          }}
          placeholder="Ej: 18.2"
          error={fatError}
          containerStyle={styles.sheetInput}
        />
        <Button label="Guardar" onPress={() => void onSave()} loading={saving} fullWidth />
      </BottomSheet>
    </View>
  );
}

const createStyles = (colors: Colors) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.screenPadding,
    marginBottom: spacing.md,
  },
  content: { paddingHorizontal: layout.screenPadding },
  listContent: {
    paddingHorizontal: layout.screenPadding,
  },
  chartCard: { marginTop: spacing.md, marginBottom: spacing.md, overflow: 'hidden' },
  chartBleed: { marginHorizontal: -CARD_CHART_BLEED, alignSelf: 'stretch' },
  noRange: { paddingVertical: spacing.xl },
  cta: { marginBottom: spacing.lg },
  listTitle: { marginBottom: spacing.sm },
  rowCard: { marginBottom: spacing.sm },
  rowInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowInfo: { flex: 1 },
  rowSub: { marginTop: 2 },
  rowValues: { alignItems: 'flex-end' },
  deltaRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2 },
  sheetInput: { marginBottom: spacing.md },
});
