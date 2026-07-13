import React, { useCallback, useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { layout, radius, spacing, Colors, useThemedStyles, useTheme } from '../../theme';
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
import { BodyAvatar, MeasurementHistoryList, type BodyGender } from '../../components/progress';
import { useAuthStore } from '../../stores/authStore';
import { useProgressStore } from '../../stores/progressStore';
import { useUiStore } from '../../stores/uiStore';
import { useTranslation } from '../../stores/i18nStore';
import { validateBodyMeasurements, type BodyMeasurementField } from '@reset-fitness/shared';
import { formatMeasurementValidationError } from '../../lib/bodyMeasurementValidation';
import type { BodyMeasurementRow } from '../../types/database';
import { useTabBarScrollPadding } from '../../hooks/useTabBarScrollPadding';
import type { ProgressStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<ProgressStackParamList, 'Measurements'>;

/** Todas las medidas que puede cargar el cliente (paridad con el panel del
 * coach / Hevy). `measure` es la columna en body_measurements. */
const MEASURE_FIELDS: { key: string; measure: BodyMeasurementField; label: string; placeholder: string }[] = [
  { key: 'weight', measure: 'weight_kg', label: 'Peso (kg)', placeholder: '78.5' },
  { key: 'fat', measure: 'body_fat_pct', label: 'Grasa corporal (%)', placeholder: '18.0' },
  { key: 'lean', measure: 'lean_body_mass_kg', label: 'Masa magra (kg)', placeholder: '62' },
  { key: 'neck', measure: 'neck_cm', label: 'Cuello (cm)', placeholder: '38' },
  { key: 'shoulder', measure: 'shoulder_cm', label: 'Hombro (cm)', placeholder: '118' },
  { key: 'chest', measure: 'chest_cm', label: 'Pecho (cm)', placeholder: '100' },
  { key: 'abdomen', measure: 'abdomen_cm', label: 'Abdomen (cm)', placeholder: '85' },
  { key: 'waist', measure: 'waist_cm', label: 'Cintura (cm)', placeholder: '82' },
  { key: 'hips', measure: 'hips_cm', label: 'Cadera (cm)', placeholder: '98' },
  { key: 'lbicep', measure: 'left_bicep_cm', label: 'Bícep izq. (cm)', placeholder: '35' },
  { key: 'rbicep', measure: 'right_bicep_cm', label: 'Bícep der. (cm)', placeholder: '35' },
  { key: 'lforearm', measure: 'left_forearm_cm', label: 'Antebrazo izq. (cm)', placeholder: '28' },
  { key: 'rforearm', measure: 'right_forearm_cm', label: 'Antebrazo der. (cm)', placeholder: '28' },
  { key: 'lthigh', measure: 'left_thigh_cm', label: 'Muslo izq. (cm)', placeholder: '58' },
  { key: 'rthigh', measure: 'right_thigh_cm', label: 'Muslo der. (cm)', placeholder: '58' },
  { key: 'lcalf', measure: 'left_calf_cm', label: 'Gemelo izq. (cm)', placeholder: '38' },
  { key: 'rcalf', measure: 'right_calf_cm', label: 'Gemelo der. (cm)', placeholder: '38' },
];

type FormField = (typeof MEASURE_FIELDS)[number]['key'];
type FormState = Record<FormField, string>;

const EMPTY_FORM: FormState = Object.fromEntries(MEASURE_FIELDS.map((f) => [f.key, ''])) as FormState;

const MEASURE_TO_FORM = Object.fromEntries(
  MEASURE_FIELDS.map((f) => [f.measure, f.key]),
) as Partial<Record<BodyMeasurementField, FormField>>;

function parseDecimal(value: string): number | null {
  const n = Number.parseFloat(value.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function GenderToggle({
  value,
  onChange,
}: {
  value: BodyGender;
  onChange: (g: BodyGender) => void;
}): React.JSX.Element {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const options: { key: BodyGender; label: string }[] = [
    { key: 'male', label: t.progress.male },
    { key: 'female', label: t.progress.female },
  ];
  return (
    <View style={genderStyles.row}>
      {options.map((opt) => {
        const active = value === opt.key;
        return (
          <Pressable
            key={opt.key}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(opt.key)}
            style={[
              genderStyles.option,
              {
                backgroundColor: active ? colors.primary.default : 'transparent',
                borderColor: active ? colors.primary.default : colors.border.subtle,
              },
            ]}
          >
            <AppText
              variant="body14SemiBold"
              color={active ? colors.primary.onText : colors.text.secondary}
            >
              {opt.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

export function MeasurementsScreen({ navigation }: Props): React.JSX.Element {
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

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [gender, setGender] = useState<BodyGender>('male');
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FormField, string>>>({});

  const latest = measurements[0];

  const formFields = MEASURE_FIELDS;

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void (async () => {
      await loadMeasurements(userId);
      if (cancelled) return;
      const latestRow = useProgressStore.getState().measurements[0];
      if (!latestRow) return;
      if (latestRow.gender === 'male' || latestRow.gender === 'female') {
        setGender(latestRow.gender);
      }
      const next = { ...EMPTY_FORM };
      for (const f of MEASURE_FIELDS) {
        const v = latestRow[f.measure];
        next[f.key] = v !== null && v !== undefined ? String(v) : '';
      }
      setForm(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, loadMeasurements]);

  const setField = useCallback((key: FormField, value: string) => {
    setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const onSave = useCallback(async () => {
    if (!userId) return;
    const data: Partial<BodyMeasurementRow> = { gender };
    const values: Partial<Record<BodyMeasurementField, number | null>> = {};
    for (const f of MEASURE_FIELDS) {
      const parsed = parseDecimal(form[f.key]);
      (data as Record<string, unknown>)[f.measure] = parsed;
      values[f.measure] = parsed;
    }
    const hasValue = Object.values(values).some((v) => v !== null);
    if (!hasValue) {
      useUiStore.getState().showToast('error', t.progress.measurements_required);
      return;
    }

    const validation = validateBodyMeasurements(values);
    if (!validation.ok) {
      const message = formatMeasurementValidationError(validation, t);
      const fk = MEASURE_TO_FORM[validation.field];
      if (fk) setFieldErrors({ [fk]: message });
      useUiStore.getState().showToast('error', message);
      return;
    }

    const doSave = async (): Promise<void> => {
      setFieldErrors({});
      setSaving(true);
      const ok = await saveMeasurement(userId, data);
      setSaving(false);
      if (ok) {
        hapticSuccess();
        useUiStore.getState().showToast('success', t.progress.measurements_saved);
      } else {
        useUiStore.getState().showToast('error', t.progress.measurements_db_range);
      }
    };

    const newWeight = data.weight_kg;
    const prevWeight = measurements[0]?.weight_kg;
    if (newWeight !== null && newWeight !== undefined && prevWeight !== null && prevWeight !== undefined) {
      const diff = Math.abs(newWeight - prevWeight);
      if (diff > 10) {
        Alert.alert(
          '¿Seguro?',
          `Tu peso anterior era ${prevWeight} kg. Estás registrando ${newWeight} kg (${diff.toFixed(1)} kg de diferencia). ¿Es correcto?`,
          [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Sí, guardar', onPress: () => void doSave() },
          ],
        );
        return;
      }
    }

    await doSave();
  }, [userId, form, gender, saveMeasurement, measurements, t]);

  const isLoading = measurementsLoading && measurements.length === 0;
  const hasError = measurementsError !== null && measurements.length === 0;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
    <View style={[styles.flex, { paddingTop: insets.top + spacing.md }]}>
      <View style={styles.header}>
        <IconButton icon="chevron-back" onPress={() => navigation.goBack()} accessibilityLabel="Volver" />
        <AppText variant="h3" color={colors.text.primary}>
          {t.progress.measurements}
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
          contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollBottom }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Card style={styles.avatarCard}>
            <AppText variant="caps12" color={colors.text.tertiary} style={styles.cardTitle}>
              {t.progress.current_measurements}
            </AppText>
            <BodyAvatar latest={latest} gender={gender} />
            <GenderToggle value={gender} onChange={setGender} />
          </Card>

          <Card style={styles.formCard}>
            <AppText variant="caps12" color={colors.text.tertiary} style={styles.cardTitle}>
              {t.progress.log_today}
            </AppText>
            <View style={styles.formGrid}>
              {formFields.map((field) => (
                <Input
                  key={field.key}
                  label={field.label}
                  keyboardType="decimal-pad"
                  value={form[field.key]}
                  onChangeText={(v) => setField(field.key, v)}
                  placeholder={field.placeholder}
                  error={fieldErrors[field.key]}
                  containerStyle={styles.formField}
                />
              ))}
            </View>
            <Button
              label={t.progress.save_measurements}
              onPress={() => void onSave()}
              loading={saving}
              fullWidth
              style={styles.saveButton}
            />
          </Card>

          {measurements.length > 0 ? (
            <Card style={styles.historyCard}>
              <AppText variant="caps12" color={colors.text.tertiary} style={styles.cardTitle}>
                {t.progress.recent_history}
              </AppText>
              <MeasurementHistoryList measurements={measurements} />
            </Card>
          ) : null}
        </ScrollView>
      )}
    </View>
    </KeyboardAvoidingView>
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
});

const genderStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  option: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
});
