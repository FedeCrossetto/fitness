import React, { useMemo, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '../../theme';
import { useClientConfig } from '../../config/useClientConfig';
import { AppText, IconButton } from '../../components/common';
import { useAuthStore } from '../../stores/authStore';
import { hapticSelect, hapticSuccess } from '../../lib/haptics';
import { authColors } from './authScreenTheme';
import { AuthButton, AuthErrorBox, AuthInput } from './authUi';
import {
  COUNTRY_CODES,
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

const LIMA = '#C1ED00';

function toggleInList(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

// ── Reusable UI in the auth aesthetic ────────────────────────────────────────

interface OptionRowProps {
  label: string;
  selected: boolean;
  mode: 'radio' | 'checkbox';
  onPress: () => void;
}

function OptionRow({ label, selected, mode, onPress }: OptionRowProps): React.JSX.Element {
  return (
    <Pressable
      accessibilityRole={mode === 'radio' ? 'radio' : 'checkbox'}
      accessibilityState={{ selected }}
      onPress={() => { hapticSelect(); onPress(); }}
      style={({ pressed }) => [
        styles.optionRow,
        selected && styles.optionRowSelected,
        pressed && styles.pressed,
      ]}
    >
      <View style={[mode === 'radio' ? styles.radio : styles.checkbox, selected && styles.markerSelected]}>
        {selected ? (
          mode === 'radio'
            ? <View style={styles.radioDot} />
            : <Ionicons name="checkmark" size={14} color={authColors.background} />
        ) : null}
      </View>
      <AppText variant="body14" color={selected ? authColors.textPrimary : authColors.textSecondary} style={styles.optionLabel}>
        {label}
      </AppText>
    </Pressable>
  );
}

interface ChipProps { label: string; active: boolean; onPress: () => void }

function Chip({ label, active, onPress }: ChipProps): React.JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={() => { hapticSelect(); onPress(); }}
      style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.pressed]}
    >
      <AppText variant="caps12" color={active ? authColors.background : authColors.textSecondary}>
        {label}
      </AppText>
    </Pressable>
  );
}

function SectionLabel({ children }: { children: string }): React.JSX.Element {
  return (
    <AppText variant="caps12" color={authColors.textTertiary} style={styles.sectionLabel}>
      {children}
    </AppText>
  );
}

function FieldError({ message }: { message?: string }): React.JSX.Element | null {
  if (!message) return null;
  return (
    <AppText variant="body12" color={authColors.errorText} style={styles.fieldError}>
      {message}
    </AppText>
  );
}

// ── Phone field with country-code dropdown ───────────────────────────────────

interface PhoneFieldProps {
  code: string;
  phone: string;
  onChangeCode: (code: string) => void;
  onChangePhone: (phone: string) => void;
  error?: string;
}

function PhoneField({ code, phone, onChangeCode, onChangePhone, error }: PhoneFieldProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const selected = COUNTRY_CODES.find((c) => c.code === code) ?? COUNTRY_CODES[0];

  return (
    <View>
      <AppText variant="caps12" color={authColors.textTertiary} style={styles.inputLabel}>
        TELÉFONO
      </AppText>
      <View style={styles.phoneRow}>
        <Pressable
          onPress={() => setOpen(true)}
          style={({ pressed }) => [styles.codeBtn, error ? styles.codeBtnError : null, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Elegir código de país"
        >
          <AppText variant="body16" color={authColors.textPrimary}>{selected.flag} {selected.code}</AppText>
          <Ionicons name="chevron-down" size={14} color={authColors.textTertiary} />
        </Pressable>
        <AuthInput
          placeholder="11 1234 5678"
          keyboardType="phone-pad"
          autoComplete="tel"
          value={phone}
          onChangeText={onChangePhone}
          containerStyle={styles.phoneInput}
        />
      </View>
      <FieldError message={error} />

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <AppText variant="caps12" color={authColors.textTertiary} style={styles.modalTitle}>
              CÓDIGO DE PAÍS
            </AppText>
            <FlatList
              data={COUNTRY_CODES}
              keyExtractor={(item) => item.code + item.name}
              keyboardShouldPersistTaps="handled"
              style={styles.modalList}
              renderItem={({ item }) => {
                const active = item.code === code;
                return (
                  <Pressable
                    onPress={() => { onChangeCode(item.code); setOpen(false); }}
                    style={({ pressed }) => [styles.codeOption, active && styles.codeOptionActive, pressed && styles.pressed]}
                  >
                    <AppText variant="body16" color={authColors.textPrimary}>{item.flag}  {item.name}</AppText>
                    <AppText variant="body14SemiBold" color={active ? LIMA : authColors.textTertiary}>{item.code}</AppText>
                  </Pressable>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// ── Steps ────────────────────────────────────────────────────────────────────

interface StepProps {
  form: OnboardingFormData;
  setForm: React.Dispatch<React.SetStateAction<OnboardingFormData>>;
  fieldErrors: Partial<Record<keyof OnboardingFormData, string>>;
}

function ProfileStep({ form, setForm, fieldErrors }: StepProps): React.JSX.Element {
  return (
    <>
      <AuthInput
        label="PAÍS"
        icon="earth-outline"
        placeholder="Ej: Argentina"
        autoCapitalize="words"
        value={form.country}
        onChangeText={(country) => setForm((p) => ({ ...p, country }))}
        error={fieldErrors.country}
        containerStyle={styles.field}
      />
      <AuthInput
        label="CIUDAD"
        icon="business-outline"
        placeholder="Ej: Buenos Aires"
        autoCapitalize="words"
        value={form.city}
        onChangeText={(city) => setForm((p) => ({ ...p, city }))}
        error={fieldErrors.city}
        containerStyle={styles.field}
      />
      <AuthInput
        label="DIRECCIÓN (OPCIONAL)"
        icon="location-outline"
        placeholder="Calle, número, depto"
        autoCapitalize="words"
        value={form.address}
        onChangeText={(address) => setForm((p) => ({ ...p, address }))}
        containerStyle={styles.field}
      />

      <View style={styles.field}>
        <PhoneField
          code={form.phoneCode}
          phone={form.phone}
          onChangeCode={(phoneCode) => setForm((p) => ({ ...p, phoneCode }))}
          onChangePhone={(phone) => setForm((p) => ({ ...p, phone }))}
          error={fieldErrors.phone}
        />
      </View>

      <SectionLabel>SEXO BIOLÓGICO</SectionLabel>
      <View style={styles.optionGroup}>
        {ONBOARDING_GENDERS.map(({ label, value }) => (
          <OptionRow
            key={value}
            label={label}
            mode="radio"
            selected={form.gender === value}
            onPress={() => setForm((p) => ({ ...p, gender: p.gender === value ? null : value }))}
          />
        ))}
      </View>
      <FieldError message={fieldErrors.gender} />

      {form.gender === 'other' ? (
        <AuthInput
          label="ESPECIFICÁ (OPCIONAL)"
          icon="create-outline"
          placeholder="Cómo te identificás"
          value={form.genderOther}
          onChangeText={(genderOther) => setForm((p) => ({ ...p, genderOther }))}
          containerStyle={[styles.field, styles.genderOther]}
        />
      ) : null}
    </>
  );
}

function BodyStep({ form, setForm, fieldErrors }: StepProps): React.JSX.Element {
  const later = form.shareBodyLater;
  return (
    <>
      <View style={styles.bodyRow}>
        <AuthInput
          label="PESO (KG)"
          icon="barbell-outline"
          placeholder="Ej: 72"
          keyboardType="decimal-pad"
          editable={!later}
          value={later ? '' : form.weightKg}
          onChangeText={(weightKg) => setForm((p) => ({ ...p, weightKg }))}
          error={fieldErrors.weightKg}
          containerStyle={[styles.bodyInput, later && styles.disabledField]}
        />
        <AuthInput
          label="ALTURA (CM)"
          icon="resize-outline"
          placeholder="Ej: 175"
          keyboardType="number-pad"
          editable={!later}
          value={later ? '' : form.heightCm}
          onChangeText={(heightCm) => setForm((p) => ({ ...p, heightCm }))}
          error={fieldErrors.heightCm}
          containerStyle={[styles.bodyInput, later && styles.disabledField]}
        />
      </View>

      <Pressable
        onPress={() => { hapticSelect(); setForm((p) => ({ ...p, shareBodyLater: !p.shareBodyLater })); }}
        style={({ pressed }) => [styles.laterRow, later && styles.laterRowActive, pressed && styles.pressed]}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: later }}
      >
        <View style={[styles.checkbox, later && styles.markerSelected]}>
          {later ? <Ionicons name="checkmark" size={14} color={authColors.background} /> : null}
        </View>
        <AppText variant="body14" color={later ? authColors.textPrimary : authColors.textSecondary} style={styles.optionLabel}>
          Prefiero compartir mi peso y altura más adelante o en la llamada con el coach
        </AppText>
      </Pressable>
    </>
  );
}

function TrainingStep({ form, setForm, fieldErrors }: StepProps): React.JSX.Element {
  return (
    <>
      <SectionLabel>OBJETIVOS (ELEGÍ UNO O MÁS)</SectionLabel>
      <View style={styles.chips}>
        {ONBOARDING_GOALS.map((goal) => (
          <Chip
            key={goal}
            label={goal}
            active={form.goals.includes(goal)}
            onPress={() => setForm((p) => ({ ...p, goals: toggleInList(p.goals, goal) }))}
          />
        ))}
      </View>
      <FieldError message={fieldErrors.goals} />

      <SectionLabel>NIVEL DE EXPERIENCIA</SectionLabel>
      <View style={styles.chips}>
        {ONBOARDING_LEVELS.map((level) => (
          <Chip
            key={level}
            label={level}
            active={form.level === level}
            onPress={() => setForm((p) => ({ ...p, level: p.level === level ? null : level }))}
          />
        ))}
      </View>
      <FieldError message={fieldErrors.level} />

      <SectionLabel>¿HACÉS EJERCICIO REGULARMENTE?</SectionLabel>
      <View style={styles.optionGroup}>
        {EXERCISE_HABITS.map((habit) => (
          <OptionRow
            key={habit}
            label={habit}
            mode="radio"
            selected={form.exerciseHabit === habit}
            onPress={() => setForm((p) => ({ ...p, exerciseHabit: p.exerciseHabit === habit ? null : habit }))}
          />
        ))}
      </View>
      <FieldError message={fieldErrors.exerciseHabit} />

      <SectionLabel>FRECUENCIA SEMANAL</SectionLabel>
      <View style={styles.optionGroup}>
        {WEEKLY_FREQUENCY.map((freq) => (
          <OptionRow
            key={freq}
            label={freq}
            mode="radio"
            selected={form.weeklyFrequency === freq}
            onPress={() => setForm((p) => ({ ...p, weeklyFrequency: p.weeklyFrequency === freq ? null : freq }))}
          />
        ))}
      </View>
      <FieldError message={fieldErrors.weeklyFrequency} />
    </>
  );
}

function DetailsStep({ form, setForm }: StepProps): React.JSX.Element {
  return (
    <>
      <SectionLabel>DÍAS DISPONIBLES</SectionLabel>
      <View style={styles.chips}>
        {TRAINING_DAYS.map((day) => (
          <Chip
            key={day}
            label={day}
            active={form.availableDays.includes(day)}
            onPress={() => setForm((p) => ({ ...p, availableDays: toggleInList(p.availableDays, day) }))}
          />
        ))}
      </View>

      <SectionLabel>EQUIPAMIENTO DISPONIBLE</SectionLabel>
      <View style={styles.chips}>
        {EQUIPMENT_OPTIONS.map((item) => (
          <Chip
            key={item}
            label={item}
            active={form.equipment.includes(item)}
            onPress={() => setForm((p) => ({ ...p, equipment: toggleInList(p.equipment, item) }))}
          />
        ))}
      </View>

      <AuthInput
        label="LESIONES O CONDICIONES (OPCIONAL)"
        icon="medkit-outline"
        placeholder="Algo que debamos tener en cuenta"
        value={form.injuries}
        onChangeText={(injuries) => setForm((p) => ({ ...p, injuries }))}
        multiline
        numberOfLines={3}
        textAlignVertical="top"
        containerStyle={[styles.field, styles.detailsField]}
      />
      <AuthInput
        label="COMENTARIOS ADICIONALES (OPCIONAL)"
        icon="chatbubble-ellipses-outline"
        placeholder="Algo más para tu entrenador"
        value={form.comments}
        onChangeText={(comments) => setForm((p) => ({ ...p, comments }))}
        multiline
        numberOfLines={3}
        textAlignVertical="top"
        containerStyle={styles.field}
      />
    </>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

/** Onboarding post-registro con el look & feel del login. */
export function OnboardingScreen(): React.JSX.Element {
  const clientConfig = useClientConfig();
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
      case 0:  return <ProfileStep {...props} />;
      case 1:  return <BodyStep {...props} />;
      case 2:  return <TrainingStep {...props} />;
      default: return <DetailsStep {...props} />;
    }
  }, [step, form, fieldErrors]);

  const validateStep = (): boolean => {
    const errors: Partial<Record<keyof OnboardingFormData, string>> = {};

    if (step === 0) {
      if (form.country.trim().length < 2) errors.country = 'Ingresá tu país.';
      if (form.city.trim().length < 2)    errors.city = 'Ingresá tu ciudad.';
      const digits = form.phone.replace(/\D/g, '');
      if (digits.length < 6) errors.phone = 'Ingresá un teléfono válido.';
      if (!form.gender) errors.gender = 'Seleccioná una opción.';
    }

    if (step === 1 && !form.shareBodyLater) {
      const weight = Number.parseFloat(form.weightKg.replace(',', '.'));
      const height = Number.parseFloat(form.heightCm.replace(',', '.'));
      if (!Number.isFinite(weight) || weight < 30 || weight > 300) {
        errors.weightKg = 'Peso inválido (30–300).';
      }
      if (!Number.isFinite(height) || height < 120 || height > 230) {
        errors.heightCm = 'Altura inválida (120–230).';
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
    if (step === 0) return;
    setFieldErrors({});
    setStep((s) => Math.max(0, s - 1));
  };

  // Swipe desde el borde izquierdo para volver (como en el login).
  // El ref siempre apunta al handleBack más reciente (evita closure obsoleto).
  const handleBackRef = useRef(handleBack);
  handleBackRef.current = handleBack;
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        g.moveX < 36 && g.dx > 12 && Math.abs(g.dy) < 24,
      onPanResponderRelease: (_, g) => {
        if (g.dx > 60) handleBackRef.current();
      },
    }),
  ).current;

  return (
    <View style={styles.flex} {...panResponder.panHandlers}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xl },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header: back chevron + title */}
          <View style={styles.headerRow}>
            {step > 0 ? (
              <IconButton
                icon="chevron-back"
                onPress={handleBack}
                accessibilityLabel="Volver"
                color={authColors.textPrimary}
                backgroundColor={authColors.surface}
                style={styles.backBtn}
              />
            ) : null}
            <AppText variant="h2" color={authColors.textPrimary} style={styles.title} numberOfLines={1} adjustsFontSizeToFit>
              {step === 0 && firstName ? `HOLA, ${firstName.toUpperCase()}` : currentStep.title}
            </AppText>
          </View>

          <AppText variant="caps11" color={authColors.textTertiary} style={styles.subtitle}>
            {currentStep.subtitle}
          </AppText>

          {/* Progress */}
          <View style={styles.progressWrap}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
            </View>
            <AppText variant="caps11" color={authColors.textTertiary}>
              {step + 1}/{ONBOARDING_STEPS.length}
            </AppText>
          </View>

          {stepContent}

          {error ? <AuthErrorBox message={error} /> : null}

          <AuthButton
            label={isLastStep ? clientConfig.copy.onboardingCta : 'CONTINUAR'}
            onPress={() => void handleNext()}
            loading={loading}
            fullWidth
            style={styles.cta}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex:    { flex: 1, backgroundColor: authColors.background },
  content: { paddingHorizontal: spacing.xl },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.xs,
  },
  backBtn: { borderColor: authColors.border, flexShrink: 0 },
  title:   { flex: 1, letterSpacing: -0.5 },
  subtitle:{ marginBottom: spacing.lg, letterSpacing: 1 },

  progressWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    borderRadius: 99,
    backgroundColor: authColors.surface,
    overflow: 'hidden',
  },
  progressFill: { height: 4, borderRadius: 99, backgroundColor: LIMA },

  field:        { marginBottom: spacing.md },
  inputLabel:   { marginBottom: spacing.xs, letterSpacing: 0.4 },
  genderOther:  { marginTop: spacing.sm },
  detailsField: { marginTop: spacing.lg },

  sectionLabel: { marginTop: spacing.lg, marginBottom: spacing.sm, letterSpacing: 1 },
  fieldError:   { marginTop: spacing.xs },

  optionGroup: { gap: spacing.xs },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: authColors.border,
    backgroundColor: authColors.surface,
    minHeight: 48,
  },
  optionRowSelected: { borderColor: LIMA },
  optionLabel: { flex: 1 },
  pressed: { opacity: 0.82 },

  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 1.5, borderColor: authColors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  radio: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 1.5, borderColor: authColors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  markerSelected: { borderColor: LIMA, backgroundColor: LIMA },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: authColors.background },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: authColors.border,
    backgroundColor: authColors.surface,
  },
  chipActive: { backgroundColor: LIMA, borderColor: LIMA },

  // Phone
  phoneRow: { flexDirection: 'row', gap: spacing.sm },
  codeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: authColors.border,
    backgroundColor: authColors.surface,
    minHeight: 52,
  },
  codeBtnError: { borderColor: authColors.errorText },
  phoneInput: { flex: 1 },

  // Body step
  bodyRow:   { flexDirection: 'row', gap: spacing.md },
  bodyInput: { flex: 1 },
  disabledField: { opacity: 0.4 },
  laterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: authColors.border,
    backgroundColor: authColors.surface,
    marginTop: spacing.md,
  },
  laterRowActive: { borderColor: LIMA },

  cta: { marginTop: spacing.xl },

  // Country code modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: authColors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    maxHeight: '70%',
    borderWidth: 1,
    borderColor: authColors.border,
  },
  modalTitle: { letterSpacing: 1, marginBottom: spacing.md, textAlign: 'center' },
  modalList:  { flexGrow: 0 },
  codeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: 12,
    marginBottom: spacing.xs,
  },
  codeOptionActive: { backgroundColor: 'rgba(193,237,0,0.10)' },
});
