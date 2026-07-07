import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { parsePhoneNumber } from 'awesome-phonenumber';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '../../theme';
import { useClientConfig } from '../../config/useClientConfig';
import { AppText, IconButton } from '../../components/common';
import { useAuthStore } from '../../stores/authStore';
import { hapticSelect, hapticSuccess } from '../../lib/haptics';
import { authColors } from './authScreenTheme';
import { AuthButton, AuthErrorBox, AuthInput } from './authUi';
import {
  Chip,
  BirthDateField,
  CountryField,
  CityField,
  FieldError,
  LIMA,
  matchPhoneCodeForCountry,
  OptionRow,
  PhoneField,
  SectionLabel,
  formStyles,
  toggleInList,
} from './formFields';
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

/** Valida el teléfono completo (código de país + número) con awesome-phonenumber. */
export function isValidOnboardingPhone(phoneCode: string, phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return false;
  return parsePhoneNumber(`${phoneCode}${digits}`).valid;
}

/** DD/MM/AAAA real, no futura, y entre 13 y 100 años. */
function isValidBirthDate(value: string): boolean {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return false;
  const [, dd, mm, yyyy] = match.map(Number) as unknown as [number, number, number, number];
  const date = new Date(yyyy, mm - 1, dd);
  if (date.getFullYear() !== yyyy || date.getMonth() !== mm - 1 || date.getDate() !== dd) return false;
  const now = new Date();
  if (date > now) return false;
  const age = (now.getTime() - date.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  return age >= 13 && age <= 100;
}

// ── Steps ────────────────────────────────────────────────────────────────────

interface StepProps {
  form: OnboardingFormData;
  setForm: React.Dispatch<React.SetStateAction<OnboardingFormData>>;
  fieldErrors: Partial<Record<keyof OnboardingFormData, string>>;
  /** Solo lo usa ProfileStep (país/ciudad/código de país), pero viaja en el prop compartido. */
  onDropdownOpenChange?: (open: boolean) => void;
  /** Idem: sube el ScrollView para que el dropdown no quede tapado por el teclado. */
  scrollFieldAboveKeyboard?: (nodeHandle: number, extraRoom?: number) => void;
}

function ProfileStep({ form, setForm, fieldErrors, onDropdownOpenChange, scrollFieldAboveKeyboard }: StepProps): React.JSX.Element {
  return (
    <>
      <AuthInput
        label="NOMBRE"
        placeholder="Ej: Sebastián"
        autoCapitalize="words"
        autoComplete="given-name"
        value={form.firstName}
        onChangeText={(firstName) => setForm((p) => ({ ...p, firstName }))}
        error={fieldErrors.firstName}
        containerStyle={formStyles.field}
      />
      <AuthInput
        label="APELLIDO"
        placeholder="Ej: Riera"
        autoCapitalize="words"
        autoComplete="family-name"
        value={form.lastName}
        onChangeText={(lastName) => setForm((p) => ({ ...p, lastName }))}
        error={fieldErrors.lastName}
        containerStyle={formStyles.field}
      />
      <BirthDateField
        value={form.birthDate}
        onChange={(birthDate) => setForm((p) => ({ ...p, birthDate }))}
        error={fieldErrors.birthDate}
      />
      <CountryField
        value={form.country}
        onChange={(country) => {
          const match = matchPhoneCodeForCountry(country);
          setForm((p) => (
            p.country === country
              ? p
              : {
                  ...p,
                  country,
                  phoneCode: match?.phoneCode ?? p.phoneCode,
                  phoneCountryCca2: match?.phoneCountryCca2 ?? p.phoneCountryCca2,
                  city: '',
                }
          ));
        }}
        error={fieldErrors.country}
        onDropdownOpenChange={onDropdownOpenChange}
        scrollFieldAboveKeyboard={scrollFieldAboveKeyboard}
      />
      <CityField
        country={form.country}
        value={form.city}
        onChange={(city) => setForm((p) => ({ ...p, city }))}
        error={fieldErrors.city}
        onDropdownOpenChange={onDropdownOpenChange}
        scrollFieldAboveKeyboard={scrollFieldAboveKeyboard}
      />
      <AuthInput
        label="CÓDIGO POSTAL"
        placeholder="Ej: 1414"
        autoCapitalize="characters"
        value={form.postalCode}
        onChangeText={(postalCode) => setForm((p) => ({ ...p, postalCode }))}
        error={fieldErrors.postalCode}
        containerStyle={formStyles.field}
      />
      <View style={[styles.addressRow, formStyles.field]}>
        <AuthInput
          label="CALLE"
          placeholder="Ej: Av. Corrientes"
          autoCapitalize="words"
          value={form.street}
          onChangeText={(street) => setForm((p) => ({ ...p, street }))}
          error={fieldErrors.street}
          containerStyle={styles.addressStreet}
        />
        <AuthInput
          label="NÚMERO"
          placeholder="Ej: 1234"
          keyboardType="number-pad"
          value={form.streetNumber}
          onChangeText={(streetNumber) => setForm((p) => ({ ...p, streetNumber: streetNumber.replace(/\D/g, '') }))}
          error={fieldErrors.streetNumber}
          containerStyle={styles.addressNumber}
        />
      </View>
      <AuthInput
        label="DEPTO / PISO (OPCIONAL)"
        placeholder="Ej: 4to B"
        autoCapitalize="words"
        value={form.apartment}
        onChangeText={(apartment) => setForm((p) => ({ ...p, apartment }))}
        containerStyle={formStyles.field}
      />

      <View style={formStyles.field}>
        <PhoneField
          code={form.phoneCode}
          countryCca2={form.phoneCountryCca2}
          phone={form.phone}
          onChangeCode={(phoneCode) => setForm((p) => ({ ...p, phoneCode }))}
          onChangeCountryCca2={(phoneCountryCca2) => setForm((p) => ({ ...p, phoneCountryCca2 }))}
          onChangePhone={(phone) => setForm((p) => ({ ...p, phone }))}
          error={fieldErrors.phone}
          onDropdownOpenChange={onDropdownOpenChange}
          scrollFieldAboveKeyboard={scrollFieldAboveKeyboard}
        />
      </View>

      <SectionLabel>SEXO</SectionLabel>
      <View style={formStyles.optionGroup}>
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
          containerStyle={[formStyles.field, styles.genderOther]}
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
          error={later ? undefined : fieldErrors.weightKg}
          containerStyle={[styles.bodyInput, later && formStyles.disabledField]}
        />
        <AuthInput
          label="ALTURA (CM)"
          icon="resize-outline"
          placeholder="Ej: 175"
          keyboardType="number-pad"
          editable={!later}
          value={later ? '' : form.heightCm}
          onChangeText={(heightCm) => setForm((p) => ({ ...p, heightCm }))}
          error={later ? undefined : fieldErrors.heightCm}
          containerStyle={[styles.bodyInput, later && formStyles.disabledField]}
        />
      </View>

      <Pressable
        onPress={() => { hapticSelect(); setForm((p) => ({ ...p, shareBodyLater: !p.shareBodyLater })); }}
        style={({ pressed }) => [styles.laterRow, later && styles.laterRowActive, pressed && formStyles.pressed]}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: later }}
      >
        <View style={[formStyles.checkbox, later && formStyles.markerSelected]}>
          {later ? <Ionicons name="checkmark" size={14} color={authColors.background} /> : null}
        </View>
        <AppText variant="body14" color={later ? authColors.textPrimary : authColors.textSecondary} style={formStyles.optionLabel}>
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
      <View style={formStyles.chips}>
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
      <View style={formStyles.chips}>
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
      <View style={formStyles.optionGroup}>
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
      <View style={formStyles.optionGroup}>
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

function DetailsStep({ form, setForm, fieldErrors }: StepProps): React.JSX.Element {
  return (
    <>
      <SectionLabel>DÍAS DISPONIBLES</SectionLabel>
      <View style={formStyles.chips}>
        {TRAINING_DAYS.map((day) => (
          <Chip
            key={day}
            label={day}
            active={form.availableDays.includes(day)}
            onPress={() => setForm((p) => ({ ...p, availableDays: toggleInList(p.availableDays, day) }))}
          />
        ))}
      </View>
      <FieldError message={fieldErrors.availableDays} />

      <SectionLabel>EQUIPAMIENTO DISPONIBLE</SectionLabel>
      <View style={formStyles.chips}>
        {EQUIPMENT_OPTIONS.map((item) => (
          <Chip
            key={item}
            label={item}
            active={form.equipment.includes(item)}
            onPress={() => setForm((p) => ({ ...p, equipment: toggleInList(p.equipment, item) }))}
          />
        ))}
      </View>
      <FieldError message={fieldErrors.equipment} />

      <AuthInput
        label="LESIONES O CONDICIONES (OPCIONAL)"
        icon="medkit-outline"
        placeholder="Algo que debamos tener en cuenta"
        value={form.injuries}
        onChangeText={(injuries) => setForm((p) => ({ ...p, injuries }))}
        multiline
        numberOfLines={3}
        textAlignVertical="top"
        containerStyle={[formStyles.field, styles.detailsField]}
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
        containerStyle={formStyles.field}
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
  const [form, setFormRaw] = useState<OnboardingFormData>(() => {
    // Precompletamos con lo que ya vino de signup/OAuth (Google manda
    // full_name armado) — el alumno lo puede corregir acá, es la primera
    // vez que puede editarlo campo por campo en vez de un solo input.
    const [prefillFirst = '', ...prefillRest] = (profile?.full_name ?? '').trim().split(/\s+/).filter(Boolean);
    return { ...EMPTY_ONBOARDING, firstName: prefillFirst, lastName: prefillRest.join(' ') };
  });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof OnboardingFormData, string>>>({});
  const fieldErrorsRef = useRef(fieldErrors);
  fieldErrorsRef.current = fieldErrors;

  // Envuelve setForm: cualquier campo que cambie pierde su error de validación
  // al toque (en vez de quedar pegado en rojo hasta el próximo "Siguiente").
  const setForm: React.Dispatch<React.SetStateAction<OnboardingFormData>> = useCallback((updater) => {
    setFormRaw((prev) => {
      const next = typeof updater === 'function'
        ? (updater as (p: OnboardingFormData) => OnboardingFormData)(prev)
        : updater;
      const changedKeys = (Object.keys(next) as (keyof OnboardingFormData)[])
        .filter((k) => next[k] !== prev[k] && fieldErrorsRef.current[k]);
      if (changedKeys.length > 0) {
        setFieldErrors((errs) => {
          const copy = { ...errs };
          changedKeys.forEach((k) => { delete copy[k]; });
          return copy;
        });
      }
      return next;
    });
  }, []);

  const firstName = profile?.full_name?.split(' ')[0] ?? '';
  const currentStep = ONBOARDING_STEPS[step]!;
  const isLastStep = step === ONBOARDING_STEPS.length - 1;
  const progress = (step + 1) / ONBOARDING_STEPS.length;

  // Mientras el dropdown de país/ciudad está abierto, se desactiva el scroll
  // de la pantalla entera, para que no compita por el gesto con el ScrollView
  // de las sugerencias (dos ScrollView anidados scrolleando a la vez es frágil
  // en iOS).
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Sube el ScrollView para que un dropdown cercano al final del form (ej. código de
  // país) no quede con una sola fila visible arriba del teclado. Es el mecanismo
  // estándar de RN para esto: "úsese como callback de onFocus" (ver tipo de ScrollView).
  const scrollRef = useRef<ScrollView>(null);
  const scrollFieldAboveKeyboard = useCallback((nodeHandle: number, extraRoom = 0) => {
    scrollRef.current?.scrollResponderScrollNativeHandleToKeyboard(nodeHandle, extraRoom, true);
  }, []);

  const stepContent = useMemo(() => {
    const props = { form, setForm, fieldErrors, onDropdownOpenChange: setDropdownOpen, scrollFieldAboveKeyboard };
    switch (step) {
      case 0:  return <ProfileStep {...props} />;
      case 1:  return <BodyStep {...props} />;
      case 2:  return <TrainingStep {...props} />;
      default: return <DetailsStep {...props} />;
    }
  }, [step, form, fieldErrors, setForm, scrollFieldAboveKeyboard]);

  const validateStep = (): boolean => {
    const errors: Partial<Record<keyof OnboardingFormData, string>> = {};

    if (step === 0) {
      if (form.firstName.trim().length < 2)   errors.firstName = 'Ingresá tu nombre.';
      if (form.lastName.trim().length < 2)    errors.lastName = 'Ingresá tu apellido.';
      if (form.country.trim().length < 2)     errors.country = 'Ingresá tu país.';
      if (form.city.trim().length < 2)        errors.city = 'Ingresá tu ciudad.';
      if (form.postalCode.trim().length < 3)  errors.postalCode = 'Ingresá tu código postal.';
      if (form.street.trim().length < 2)      errors.street = 'Ingresá tu calle.';
      if (form.streetNumber.trim().length < 1) errors.streetNumber = 'Ingresá el número.';
      if (!isValidBirthDate(form.birthDate))  errors.birthDate = 'Ingresá una fecha válida.';
      if (!isValidOnboardingPhone(form.phoneCode, form.phone)) errors.phone = 'Ingresá un teléfono válido.';
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

    if (step === 3) {
      if (form.availableDays.length === 0) errors.availableDays = 'Elegí al menos un día.';
      if (form.equipment.length === 0) errors.equipment = 'Elegí al menos una opción.';
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
          ref={scrollRef}
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xl },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          scrollEnabled={!dropdownOpen}
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
            style={formStyles.cta}
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

  addressRow:    { flexDirection: 'row', gap: spacing.sm },
  addressStreet: { flex: 2 },
  addressNumber: { flex: 1 },
  genderOther:  { marginTop: spacing.sm },
  detailsField: { marginTop: spacing.lg },

  bodyRow:   { flexDirection: 'row', gap: spacing.md },
  bodyInput: { flex: 1 },
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
});
