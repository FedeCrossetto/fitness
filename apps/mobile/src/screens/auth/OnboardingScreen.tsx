import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Keyboard,
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
import { parsePhoneNumber } from 'awesome-phonenumber';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '../../theme';
import { useClientConfig } from '../../config/useClientConfig';
import { AppText, IconButton } from '../../components/common';
import { useAuthStore } from '../../stores/authStore';
import { hapticSelect, hapticSuccess } from '../../lib/haptics';
import { fetchCitiesForCountry } from '../../services/geo';
import { DateTimePicker, nativeDatePickerAvailable } from '../../lib/datePicker';
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
  type CountryOption,
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

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatDMY(date: Date): string {
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`;
}

function parseDMY(value: string): Date | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return null;
  const [, dd, mm, yyyy] = match.map(Number) as unknown as [number, number, number, number];
  return new Date(yyyy, mm - 1, dd);
}

/** Por defecto abre el picker en una fecha de hace 25 años (referencia razonable para un adulto). */
function defaultBirthDate(): Date {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 25);
  return d;
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function daysInMonth(year: number, month1to12: number): number {
  return new Date(year, month1to12, 0).getDate();
}

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

/** Buscador reutilizado por los modales de país / código de país (245 opciones, hace falta filtrar). */
function CountrySearchModal({
  visible,
  title,
  onClose,
  renderItem,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  renderItem: (item: CountryOption) => React.JSX.Element;
}): React.JSX.Element {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRY_CODES;
    return COUNTRY_CODES.filter((c) => c.name.toLowerCase().includes(q) || c.code.includes(q));
  }, [query]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
          <AppText variant="caps12" color={authColors.textTertiary} style={styles.modalTitle}>
            {title}
          </AppText>
          <AuthInput
            placeholder="Buscar país..."
            icon="search-outline"
            autoCapitalize="none"
            autoCorrect={false}
            value={query}
            onChangeText={setQuery}
            containerStyle={styles.modalSearch}
          />
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.code + item.cca2}
            keyboardShouldPersistTaps="handled"
            style={styles.modalList}
            renderItem={({ item }) => renderItem(item)}
            ListEmptyComponent={
              <AppText variant="body14" color={authColors.textTertiary} style={styles.modalEmpty}>
                No encontramos ese país.
              </AppText>
            }
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Phone field with country-code dropdown ───────────────────────────────────

/**
 * El autocomplete de iOS pega el número completo en formato internacional
 * (ej. "+54 9 11 1234-5678") dentro del campo de número, código incluido.
 * Si el texto entrante arranca con "+", separamos el código de país conocido
 * más largo que matchee y devolvemos el resto como número local.
 */
function parseAutofillPhone(raw: string): { code: string | null; rest: string } {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('+')) return { code: null, rest: raw };
  const digits = trimmed.replace(/\D/g, '');
  const match = COUNTRY_CODES
    .filter((c) => digits.startsWith(c.code.slice(1)))
    .sort((a, b) => b.code.length - a.code.length)[0];
  if (!match) return { code: null, rest: raw };
  return { code: match.code, rest: digits.slice(match.code.length - 1) };
}

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
          style={({ pressed }) => [styles.codeBtn, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Elegir código de país"
        >
          <AppText variant="body16" color={authColors.textPrimary}>{selected?.flag} {selected?.code}</AppText>
          <Ionicons name="chevron-down" size={14} color={authColors.textTertiary} />
        </Pressable>
        <AuthInput
          placeholder="11 1234 5678"
          keyboardType="number-pad"
          autoComplete="tel"
          value={phone}
          onChangeText={(text) => {
            const { code: detectedCode, rest } = parseAutofillPhone(text);
            if (detectedCode) {
              onChangeCode(detectedCode);
              onChangePhone(rest);
            } else {
              onChangePhone(text.replace(/[^\d\s]/g, ''));
            }
          }}
          error={error}
          containerStyle={styles.phoneInput}
        />
      </View>

      <CountrySearchModal
        visible={open}
        title="CÓDIGO DE PAÍS"
        onClose={() => setOpen(false)}
        renderItem={(item) => {
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
    </View>
  );
}

/**
 * Abrir/cerrar el dropdown de autocomplete sin la carrera clásica de RN:
 * onBlur cierra con un delay (para dejar tiempo a que un tap en una fila
 * se procese), pero CUALQUIER toque nuevo dentro del dropdown —tap o el
 * inicio de un scroll— cancela ese cierre pendiente. Sin esto, un segundo
 * gesto de scroll podía cerrar el dropdown a mitad de camino: el blur del
 * primer toque quedaba con un cierre pendiente que disparaba tarde, durante
 * el segundo scroll.
 */
function useDismissableFocus() {
  const [focused, setFocused] = useState(false);
  const hideTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  // true mientras hay un drag o un momentum-scroll en curso en el dropdown.
  // iOS puede blurear el TextInput ~40ms después de que arranca el momentum
  // de un segundo scroll que interrumpe al primero (antes de que termine de
  // desacelerar). Mientras esto sea true, un blur nativo no programa cierre
  // — es ruido del gesto, no que el usuario se fue del campo.
  const scrollingRef = useRef(false);

  const cancelHide = useCallback(() => {
    if (hideTimeout.current) {
      clearTimeout(hideTimeout.current);
      hideTimeout.current = null;
    }
  }, []);

  const onFocus = useCallback(() => { cancelHide(); setFocused(true); }, [cancelHide]);

  const onBlur = useCallback(() => {
    if (scrollingRef.current) return;
    cancelHide();
    hideTimeout.current = setTimeout(() => setFocused(false), 300);
  }, [cancelHide]);

  const close = useCallback(() => { cancelHide(); setFocused(false); }, [cancelHide]);

  const setScrolling = useCallback((active: boolean) => {
    scrollingRef.current = active;
    if (active) cancelHide();
  }, [cancelHide]);

  return { focused, onFocus, onBlur, cancelHide, close, setScrolling };
}

// ── Country selector (reusa COUNTRY_CODES y el patrón del modal de teléfono) ──

interface CountryFieldProps {
  value: string;
  onChange: (country: string) => void;
  error?: string;
  /** La pantalla desactiva su propio scroll mientras el dropdown está abierto,
   * para que no compita por el gesto con el ScrollView de las sugerencias. */
  onDropdownOpenChange?: (open: boolean) => void;
}

function CountryField({ value, onChange, error, onDropdownOpenChange }: CountryFieldProps): React.JSX.Element {
  const [query, setQuery] = useState(value);
  const { focused, onFocus, onBlur, close, setScrolling } = useDismissableFocus();
  const selected = COUNTRY_CODES.find((c) => c.name === value);

  // Si el valor cambia desde afuera (ej. nunca) mantenemos el texto mostrado sincronizado.
  useEffect(() => { setQuery(value); }, [value]);

  useEffect(() => { onDropdownOpenChange?.(focused); }, [focused, onDropdownOpenChange]);

  const suggestions = useMemo(() => {
    if (!focused) return [];
    const q = query.trim().toLowerCase();
    // Sin tope: son ~245 países, el ScrollView de abajo ya maneja el scroll.
    return q ? COUNTRY_CODES.filter((c) => c.name.toLowerCase().includes(q)) : COUNTRY_CODES;
  }, [query, focused]);

  const select = (country: CountryOption) => {
    setQuery(country.name);
    onChange(country.name);
    close();
    // Sin esto el input nativo sigue enfocado: el cursor queda parpadeando
    // ahí y, al volver a escribir, no llega un onFocus nuevo que reabra
    // las sugerencias (quedan apagadas para siempre).
    Keyboard.dismiss();
  };

  return (
    <View style={styles.field}>
      <AuthInput
        label="PAÍS"
        leftElement={selected ? <AppText variant="body16">{selected.flag}</AppText> : null}
        placeholder="Ej: Argentina"
        autoCapitalize="words"
        value={query}
        onChangeText={(text) => { setQuery(text); if (text.trim() === '') onChange(''); }}
        onFocus={onFocus}
        onBlur={onBlur}
        error={error}
      />
      {suggestions.length > 0 ? (
        <ScrollView
          style={styles.citySuggestions}
          nestedScrollEnabled
          keyboardShouldPersistTaps="always"
          showsVerticalScrollIndicator={false}
          onTouchStart={() => setScrolling(true)}
          onScrollBeginDrag={() => setScrolling(true)}
          onScrollEndDrag={() => setScrolling(false)}
          onMomentumScrollBegin={() => setScrolling(true)}
          onMomentumScrollEnd={() => setScrolling(false)}
        >
          {suggestions.map((c) => (
            <Pressable
              key={c.cca2}
              onPress={() => select(c)}
              style={({ pressed }) => [styles.cityOption, pressed && styles.pressed]}
            >
              <AppText variant="body14" color={authColors.textPrimary}>{c.flag}  {c.name}</AppText>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

// ── City field: autocomplete por país, con fallback a texto libre ────────────

interface CityFieldProps {
  country: string;
  value: string;
  onChange: (city: string) => void;
  error?: string;
  onDropdownOpenChange?: (open: boolean) => void;
}

function CityField({ country, value, onChange, error, onDropdownOpenChange }: CityFieldProps): React.JSX.Element {
  const [allCities, setAllCities] = useState<string[] | null>(null);
  const { focused, onFocus, onBlur, close, setScrolling } = useDismissableFocus();
  const loadedForCountry = useRef<string | null>(null);
  const hasValidCountry = COUNTRY_CODES.some((c) => c.name === country);

  useEffect(() => { onDropdownOpenChange?.(focused); }, [focused, onDropdownOpenChange]);

  useEffect(() => {
    const selected = COUNTRY_CODES.find((c) => c.name === country);
    if (!selected) { setAllCities(null); return; }
    if (loadedForCountry.current === selected.nameEn) return;
    loadedForCountry.current = selected.nameEn;
    setAllCities(null);
    void fetchCitiesForCountry(selected.nameEn).then((cities) => {
      if (loadedForCountry.current === selected.nameEn) setAllCities(cities);
    });
  }, [country]);

  const suggestions = useMemo(() => {
    if (!allCities || !focused) return [];
    const q = value.trim().toLowerCase();
    const list = q ? allCities.filter((c) => c.toLowerCase().includes(q)) : allCities;
    return list.slice(0, 8);
  }, [allCities, value, focused]);

  return (
    <View style={styles.field}>
      <AuthInput
        label="CIUDAD"
        placeholder={
          !hasValidCountry
            ? 'Elegí un país primero'
            : focused
              ? 'Comenzá a escribir tu ciudad'
              : 'Ej: Buenos Aires'
        }
        autoCapitalize="words"
        editable={hasValidCountry}
        value={value}
        onChangeText={onChange}
        onFocus={onFocus}
        onBlur={onBlur}
        error={error}
        containerStyle={!hasValidCountry ? styles.disabledField : undefined}
      />
      {suggestions.length > 0 ? (
        <ScrollView
          style={styles.citySuggestions}
          nestedScrollEnabled
          keyboardShouldPersistTaps="always"
          showsVerticalScrollIndicator={false}
          onTouchStart={() => setScrolling(true)}
          onScrollBeginDrag={() => setScrolling(true)}
          onScrollEndDrag={() => setScrolling(false)}
          onMomentumScrollBegin={() => setScrolling(true)}
          onMomentumScrollEnd={() => setScrolling(false)}
        >
          {suggestions.map((city) => (
            <Pressable
              key={city}
              onPress={() => { onChange(city); close(); Keyboard.dismiss(); }}
              style={({ pressed }) => [styles.cityOption, pressed && styles.pressed]}
            >
              <AppText variant="body14" color={authColors.textPrimary}>{city}</AppText>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

// ── Fecha de nacimiento: picker nativo si hay dev client, columnas propias en Expo Go ──

interface OptionModalItem { value: number; label: string }

/** Modal simple de una columna (reutilizado para día / mes / año). */
function OptionPickerModal({
  visible,
  title,
  options,
  selectedValue,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: OptionModalItem[];
  selectedValue: number;
  onSelect: (value: number) => void;
  onClose: () => void;
}): React.JSX.Element {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
          <AppText variant="caps12" color={authColors.textTertiary} style={styles.modalTitle}>
            {title}
          </AppText>
          <FlatList
            data={options}
            keyExtractor={(item) => String(item.value)}
            style={styles.modalList}
            initialScrollIndex={Math.max(0, options.findIndex((o) => o.value === selectedValue))}
            getItemLayout={(_, index) => ({ length: 62, offset: 62 * index, index })}
            renderItem={({ item }) => {
              const active = item.value === selectedValue;
              return (
                <Pressable
                  onPress={() => { onSelect(item.value); onClose(); }}
                  style={({ pressed }) => [styles.codeOption, active && styles.codeOptionActive, pressed && styles.pressed]}
                >
                  <AppText variant="body16" color={authColors.textPrimary}>{item.label}</AppText>
                  {active ? <Ionicons name="checkmark" size={18} color={LIMA} /> : null}
                </Pressable>
              );
            }}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

interface BirthDateFieldProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

function BirthDateField({ value, onChange, error }: BirthDateFieldProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [openColumn, setOpenColumn] = useState<'day' | 'month' | 'year' | null>(null);
  const [pending, setPending] = useState<Date>(() => parseDMY(value) ?? defaultBirthDate());

  const openPicker = () => {
    setPending(parseDMY(value) ?? defaultBirthDate());
    setOpen(true);
  };

  const confirm = (date: Date) => {
    onChange(formatDMY(date));
    setOpen(false);
    setOpenColumn(null);
  };

  const nowYear = new Date().getFullYear();
  const years: OptionModalItem[] = Array.from({ length: 88 }, (_, i) => {
    const y = nowYear - 13 - i;
    return { value: y, label: String(y) };
  });
  const months: OptionModalItem[] = MONTH_NAMES.map((label, i) => ({ value: i + 1, label }));
  const days: OptionModalItem[] = Array.from(
    { length: daysInMonth(pending.getFullYear(), pending.getMonth() + 1) },
    (_, i) => ({ value: i + 1, label: String(i + 1) }),
  );

  const setDay = (d: number) => setPending((p) => new Date(p.getFullYear(), p.getMonth(), d));
  const setMonth = (m: number) => setPending((p) => {
    const maxDay = daysInMonth(p.getFullYear(), m);
    return new Date(p.getFullYear(), m - 1, Math.min(p.getDate(), maxDay));
  });
  const setYear = (y: number) => setPending((p) => {
    const maxDay = daysInMonth(y, p.getMonth() + 1);
    return new Date(y, p.getMonth(), Math.min(p.getDate(), maxDay));
  });

  return (
    <View style={styles.field}>
      <AppText variant="caps12" color={authColors.textTertiary} style={styles.inputLabel}>
        FECHA DE NACIMIENTO
      </AppText>
      <Pressable
        onPress={openPicker}
        style={({ pressed }) => [styles.codeBtn, styles.countryBtn, error ? styles.codeBtnError : null, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel="Elegir fecha de nacimiento"
      >
        <View style={styles.countryBtnLabel}>
          <Ionicons name="calendar-outline" size={18} color={authColors.textTertiary} />
          <AppText variant="body16" color={value ? authColors.textPrimary : authColors.textTertiary}>
            {value || 'Seleccioná tu fecha'}
          </AppText>
        </View>
        <Ionicons name="chevron-down" size={14} color={authColors.textTertiary} />
      </Pressable>
      <FieldError message={error} />

      {nativeDatePickerAvailable && DateTimePicker ? (
        Platform.OS === 'ios' ? (
          <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
            <Pressable style={styles.modalBackdrop} onPress={() => setOpen(false)}>
              <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
                <DateTimePicker
                  value={pending}
                  mode="date"
                  display="spinner"
                  maximumDate={new Date()}
                  onChange={(_e, d) => d && setPending(d)}
                  themeVariant="dark"
                />
                <AuthButton label="CONFIRMAR" onPress={() => confirm(pending)} style={styles.cta} />
              </Pressable>
            </Pressable>
          </Modal>
        ) : (
          open ? (
            <DateTimePicker
              value={pending}
              mode="date"
              display="default"
              maximumDate={new Date()}
              onChange={(_e, d) => { setOpen(false); if (d) confirm(d); }}
            />
          ) : null
        )
      ) : (
        <>
          <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
            <Pressable style={styles.modalBackdrop} onPress={() => setOpen(false)}>
              <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
                <AppText variant="caps12" color={authColors.textTertiary} style={styles.modalTitle}>
                  FECHA DE NACIMIENTO
                </AppText>
                <View style={styles.birthDateRow}>
                  <Pressable style={styles.birthDateChip} onPress={() => setOpenColumn('day')}>
                    <AppText variant="body16" color={authColors.textPrimary}>{pad2(pending.getDate())}</AppText>
                  </Pressable>
                  <Pressable style={styles.birthDateChip} onPress={() => setOpenColumn('month')}>
                    <AppText variant="body16" color={authColors.textPrimary}>{MONTH_NAMES[pending.getMonth()]}</AppText>
                  </Pressable>
                  <Pressable style={styles.birthDateChip} onPress={() => setOpenColumn('year')}>
                    <AppText variant="body16" color={authColors.textPrimary}>{pending.getFullYear()}</AppText>
                  </Pressable>
                </View>
                <AuthButton label="CONFIRMAR" onPress={() => confirm(pending)} style={styles.cta} />
              </Pressable>
            </Pressable>
          </Modal>
          <OptionPickerModal
            visible={openColumn === 'day'}
            title="DÍA"
            options={days}
            selectedValue={pending.getDate()}
            onSelect={setDay}
            onClose={() => setOpenColumn(null)}
          />
          <OptionPickerModal
            visible={openColumn === 'month'}
            title="MES"
            options={months}
            selectedValue={pending.getMonth() + 1}
            onSelect={setMonth}
            onClose={() => setOpenColumn(null)}
          />
          <OptionPickerModal
            visible={openColumn === 'year'}
            title="AÑO"
            options={years}
            selectedValue={pending.getFullYear()}
            onSelect={setYear}
            onClose={() => setOpenColumn(null)}
          />
        </>
      )}
    </View>
  );
}

// ── Steps ────────────────────────────────────────────────────────────────────

interface StepProps {
  form: OnboardingFormData;
  setForm: React.Dispatch<React.SetStateAction<OnboardingFormData>>;
  fieldErrors: Partial<Record<keyof OnboardingFormData, string>>;
  /** Solo lo usa ProfileStep (país/ciudad), pero viaja en el prop compartido. */
  onDropdownOpenChange?: (open: boolean) => void;
}

function ProfileStep({ form, setForm, fieldErrors, onDropdownOpenChange }: StepProps): React.JSX.Element {
  return (
    <>
      <CountryField
        value={form.country}
        onChange={(country) => {
          const selected = COUNTRY_CODES.find((c) => c.name === country);
          setForm((p) => (
            p.country === country
              ? p
              : { ...p, country, phoneCode: selected?.code ?? p.phoneCode, city: '' }
          ));
        }}
        error={fieldErrors.country}
        onDropdownOpenChange={onDropdownOpenChange}
      />
      <CityField
        country={form.country}
        value={form.city}
        onChange={(city) => setForm((p) => ({ ...p, city }))}
        error={fieldErrors.city}
        onDropdownOpenChange={onDropdownOpenChange}
      />
      <AuthInput
        label="CÓDIGO POSTAL"
        placeholder="Ej: 1414"
        autoCapitalize="characters"
        value={form.postalCode}
        onChangeText={(postalCode) => setForm((p) => ({ ...p, postalCode }))}
        error={fieldErrors.postalCode}
        containerStyle={styles.field}
      />
      <View style={[styles.addressRow, styles.field]}>
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
        containerStyle={styles.field}
      />
      <BirthDateField
        value={form.birthDate}
        onChange={(birthDate) => setForm((p) => ({ ...p, birthDate }))}
        error={fieldErrors.birthDate}
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

      <SectionLabel>SEXO</SectionLabel>
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

function DetailsStep({ form, setForm, fieldErrors }: StepProps): React.JSX.Element {
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
      <FieldError message={fieldErrors.availableDays} />

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
  const [form, setFormRaw] = useState<OnboardingFormData>(EMPTY_ONBOARDING);
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

  const stepContent = useMemo(() => {
    const props = { form, setForm, fieldErrors, onDropdownOpenChange: setDropdownOpen };
    switch (step) {
      case 0:  return <ProfileStep {...props} />;
      case 1:  return <BodyStep {...props} />;
      case 2:  return <TrainingStep {...props} />;
      default: return <DetailsStep {...props} />;
    }
  }, [step, form, fieldErrors, setForm]);

  const validateStep = (): boolean => {
    const errors: Partial<Record<keyof OnboardingFormData, string>> = {};

    if (step === 0) {
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
  addressRow:    { flexDirection: 'row', gap: spacing.sm },
  addressStreet: { flex: 2 },
  addressNumber: { flex: 1 },
  birthDateRow:   { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  birthDateChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: authColors.border,
    backgroundColor: authColors.surface,
  },
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
  phoneRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
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
  countryBtn: { justifyContent: 'space-between' },
  countryBtnLabel: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },

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
  modalSearch: { marginBottom: spacing.sm },
  modalList:  { flexGrow: 0 },
  modalEmpty: { textAlign: 'center', paddingVertical: spacing.lg },
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

  // City autocomplete
  citySuggestions: {
    marginTop: -spacing.xs,
    maxHeight: 240,
    backgroundColor: authColors.surface,
    borderWidth: 1,
    borderColor: authColors.border,
    borderRadius: 12,
    overflow: 'hidden',
  },
  cityOption: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
});
