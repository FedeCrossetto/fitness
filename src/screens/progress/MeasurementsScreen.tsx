import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { layout, spacing, Colors, useThemedStyles, useTheme } from '../../theme';
import { formatLongDate } from '../../lib/dates';
import { hapticSuccess } from '../../lib/haptics';
import {
  AppText,
  Button,
  Card,
  CardSkeleton,
  ErrorState,
  IconButton,
  Input,
} from '../../components/common';
import { useAuthStore } from '../../stores/authStore';
import { useProgressStore } from '../../stores/progressStore';
import { useUiStore } from '../../stores/uiStore';
import type { BodyMeasurementRow } from '../../types/database';
import type { ProgressStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<ProgressStackParamList, 'Measurements'>;

type FormField = 'weight' | 'fat' | 'chest' | 'waist' | 'hips' | 'arms' | 'legs';
type FormState = Record<FormField, string>;

const EMPTY_FORM: FormState = { weight: '', fat: '', chest: '', waist: '', hips: '', arms: '', legs: '' };

const FORM_FIELDS: { key: FormField; label: string; placeholder: string }[] = [
  { key: 'weight', label: 'Peso (kg)', placeholder: '78.5' },
  { key: 'fat', label: '% Grasa', placeholder: '18.0' },
  { key: 'chest', label: 'Pecho (cm)', placeholder: '100' },
  { key: 'waist', label: 'Cintura (cm)', placeholder: '82' },
  { key: 'hips', label: 'Cadera (cm)', placeholder: '95' },
  { key: 'arms', label: 'Brazos (cm)', placeholder: '36' },
  { key: 'legs', label: 'Piernas (cm)', placeholder: '58' },
];

function parseDecimal(value: string): number | null {
  const n = Number.parseFloat(value.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function cm(value: number | null | undefined): string {
  return value !== null && value !== undefined ? `${value} cm` : '—';
}

/** Silueta corporal lineal con etiquetas de las últimas medidas por zona. */
function BodyAvatar({ latest }: { latest: BodyMeasurementRow | undefined }): React.JSX.Element {
  const { colors } = useTheme();

  return (
    <View style={avatarStyles.row}>
      <View style={avatarStyles.sideColumn}>
        <View style={avatarStyles.labelBlock}>
          <AppText variant="caps11" color={colors.text.tertiary}>
            Brazos
          </AppText>
          <AppText variant="body14SemiBold" color={colors.text.primary}>
            {cm(latest?.arms_cm)}
          </AppText>
        </View>
        <View style={avatarStyles.labelBlock}>
          <AppText variant="caps11" color={colors.text.tertiary}>
            Cintura
          </AppText>
          <AppText variant="body14SemiBold" color={colors.text.primary}>
            {cm(latest?.waist_cm)}
          </AppText>
        </View>
      </View>

      <Svg width={130} height={230} viewBox="0 0 130 230">
        {/* Cabeza */}
        <Circle cx={65} cy={26} r={16} stroke={colors.primary.default} strokeWidth={2.5} fill="none" />
        {/* Torso */}
        <Line x1={65} y1={42} x2={65} y2={120} stroke={colors.primary.default} strokeWidth={2.5} strokeLinecap="round" />
        {/* Brazos */}
        <Line x1={65} y1={60} x2={28} y2={105} stroke={colors.primary.default} strokeWidth={2.5} strokeLinecap="round" />
        <Line x1={65} y1={60} x2={102} y2={105} stroke={colors.primary.default} strokeWidth={2.5} strokeLinecap="round" />
        {/* Piernas */}
        <Line x1={65} y1={120} x2={40} y2={200} stroke={colors.primary.default} strokeWidth={2.5} strokeLinecap="round" />
        <Line x1={65} y1={120} x2={90} y2={200} stroke={colors.primary.default} strokeWidth={2.5} strokeLinecap="round" />
        {/* Marcadores de zonas */}
        <Circle cx={65} cy={68} r={4} fill={colors.primary.default} />
        <Circle cx={65} cy={92} r={4} fill={colors.primary.default} />
        <Circle cx={65} cy={118} r={4} fill={colors.primary.default} />
      </Svg>

      <View style={avatarStyles.sideColumn}>
        <View style={avatarStyles.labelBlock}>
          <AppText variant="caps11" color={colors.text.tertiary}>
            Pecho
          </AppText>
          <AppText variant="body14SemiBold" color={colors.text.primary}>
            {cm(latest?.chest_cm)}
          </AppText>
        </View>
        <View style={avatarStyles.labelBlock}>
          <AppText variant="caps11" color={colors.text.tertiary}>
            Cadera
          </AppText>
          <AppText variant="body14SemiBold" color={colors.text.primary}>
            {cm(latest?.hips_cm)}
          </AppText>
        </View>
        <View style={avatarStyles.labelBlock}>
          <AppText variant="caps11" color={colors.text.tertiary}>
            Piernas
          </AppText>
          <AppText variant="body14SemiBold" color={colors.text.primary}>
            {cm(latest?.legs_cm)}
          </AppText>
        </View>
      </View>
    </View>
  );
}

export function MeasurementsScreen({ navigation }: Props): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  const insets = useSafeAreaInsets();

  const session = useAuthStore((s) => s.session);
  const userId = session?.user.id;

  const measurements = useProgressStore((s) => s.measurements);
  const measurementsLoading = useProgressStore((s) => s.measurementsLoading);
  const measurementsError = useProgressStore((s) => s.measurementsError);
  const loadMeasurements = useProgressStore((s) => s.loadMeasurements);
  const saveMeasurement = useProgressStore((s) => s.saveMeasurement);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const latest = measurements[0];

  // Carga las medidas y precarga el form con los últimos valores (una sola vez).
  // El setForm ocurre después del await: no es setState síncrono dentro del efecto.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void (async () => {
      await loadMeasurements(userId);
      if (cancelled) return;
      const latestRow = useProgressStore.getState().measurements[0];
      if (!latestRow) return;
      setForm({
        weight: latestRow.weight_kg !== null ? String(latestRow.weight_kg) : '',
        fat: latestRow.body_fat_pct !== null ? String(latestRow.body_fat_pct) : '',
        chest: latestRow.chest_cm !== null ? String(latestRow.chest_cm) : '',
        waist: latestRow.waist_cm !== null ? String(latestRow.waist_cm) : '',
        hips: latestRow.hips_cm !== null ? String(latestRow.hips_cm) : '',
        arms: latestRow.arms_cm !== null ? String(latestRow.arms_cm) : '',
        legs: latestRow.legs_cm !== null ? String(latestRow.legs_cm) : '',
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, loadMeasurements]);

  const setField = useCallback((key: FormField, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const history = useMemo(() => measurements.slice(0, 5), [measurements]);

  const onSave = useCallback(async () => {
    if (!userId) return;
    const data: Partial<BodyMeasurementRow> = {
      weight_kg: parseDecimal(form.weight),
      body_fat_pct: parseDecimal(form.fat),
      chest_cm: parseDecimal(form.chest),
      waist_cm: parseDecimal(form.waist),
      hips_cm: parseDecimal(form.hips),
      arms_cm: parseDecimal(form.arms),
      legs_cm: parseDecimal(form.legs),
    };
    const hasValue = Object.values(data).some((v) => v !== null);
    if (!hasValue) {
      useUiStore.getState().showToast('error', 'Ingresá al menos una medida para guardar.');
      return;
    }
    setSaving(true);
    const ok = await saveMeasurement(userId, data);
    setSaving(false);
    if (ok) {
      hapticSuccess();
      useUiStore.getState().showToast('success', 'Medidas guardadas');
    } else {
      useUiStore.getState().showToast('error', 'No pudimos guardar las medidas.');
    }
  }, [userId, form, saveMeasurement]);

  const isLoading = measurementsLoading && measurements.length === 0;
  const hasError = measurementsError !== null && measurements.length === 0;

  return (
    <View style={[styles.flex, { paddingTop: insets.top + spacing.md }]}>
      <View style={styles.header}>
        <IconButton icon="chevron-back" onPress={() => navigation.goBack()} accessibilityLabel="Volver" />
        <AppText variant="h3" color={colors.text.primary}>
          Medidas
        </AppText>
        <View style={styles.headerSpacer} />
      </View>

      {isLoading ? (
        <View style={styles.content}>
          <CardSkeleton />
          <CardSkeleton />
        </View>
      ) : hasError ? (
        <ErrorState message={measurementsError} onRetry={() => userId && void loadMeasurements(userId)} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Avatar corporal */}
          <Card style={styles.avatarCard}>
            <AppText variant="caps12" color={colors.text.tertiary} style={styles.cardTitle}>
              Tus medidas actuales
            </AppText>
            <BodyAvatar latest={latest} />
          </Card>

          {/* Formulario */}
          <Card style={styles.formCard}>
            <AppText variant="caps12" color={colors.text.tertiary} style={styles.cardTitle}>
              Registrar medidas de hoy
            </AppText>
            <View style={styles.formGrid}>
              {FORM_FIELDS.map((field) => (
                <Input
                  key={field.key}
                  label={field.label}
                  keyboardType="decimal-pad"
                  value={form[field.key]}
                  onChangeText={(v) => setField(field.key, v)}
                  placeholder={field.placeholder}
                  containerStyle={styles.formField}
                />
              ))}
            </View>
            <Button label="Guardar medidas" onPress={() => void onSave()} loading={saving} fullWidth style={styles.saveButton} />
          </Card>

          {/* Historial corto */}
          {history.length > 0 ? (
            <Card style={styles.historyCard}>
              <AppText variant="caps12" color={colors.text.tertiary} style={styles.cardTitle}>
                Últimas mediciones
              </AppText>
              {history.map((m, index) => {
                const prev = history[index + 1];
                const delta =
                  m.weight_kg !== null && prev?.weight_kg !== null && prev?.weight_kg !== undefined
                    ? m.weight_kg - prev.weight_kg
                    : null;
                return (
                  <View key={m.id} style={styles.historyRow}>
                    <View style={styles.historyInfo}>
                      <AppText variant="body14Medium" color={colors.text.primary}>
                        {formatLongDate(m.date)}
                      </AppText>
                      {delta !== null ? (
                        <AppText
                          variant="body12Medium"
                          color={delta <= 0 ? colors.primary.default : colors.text.tertiary}
                        >
                          {delta > 0 ? '+' : ''}
                          {delta.toFixed(1)} kg
                        </AppText>
                      ) : null}
                    </View>
                    <AppText variant="body14SemiBold" color={colors.text.primary}>
                      {m.weight_kg !== null ? `${m.weight_kg.toFixed(1)} kg` : '—'}
                    </AppText>
                  </View>
                );
              })}
            </Card>
          ) : null}
        </ScrollView>
      )}
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
  headerSpacer: { width: layout.minHitTarget },
  content: { paddingHorizontal: layout.screenPadding },
  scrollContent: {
    paddingHorizontal: layout.screenPadding,
    paddingBottom: layout.tabBarHeight + spacing.xxl,
  },
  cardTitle: { marginBottom: spacing.sm },
  avatarCard: { marginBottom: spacing.md },
  formCard: { marginBottom: spacing.md },
  formGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  formField: { width: '48%', marginBottom: spacing.md },
  saveButton: { marginTop: spacing.xs },
  historyCard: { marginBottom: spacing.md },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.subtle,
  },
  historyInfo: { flex: 1 },
});

const avatarStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sideColumn: {
    flex: 1,
    justifyContent: 'space-around',
    alignSelf: 'stretch',
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  labelBlock: { gap: 2 },
});
