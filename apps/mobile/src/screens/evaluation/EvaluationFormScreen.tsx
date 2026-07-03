import React, { useCallback, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '../../theme';
import { AppText, IconButton } from '../../components/common';
import { anyClient } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { authColors } from '../auth/authScreenTheme';
import { AuthButton, AuthInput } from '../auth/authUi';
import {
  Chip,
  CityField,
  CountryField,
  FieldError,
  LIMA,
  matchPhoneCodeForCountry,
  OptionRow,
  PhoneField,
  SectionLabel,
  formStyles,
} from '../auth/formFields';
import { isValidOnboardingPhone } from '../auth/OnboardingScreen';
import { ONBOARDING_GENDERS } from '../auth/onboardingConstants';
import { EMPTY_EVALUATION, EVALUATION_GOALS, type EvaluationFormData } from './evaluationTypes';

interface EvaluationFormScreenProps {
  onBack: () => void;
  onSubmitted: () => void;
}

/**
 * Formulario de "Solicitar evaluación" (Mentoría 1 a 1). Replica los campos y el
 * orden del formulario web (alegerezcoach.com/es/evaluacion), reusando los mismos
 * componentes/lógica de validación que el onboarding post-pago: AuthInput con
 * borde de error unificado, selector de teléfono con código de país, radios y
 * chips de selección única, y el mismo patrón de "compartir peso/altura más
 * adelante" para no bloquear el envío por datos opcionales.
 */
export function EvaluationFormScreen({ onBack, onSubmitted }: EvaluationFormScreenProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const profile = useAuthStore((s) => s.profile);
  const session = useAuthStore((s) => s.session);

  const [form, setForm] = useState<EvaluationFormData>(() => ({
    ...EMPTY_EVALUATION,
    fullName: profile?.full_name ?? '',
    email: session?.user.email ?? '',
  }));
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof EvaluationFormData, string>>>({});
  const [submitting, setSubmitting] = useState(false);

  const update = useCallback(<K extends keyof EvaluationFormData>(key: K, value: EvaluationFormData[K]) => {
    setForm((p) => ({ ...p, [key]: value }));
    setFieldErrors((errs) => (errs[key] ? { ...errs, [key]: undefined } : errs));
  }, []);

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const scrollFieldAboveKeyboard = useCallback((nodeHandle: number, extraRoom = 0) => {
    scrollRef.current?.scrollResponderScrollNativeHandleToKeyboard(nodeHandle, extraRoom, true);
  }, []);

  const validate = (): boolean => {
    const errors: Partial<Record<keyof EvaluationFormData, string>> = {};
    if (form.fullName.trim().length < 2) errors.fullName = 'Ingresá tu nombre completo.';
    if (!form.email.includes('@')) errors.email = 'Ingresá un email válido.';
    if (!isValidOnboardingPhone(form.phoneCode, form.phone)) errors.phone = 'Ingresá un teléfono válido.';
    if (form.country.trim().length < 2) errors.country = 'Ingresá tu país.';
    if (form.city.trim().length < 2) errors.city = 'Ingresá tu ciudad.';
    if (!form.gender) errors.gender = 'Seleccioná una opción.';

    if (!form.shareBodyLater) {
      const weight = Number.parseFloat(form.weightKg.replace(',', '.'));
      const height = Number.parseFloat(form.heightCm.replace(',', '.'));
      if (!Number.isFinite(weight) || weight < 30 || weight > 300) errors.weightKg = 'Peso inválido (30–300).';
      if (!Number.isFinite(height) || height < 120 || height > 230) errors.heightCm = 'Altura inválida (120–230).';
    }

    if (!form.mainGoal) errors.mainGoal = 'Seleccioná tu objetivo principal.';
    if (form.situation.trim().length < 10) errors.situation = 'Contanos un poco más sobre tu situación actual.';
    if (!form.acceptedTerms) errors.acceptedTerms = 'Tenés que aceptar los términos y condiciones.';

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = useCallback(async () => {
    if (!validate()) return;
    const clientId = profile?.id;
    const trainerId = profile?.trainer_id;
    if (!clientId || !trainerId) {
      Alert.alert('Error', 'No pudimos identificar tu cuenta. Cerrá sesión y volvé a entrar.');
      return;
    }

    setSubmitting(true);
    const { error } = await anyClient.from('evaluation_requests').insert({
      client_id: clientId,
      trainer_id: trainerId,
      full_name: form.fullName.trim(),
      email: form.email.trim(),
      phone_code: form.phoneCode,
      phone: form.phone.trim(),
      country: form.country.trim(),
      city: form.city.trim(),
      gender: form.gender,
      weight_kg: form.shareBodyLater ? null : Number.parseFloat(form.weightKg.replace(',', '.')),
      height_cm: form.shareBodyLater ? null : Number.parseFloat(form.heightCm.replace(',', '.')),
      share_body_later: form.shareBodyLater,
      main_goal: form.mainGoal,
      situation: form.situation.trim(),
      accepted_terms: form.acceptedTerms,
    });
    setSubmitting(false);

    if (error) {
      if (__DEV__) console.warn('[evaluation] insert failed:', error.message);
      Alert.alert('Error', 'No pudimos enviar tu solicitud. Intentá de nuevo.');
      return;
    }
    onSubmitted();
  }, [form, profile?.id, profile?.trainer_id, onSubmitted]);

  const later = form.shareBodyLater;

  return (
    <View style={styles.flex}>
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
          <View style={styles.headerRow}>
            <IconButton
              icon="chevron-back"
              onPress={onBack}
              accessibilityLabel="Volver"
              color={authColors.textPrimary}
              backgroundColor={authColors.surface}
              style={styles.backBtn}
            />
            <AppText variant="h2" color={authColors.textPrimary} style={styles.title} numberOfLines={1} adjustsFontSizeToFit>
              SOLICITÁ TU EVALUACIÓN
            </AppText>
          </View>
          <AppText variant="body13" color={authColors.textSecondary} style={styles.subtitle}>
            Contanos sobre vos. Esta información me ayuda a evaluar tu caso antes de la llamada.
          </AppText>

          <AuthInput
            label="NOMBRE COMPLETO"
            placeholder="Ej: Juana Pérez"
            autoCapitalize="words"
            value={form.fullName}
            onChangeText={(v) => update('fullName', v)}
            error={fieldErrors.fullName}
            containerStyle={formStyles.field}
          />
          <AuthInput
            label="EMAIL"
            placeholder="tu@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            value={form.email}
            onChangeText={(v) => update('email', v)}
            error={fieldErrors.email}
            containerStyle={formStyles.field}
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
              setFieldErrors((errs) => (errs.country ? { ...errs, country: undefined } : errs));
            }}
            error={fieldErrors.country}
            onDropdownOpenChange={setDropdownOpen}
            scrollFieldAboveKeyboard={scrollFieldAboveKeyboard}
          />
          <CityField
            country={form.country}
            value={form.city}
            onChange={(v) => update('city', v)}
            error={fieldErrors.city}
            onDropdownOpenChange={setDropdownOpen}
            scrollFieldAboveKeyboard={scrollFieldAboveKeyboard}
          />

          <View style={formStyles.field}>
            <PhoneField
              code={form.phoneCode}
              countryCca2={form.phoneCountryCca2}
              phone={form.phone}
              onChangeCode={(v) => update('phoneCode', v)}
              onChangeCountryCca2={(v) => update('phoneCountryCca2', v)}
              onChangePhone={(v) => update('phone', v)}
              error={fieldErrors.phone}
              onDropdownOpenChange={setDropdownOpen}
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
                onPress={() => update('gender', form.gender === value ? null : value)}
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
              onChangeText={(v) => update('genderOther', v)}
              containerStyle={[formStyles.field, styles.genderOther]}
            />
          ) : null}

          <View style={[styles.bodyRow, styles.sectionSpacing]}>
            <AuthInput
              label="PESO (KG)"
              icon="barbell-outline"
              placeholder="Ej: 72"
              keyboardType="decimal-pad"
              editable={!later}
              value={later ? '' : form.weightKg}
              onChangeText={(v) => update('weightKg', v)}
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
              onChangeText={(v) => update('heightCm', v)}
              error={later ? undefined : fieldErrors.heightCm}
              containerStyle={[styles.bodyInput, later && formStyles.disabledField]}
            />
          </View>
          <Pressable
            onPress={() => update('shareBodyLater', !form.shareBodyLater)}
            style={({ pressed }) => [styles.laterRow, later && styles.laterRowActive, pressed && formStyles.pressed]}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: later }}
          >
            <View style={[formStyles.checkbox, later && formStyles.markerSelected]}>
              {later ? <Ionicons name="checkmark" size={14} color={authColors.background} /> : null}
            </View>
            <AppText variant="body14" color={later ? authColors.textPrimary : authColors.textSecondary} style={formStyles.optionLabel}>
              Prefiero compartirlo en la videollamada con Ale.
            </AppText>
          </Pressable>

          <SectionLabel>¿CUÁL ES TU OBJETIVO PRINCIPAL?</SectionLabel>
          <View style={formStyles.chips}>
            {EVALUATION_GOALS.map((goal) => (
              <Chip
                key={goal}
                label={goal}
                active={form.mainGoal === goal}
                onPress={() => update('mainGoal', form.mainGoal === goal ? null : goal)}
              />
            ))}
          </View>
          <FieldError message={fieldErrors.mainGoal} />

          <AuthInput
            label="CONTANOS BREVEMENTE TU SITUACIÓN ACTUAL"
            placeholder="Rutina actual, lesiones, hábitos, lo que quieras contar"
            value={form.situation}
            onChangeText={(v) => update('situation', v)}
            error={fieldErrors.situation}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            containerStyle={[formStyles.field, styles.sectionSpacing]}
          />

          <Pressable
            onPress={() => update('acceptedTerms', !form.acceptedTerms)}
            style={({ pressed }) => [styles.termsRow, pressed && formStyles.pressed]}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: form.acceptedTerms }}
          >
            <View style={[formStyles.checkbox, form.acceptedTerms && formStyles.markerSelected]}>
              {form.acceptedTerms ? <Ionicons name="checkmark" size={14} color={authColors.background} /> : null}
            </View>
            <AppText variant="body13" color={authColors.textSecondary} style={formStyles.optionLabel}>
              He leído y acepto los términos y condiciones.
            </AppText>
          </Pressable>
          <FieldError message={fieldErrors.acceptedTerms} />

          <AuthButton
            label="ENVIAR SOLICITUD"
            onPress={() => void handleSubmit()}
            loading={submitting}
            fullWidth
            style={formStyles.cta}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: authColors.background },
  content: { paddingHorizontal: spacing.xl },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.xs,
  },
  backBtn: { borderColor: authColors.border, flexShrink: 0 },
  title: { flex: 1, letterSpacing: -0.5 },
  subtitle: { marginBottom: spacing.lg, lineHeight: 20 },
  sectionSpacing: { marginTop: spacing.md },
  genderOther: { marginTop: spacing.sm },
  bodyRow: { flexDirection: 'row', gap: spacing.md },
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
    marginTop: spacing.sm,
  },
  laterRowActive: { borderColor: LIMA },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
});
