import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
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

type FormField = 'weight' | 'fat' | 'chest' | 'waist' | 'hips' | 'arms' | 'legs';
type FormState = Record<FormField, string>;

const EMPTY_FORM: FormState = { weight: '', fat: '', chest: '', waist: '', hips: '', arms: '', legs: '' };

const MEASURE_TO_FORM: Record<BodyMeasurementField, FormField> = {
  weight_kg: 'weight',
  body_fat_pct: 'fat',
  chest_cm: 'chest',
  waist_cm: 'waist',
  hips_cm: 'hips',
  arms_cm: 'arms',
  legs_cm: 'legs',
};

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

  const formFields = useMemo(
    (): { key: FormField; label: string; placeholder: string }[] => [
      { key: 'weight', label: `${t.progress.weight} (kg)`, placeholder: '78.5' },
      { key: 'fat', label: t.progress.fat_pct, placeholder: '18.0' },
      { key: 'chest', label: `${t.progress.chest} (cm)`, placeholder: '100' },
      { key: 'waist', label: `${t.progress.waist} (cm)`, placeholder: '82' },
      { key: 'hips', label: `${t.progress.hips} (cm)`, placeholder: '95' },
      { key: 'arms', label: `${t.progress.arms} (cm)`, placeholder: '36' },
      { key: 'legs', label: `${t.progress.legs} (cm)`, placeholder: '58' },
    ],
    [t]
  );

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
    setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const onSave = useCallback(async () => {
    if (!userId) return;
    const data: Partial<BodyMeasurementRow> = {
      gender,
      weight_kg: parseDecimal(form.weight),
      body_fat_pct: parseDecimal(form.fat),
      chest_cm: parseDecimal(form.chest),
      waist_cm: parseDecimal(form.waist),
      hips_cm: parseDecimal(form.hips),
      arms_cm: parseDecimal(form.arms),
      legs_cm: parseDecimal(form.legs),
    };
    const { gender: _gender, ...measures } = data;
    const hasValue = Object.values(measures).some((v) => v !== null);
    if (!hasValue) {
      useUiStore.getState().showToast('error', t.progress.measurements_required);
      return;
    }

    const validation = validateBodyMeasurements({
      weight_kg: data.weight_kg,
      body_fat_pct: data.body_fat_pct,
      chest_cm: data.chest_cm,
      waist_cm: data.waist_cm,
      hips_cm: data.hips_cm,
      arms_cm: data.arms_cm,
      legs_cm: data.legs_cm,
    });
    if (!validation.ok) {
      const message = formatMeasurementValidationError(validation, t);
      setFieldErrors({ [MEASURE_TO_FORM[validation.field]]: message });
      useUiStore.getState().showToast('error', message);
      return;
    }

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
  }, [userId, form, gender, saveMeasurement, t]);

  const isLoading = measurementsLoading && measurements.length === 0;
  const hasError = measurementsError !== null && measurements.length === 0;

  return (
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
