import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, spacing, Colors, useThemedStyles, useTheme } from '../../theme';
import { useClientConfig } from '../../config/useClientConfig';
import { AppText, Button, Chip, FlowBackdrop, FlowCard, FlowStepDots, flowShadowStyle, Input, ProgressBar } from '../../components/common';
import { useAuthStore } from '../../stores/authStore';
import { hapticSelect, hapticSuccess } from '../../lib/haptics';
import {
  EQUIPMENT_OPTIONS,
  EXERCISE_HABITS,
  ONBOARDING_GENDERS,
  ONBOARDING_GOALS,
  ONBOARDING_LEVELS,
  ONBOARDING_STEPS,
  TRAINING_DAYS,
  WEEKLY_FREQUENCY,
} from './onboardingConstants';
import { EMPTY_ONBOARDING, type OnboardingFormData } from './onboardingTypes';

function toggleInList(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

interface OptionRowProps {
  label: string;
  selected: boolean;
  mode: 'radio' | 'checkbox';
  onPress: () => void;
}

function OptionRow({ label, selected, mode, onPress }: OptionRowProps): React.JSX.Element {
  const { colors, isDark } = useTheme();
  const styles = useThemedStyles(createOptionStyles);

  return (
    <Pressable
      accessibilityRole={mode === 'radio' ? 'radio' : 'checkbox'}
      accessibilityState={{ selected }}
      onPress={() => {
        hapticSelect();
        onPress();
      }}
      style={({ pressed }) => [
        styles.row,
        selected && styles.rowSelected,
        selected && flowShadowStyle(isDark),
        pressed && styles.rowPressed,
      ]}
    >
      <View
        style={[
          mode === 'radio' ? styles.radio : styles.checkbox,
          selected && (mode === 'radio' ? styles.radioSelected : styles.markerSelected),
        ]}
      >
        {selected ? (
          mode === 'radio' ? (
            <View style={[styles.radioDot, { backgroundColor: colors.primary.default }]} />
          ) : (
            <Ionicons name="checkmark" size={14} color={colors.primary.onText} />
          )
        ) : null}
      </View>
      <AppText variant="body14" color={selected ? colors.text.primary : colors.text.secondary} style={styles.rowLabel}>
        {label}
      </AppText>
    </Pressable>
  );
}

interface StepProps {
  form: OnboardingFormData;
  setForm: React.Dispatch<React.SetStateAction<OnboardingFormData>>;
  fieldErrors: Partial<Record<keyof OnboardingFormData, string>>;
}

function ProfileStep({ form, setForm, fieldErrors }: StepProps): React.JSX.Element {
  const { colors } = useTheme();

  return (
    <>
      <Input
        label="Teléfono"
        icon="call-outline"
        placeholder="Ej: +54 11 1234-5678"
        keyboardType="phone-pad"
        autoComplete="tel"
        value={form.phone}
        onChangeText={(phone) => setForm((prev) => ({ ...prev, phone }))}
        error={fieldErrors.phone}
      />
      <AppText variant="caps13" color={colors.text.tertiary} style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>
        Sexo biológico
      </AppText>
      <View style={{ gap: spacing.xs }}>
        {ONBOARDING_GENDERS.map(({ label, value }) => (
          <OptionRow
            key={value}
            label={label}
            mode="radio"
            selected={form.gender === value}
            onPress={() => setForm((prev) => ({ ...prev, gender: prev.gender === value ? null : value }))}
          />
        ))}
      </View>
      {fieldErrors.gender ? (
        <AppText variant="body12" color={colors.states.error} style={{ marginTop: spacing.xs }}>
          {fieldErrors.gender}
        </AppText>
      ) : null}
    </>
  );
}

function BodyStep({ form, setForm, fieldErrors }: StepProps): React.JSX.Element {
  return (
    <View style={{ flexDirection: 'row', gap: spacing.md }}>
      <Input
        label="Peso actual (kg)"
        icon="scale-outline"
        placeholder="Ej: 72"
        keyboardType="decimal-pad"
        value={form.weightKg}
        onChangeText={(weightKg) => setForm((prev) => ({ ...prev, weightKg }))}
        error={fieldErrors.weightKg}
        containerStyle={{ flex: 1 }}
      />
      <Input
        label="Altura (cm)"
        icon="resize-outline"
        placeholder="Ej: 175"
        keyboardType="number-pad"
        value={form.heightCm}
        onChangeText={(heightCm) => setForm((prev) => ({ ...prev, heightCm }))}
        error={fieldErrors.heightCm}
        containerStyle={{ flex: 1 }}
      />
    </View>
  );
}

function TrainingStep({ form, setForm, fieldErrors }: StepProps): React.JSX.Element {
  const { colors } = useTheme();

  return (
    <>
      <AppText variant="caps13" color={colors.text.tertiary} style={stylesSectionLabel}>
        Objetivos (elegí uno o más)
      </AppText>
      <View style={stylesChips}>
        {ONBOARDING_GOALS.map((goal) => (
          <Chip
            key={goal}
            label={goal}
            active={form.goals.includes(goal)}
            onPress={() => setForm((prev) => ({ ...prev, goals: toggleInList(prev.goals, goal) }))}
          />
        ))}
      </View>
      {fieldErrors.goals ? (
        <AppText variant="body12" color={colors.states.error} style={{ marginTop: spacing.xs }}>
          {fieldErrors.goals}
        </AppText>
      ) : null}

      <AppText variant="caps13" color={colors.text.tertiary} style={stylesSectionLabel}>
        Nivel de experiencia
      </AppText>
      <View style={stylesChips}>
        {ONBOARDING_LEVELS.map((level) => (
          <Chip
            key={level}
            label={level}
            active={form.level === level}
            onPress={() => setForm((prev) => ({ ...prev, level: prev.level === level ? null : level }))}
          />
        ))}
      </View>
      {fieldErrors.level ? (
        <AppText variant="body12" color={colors.states.error} style={{ marginTop: spacing.xs }}>
          {fieldErrors.level}
        </AppText>
      ) : null}

      <AppText variant="caps13" color={colors.text.tertiary} style={stylesSectionLabel}>
        ¿Hacés ejercicio regularmente?
      </AppText>
      <View style={{ gap: spacing.xs }}>
        {EXERCISE_HABITS.map((habit) => (
          <OptionRow
            key={habit}
            label={habit}
            mode="radio"
            selected={form.exerciseHabit === habit}
            onPress={() => setForm((prev) => ({ ...prev, exerciseHabit: prev.exerciseHabit === habit ? null : habit }))}
          />
        ))}
      </View>
      {fieldErrors.exerciseHabit ? (
        <AppText variant="body12" color={colors.states.error} style={{ marginTop: spacing.xs }}>
          {fieldErrors.exerciseHabit}
        </AppText>
      ) : null}

      <AppText variant="caps13" color={colors.text.tertiary} style={stylesSectionLabel}>
        Frecuencia semanal
      </AppText>
      <View style={{ gap: spacing.xs }}>
        {WEEKLY_FREQUENCY.map((freq) => (
          <OptionRow
            key={freq}
            label={freq}
            mode="radio"
            selected={form.weeklyFrequency === freq}
            onPress={() => setForm((prev) => ({ ...prev, weeklyFrequency: prev.weeklyFrequency === freq ? null : freq }))}
          />
        ))}
      </View>
      {fieldErrors.weeklyFrequency ? (
        <AppText variant="body12" color={colors.states.error} style={{ marginTop: spacing.xs }}>
          {fieldErrors.weeklyFrequency}
        </AppText>
      ) : null}
    </>
  );
}

function DetailsStep({ form, setForm }: StepProps): React.JSX.Element {
  const { colors } = useTheme();

  return (
    <>
      <AppText variant="caps13" color={colors.text.tertiary} style={stylesSectionLabel}>
        Días disponibles
      </AppText>
      <View style={stylesChips}>
        {TRAINING_DAYS.map((day) => (
          <Chip
            key={day}
            label={day}
            active={form.availableDays.includes(day)}
            onPress={() => setForm((prev) => ({ ...prev, availableDays: toggleInList(prev.availableDays, day) }))}
          />
        ))}
      </View>

      <AppText variant="caps13" color={colors.text.tertiary} style={stylesSectionLabel}>
        Equipamiento disponible
      </AppText>
      <View style={stylesChips}>
        {EQUIPMENT_OPTIONS.map((item) => (
          <Chip
            key={item}
            label={item}
            active={form.equipment.includes(item)}
            onPress={() => setForm((prev) => ({ ...prev, equipment: toggleInList(prev.equipment, item) }))}
          />
        ))}
      </View>

      <Input
        label="Lesiones o condiciones (opcional)"
        icon="medkit-outline"
        placeholder="Contanos si hay algo que debamos tener en cuenta"
        value={form.injuries}
        onChangeText={(injuries) => setForm((prev) => ({ ...prev, injuries }))}
        multiline
        numberOfLines={3}
        textAlignVertical="top"
        containerStyle={{ marginTop: spacing.lg }}
      />

      <Input
        label="Comentarios adicionales (opcional)"
        icon="chatbubble-ellipses-outline"
        placeholder="Algo más que quieras contarle a tu entrenador"
        value={form.comments}
        onChangeText={(comments) => setForm((prev) => ({ ...prev, comments }))}
        multiline
        numberOfLines={3}
        textAlignVertical="top"
        containerStyle={{ marginTop: spacing.md }}
      />
    </>
  );
}

/** Onboarding post-registro: datos para el entrenador y asignación de programa (Plan Base). */
export function OnboardingScreen(): React.JSX.Element {
  const { colors } = useTheme();
  const clientConfig = useClientConfig();
  const styles = useThemedStyles(createStyles);

  const insets = useSafeAreaInsets();
  const { profile, completeOnboarding, loading, error } = useAuthStore();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<OnboardingFormData>(EMPTY_ONBOARDING);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof OnboardingFormData, string>>>({});

  const firstName = profile?.full_name?.split(' ')[0] ?? '';
  const currentStep = ONBOARDING_STEPS[step]!;
  const isLastStep = step === ONBOARDING_STEPS.length - 1;
  const progress = (step + 1) / ONBOARDING_STEPS.length;

  const stepContent = useMemo(() => {
    const props = { form, setForm, fieldErrors };
    switch (step) {
      case 0:
        return <ProfileStep {...props} />;
      case 1:
        return <BodyStep {...props} />;
      case 2:
        return <TrainingStep {...props} />;
      default:
        return <DetailsStep {...props} />;
    }
  }, [step, form, fieldErrors]);

  const validateStep = (): boolean => {
    const errors: Partial<Record<keyof OnboardingFormData, string>> = {};

    if (step === 0) {
      const digits = form.phone.replace(/\D/g, '');
      if (digits.length < 8) errors.phone = 'Ingresá un teléfono válido.';
      if (!form.gender) errors.gender = 'Seleccioná una opción.';
    }

    if (step === 1) {
      const weight = Number.parseFloat(form.weightKg.replace(',', '.'));
      const height = Number.parseFloat(form.heightCm.replace(',', '.'));
      if (!Number.isFinite(weight) || weight < 30 || weight > 300) {
        errors.weightKg = 'Ingresá un peso válido (30–300 kg).';
      }
      if (!Number.isFinite(height) || height < 120 || height > 230) {
        errors.heightCm = 'Ingresá una altura válida (120–230 cm).';
      }
    }

    if (step === 2) {
      if (form.goals.length === 0) errors.goals = 'Elegí al menos un objetivo.';
      if (!form.level) errors.level = 'Seleccioná tu nivel.';
      if (!form.exerciseHabit) errors.exerciseHabit = 'Seleccioná una opción.';
      if (!form.weeklyFrequency) errors.weeklyFrequency = 'Seleccioná una frecuencia.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNext = async () => {
    if (!validateStep()) return;
    if (!isLastStep) {
      setStep((s) => s + 1);
      return;
    }
    const ok = await completeOnboarding(form);
    if (ok) hapticSuccess();
  };

  const handleBack = () => {
    setFieldErrors({});
    setStep((s) => Math.max(0, s - 1));
  };

  return (
    <FlowBackdrop style={styles.flex}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xl },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.progressHeader}>
            <AppText variant="caps12" color={colors.text.tertiary}>
              Paso {step + 1} de {ONBOARDING_STEPS.length}
            </AppText>
            <ProgressBar progress={progress} height={4} style={styles.progressBar} />
            <FlowStepDots total={ONBOARDING_STEPS.length} current={step} />
          </View>

          <AppText variant="h1" color={colors.text.primary}>
            {step === 0 && firstName ? `¡Hola, ${firstName}!` : currentStep.title}
          </AppText>
          <AppText variant="body16" color={colors.text.secondary} style={styles.subtitle}>
            {step === 0
              ? 'Completá estos datos para que tu entrenador arme tu plan.'
              : currentStep.subtitle}
          </AppText>

          <FlowCard style={styles.formCard}>{stepContent}</FlowCard>

          {error ? (
            <AppText variant="body13" color={colors.states.error} style={styles.error}>
              {error}
            </AppText>
          ) : null}

          <View style={styles.actions}>
            {step > 0 ? (
              <Button
                label="Atrás"
                variant="secondary"
                onPress={handleBack}
                style={styles.backBtn}
              />
            ) : null}
            <Button
              label={isLastStep ? clientConfig.copy.onboardingCta : 'Continuar'}
              onPress={() => void handleNext()}
              loading={loading}
              fullWidth
              style={styles.cta}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </FlowBackdrop>
  );
}

const stylesSectionLabel = { marginTop: spacing.xl, marginBottom: spacing.sm };
const stylesChips = { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: spacing.xs };

const createOptionStyles = (colors: Colors) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border.subtle,
      backgroundColor: colors.surface.base,
      minHeight: 48,
    },
    rowSelected: {
      borderColor: colors.primary.default,
      backgroundColor: colors.primary.muted,
    },
    rowPressed: { opacity: 0.85 },
    rowLabel: { flex: 1 },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: radius.sm,
      borderWidth: 1.5,
      borderColor: colors.border.default,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radio: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 1.5,
      borderColor: colors.border.default,
      alignItems: 'center',
      justifyContent: 'center',
    },
    markerSelected: {
      borderColor: colors.primary.default,
      backgroundColor: colors.primary.default,
    },
    radioSelected: {
      borderColor: colors.primary.default,
      backgroundColor: colors.surface.base,
    },
    radioDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.background,
    },
  });

const createStyles = (_colors: Colors) =>
  StyleSheet.create({
    flex: { flex: 1 },
    content: { paddingHorizontal: spacing.xl },
    progressHeader: { marginBottom: spacing.lg, gap: spacing.sm },
    progressBar: { marginTop: spacing.xxs },
    subtitle: { marginTop: spacing.xs, marginBottom: spacing.lg },
    formCard: { padding: spacing.lg },
    error: { marginTop: spacing.md },
    actions: {
      marginTop: spacing.xl,
      gap: spacing.sm,
    },
    backBtn: { marginBottom: spacing.xxs },
    cta: {},
  });
