import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing } from '../../theme';
import { AppText } from '../../components/common';
import { hapticSelect } from '../../lib/haptics';
import { fetchCitiesForCountry } from '../../services/geo';
import { DateTimePicker, nativeDatePickerAvailable } from '../../lib/datePicker';
import { authColors } from './authScreenTheme';
import { AuthButton, AuthInput } from './authUi';
import { COUNTRY_CODES, type CountryOption } from './onboardingConstants';

/**
 * Componentes de campo reutilizados por cualquier formulario con el look & feel
 * de auth/onboarding (ej. OnboardingScreen, el formulario de evaluación de
 * mentoría). Mantiene una única fuente de verdad para el selector de país,
 * el de código de teléfono, la fecha de nacimiento, y los estilos base.
 */

export const LIMA = authColors.lima;

/**
 * Al elegir un país en el CountryField, el código de teléfono debería seguirlo
 * automáticamente (mismo comportamiento en Onboarding y en el formulario de
 * evaluación) — esta es la única fuente de verdad para esa sincronización.
 * Devuelve null si el nombre no matchea ninguna opción (no debería pasar,
 * viene del mismo picker que arma COUNTRY_CODES).
 */
export function matchPhoneCodeForCountry(countryName: string): { phoneCode: string; phoneCountryCca2: string } | null {
  const selected = COUNTRY_CODES.find((c) => c.name === countryName);
  return selected ? { phoneCode: selected.code, phoneCountryCca2: selected.cca2 } : null;
}

export function toggleInList(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

// ── Reusable UI in the auth aesthetic ────────────────────────────────────────

interface OptionRowProps {
  label: string;
  selected: boolean;
  mode: 'radio' | 'checkbox';
  onPress: () => void;
}

export function OptionRow({ label, selected, mode, onPress }: OptionRowProps): React.JSX.Element {
  return (
    <Pressable
      accessibilityRole={mode === 'radio' ? 'radio' : 'checkbox'}
      accessibilityState={{ selected }}
      onPress={() => { hapticSelect(); onPress(); }}
      style={({ pressed }) => [
        formStyles.optionRow,
        selected && formStyles.optionRowSelected,
        pressed && formStyles.pressed,
      ]}
    >
      <View style={[mode === 'radio' ? formStyles.radio : formStyles.checkbox, selected && formStyles.markerSelected]}>
        {selected ? (
          mode === 'radio'
            ? <View style={formStyles.radioDot} />
            : <Ionicons name="checkmark" size={14} color={authColors.background} />
        ) : null}
      </View>
      <AppText variant="body14" color={selected ? authColors.textPrimary : authColors.textSecondary} style={formStyles.optionLabel}>
        {label}
      </AppText>
    </Pressable>
  );
}

interface ChipProps { label: string; active: boolean; onPress: () => void }

export function Chip({ label, active, onPress }: ChipProps): React.JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={() => { hapticSelect(); onPress(); }}
      style={({ pressed }) => [formStyles.chip, active && formStyles.chipActive, pressed && formStyles.pressed]}
    >
      <AppText variant="caps12" color={active ? authColors.background : authColors.textSecondary}>
        {label}
      </AppText>
    </Pressable>
  );
}

export function SectionLabel({ children }: { children: string }): React.JSX.Element {
  return (
    <AppText variant="caps12" color={authColors.textTertiary} style={formStyles.sectionLabel}>
      {children}
    </AppText>
  );
}

export function FieldError({ message }: { message?: string }): React.JSX.Element | null {
  if (!message) return null;
  return (
    <AppText variant="body12" color={authColors.errorText} style={formStyles.fieldError}>
      {message}
    </AppText>
  );
}

// ── Phone field with country-code dropdown ───────────────────────────────────

/**
 * El autocomplete de iOS pega el número completo en formato internacional
 * (ej. "+54 9 11 1234-5678") dentro del campo de número, código incluido.
 * Si el texto entrante arranca con "+", separamos el código de país conocido
 * más largo que matchee y devolvemos el resto como número local.
 */
export function parseAutofillPhone(raw: string): { code: string | null; rest: string } {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('+')) return { code: null, rest: raw };
  const digits = trimmed.replace(/\D/g, '');
  const match = COUNTRY_CODES
    .filter((c) => digits.startsWith(c.code.slice(1)))
    .sort((a, b) => b.code.length - a.code.length)[0];
  if (!match) return { code: null, rest: raw };
  return { code: match.code, rest: digits.slice(match.code.length - 1) };
}

export interface PhoneFieldProps {
  code: string;
  /** cca2 del país elegido (desambigua países que comparten código, ej. +1). */
  countryCca2: string;
  phone: string;
  onChangeCode: (code: string) => void;
  onChangeCountryCca2: (cca2: string) => void;
  onChangePhone: (phone: string) => void;
  error?: string;
  onDropdownOpenChange?: (open: boolean) => void;
  scrollFieldAboveKeyboard?: (nodeHandle: number, extraRoom?: number) => void;
}

export function PhoneField({
  code,
  countryCca2,
  phone,
  onChangeCode,
  onChangeCountryCca2,
  onChangePhone,
  error,
  onDropdownOpenChange,
  scrollFieldAboveKeyboard,
}: PhoneFieldProps): React.JSX.Element {
  // Varios países comparten el mismo `code` (+1 = EE.UU./Canadá/Rep. Dominicana/...),
  // por eso el país mostrado se resuelve primero por cca2 (identidad exacta) y solo
  // si falta se cae al código (ambiguo: puede mostrar cualquiera de los que comparten +1).
  const selected = COUNTRY_CODES.find((c) => c.cca2 === countryCca2)
    ?? COUNTRY_CODES.find((c) => c.code === code)
    ?? COUNTRY_CODES[0];
  const [query, setQuery] = useState(selected?.code ?? '');
  // Mismo hook que País/Ciudad: el campo de código ES el input (no un botón que abre
  // un modal aparte), así el cierre al tocar afuera funciona igual (blur nativo del
  // TextInput), en vez de depender de un estado "open" manual.
  const { focused, onFocus, onBlur, close, setScrolling } = useDismissableFocus();

  useEffect(() => { setQuery(selected?.code ?? ''); }, [selected?.code]);
  useEffect(() => { onDropdownOpenChange?.(focused); }, [focused, onDropdownOpenChange]);

  const suggestions = useMemo(() => {
    if (!focused) return [];
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRY_CODES;
    return COUNTRY_CODES.filter((c) => c.name.toLowerCase().includes(q) || c.code.includes(q));
  }, [query, focused]);

  const select = (item: CountryOption) => {
    onChangeCode(item.code);
    onChangeCountryCca2(item.cca2);
    close();
    Keyboard.dismiss();
  };

  return (
    <View>
      <AppText variant="caps12" color={authColors.textTertiary} style={formStyles.inputLabel}>
        TELÉFONO
      </AppText>
      <View style={formStyles.phoneRow}>
        <AuthInput
          leftElement={selected ? <AppText variant="body16">{selected.flag}</AppText> : null}
          value={query}
          onChangeText={setQuery}
          onFocus={(e) => {
            onFocus();
            // La lista de países queda pegada al teclado (el campo está casi al final
            // del form); subimos el scroll para que entren varias filas visibles.
            scrollFieldAboveKeyboard?.(e.nativeEvent.target, 220);
          }}
          onBlur={onBlur}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Código de país"
          containerStyle={formStyles.codeInputContainer}
        />
        <AuthInput
          placeholder="11 1234 5678"
          keyboardType="number-pad"
          autoComplete="tel"
          value={phone}
          onChangeText={(text) => {
            const { code: detectedCode, rest } = parseAutofillPhone(text);
            if (detectedCode) {
              onChangeCode(detectedCode);
              const match = COUNTRY_CODES.find((c) => c.code === detectedCode);
              if (match) onChangeCountryCca2(match.cca2);
              onChangePhone(rest);
            } else {
              onChangePhone(text.replace(/[^\d\s]/g, ''));
            }
          }}
          error={error}
          containerStyle={formStyles.phoneInput}
        />
      </View>

      {/* Dropdown inline (mismo patrón que el campo País): el propio input de
          código filtra la lista al escribir, sin modal a pantalla completa. */}
      {suggestions.length > 0 ? (
        <ScrollView
          style={formStyles.citySuggestions}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          onTouchStart={() => setScrolling(true)}
          onScrollBeginDrag={() => setScrolling(true)}
          onScrollEndDrag={() => setScrolling(false)}
          onMomentumScrollBegin={() => setScrolling(true)}
          onMomentumScrollEnd={() => setScrolling(false)}
        >
          {suggestions.map((item) => {
            const active = item.cca2 === selected?.cca2;
            return (
              <Pressable
                key={item.code + item.cca2}
                onPress={() => select(item)}
                style={({ pressed }) => [formStyles.codeOption, active && formStyles.codeOptionActive, pressed && formStyles.pressed]}
              >
                <AppText variant="body16" color={authColors.textPrimary}>{item.flag}  {item.name}</AppText>
                <AppText variant="body14SemiBold" color={active ? LIMA : authColors.textTertiary}>{item.code}</AppText>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
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
export function useDismissableFocus() {
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

export interface CountryFieldProps {
  value: string;
  onChange: (country: string) => void;
  error?: string;
  /** La pantalla desactiva su propio scroll mientras el dropdown está abierto,
   * para que no compita por el gesto con el ScrollView de las sugerencias. */
  onDropdownOpenChange?: (open: boolean) => void;
}

export function CountryField({ value, onChange, error, onDropdownOpenChange }: CountryFieldProps): React.JSX.Element {
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
    <View style={formStyles.field}>
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
          style={formStyles.citySuggestions}
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
              style={({ pressed }) => [formStyles.cityOption, pressed && formStyles.pressed]}
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

export interface CityFieldProps {
  country: string;
  value: string;
  onChange: (city: string) => void;
  error?: string;
  onDropdownOpenChange?: (open: boolean) => void;
}

export function CityField({ country, value, onChange, error, onDropdownOpenChange }: CityFieldProps): React.JSX.Element {
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
    <View style={formStyles.field}>
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
        containerStyle={!hasValidCountry ? formStyles.disabledField : undefined}
      />
      {suggestions.length > 0 ? (
        <ScrollView
          style={formStyles.citySuggestions}
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
              style={({ pressed }) => [formStyles.cityOption, pressed && formStyles.pressed]}
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
      <Pressable style={formStyles.modalBackdrop} onPress={onClose}>
        <Pressable style={formStyles.modalSheet} onPress={(e) => e.stopPropagation()}>
          <AppText variant="caps12" color={authColors.textTertiary} style={formStyles.modalTitle}>
            {title}
          </AppText>
          <FlatList
            data={options}
            keyExtractor={(item) => String(item.value)}
            style={formStyles.modalList}
            initialScrollIndex={Math.max(0, options.findIndex((o) => o.value === selectedValue))}
            getItemLayout={(_, index) => ({ length: 62, offset: 62 * index, index })}
            renderItem={({ item }) => {
              const active = item.value === selectedValue;
              return (
                <Pressable
                  onPress={() => { onSelect(item.value); onClose(); }}
                  style={({ pressed }) => [formStyles.codeOption, active && formStyles.codeOptionActive, pressed && formStyles.pressed]}
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

export interface BirthDateFieldProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

export function BirthDateField({ value, onChange, error }: BirthDateFieldProps): React.JSX.Element {
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
    <View style={formStyles.field}>
      <AppText variant="caps12" color={authColors.textTertiary} style={formStyles.inputLabel}>
        FECHA DE NACIMIENTO
      </AppText>
      <Pressable
        onPress={openPicker}
        style={({ pressed }) => [formStyles.codeBtn, formStyles.countryBtn, error ? formStyles.codeBtnError : null, pressed && formStyles.pressed]}
        accessibilityRole="button"
        accessibilityLabel="Elegir fecha de nacimiento"
      >
        <View style={formStyles.countryBtnLabel}>
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
            <Pressable style={formStyles.modalBackdrop} onPress={() => setOpen(false)}>
              <Pressable style={formStyles.modalSheet} onPress={(e) => e.stopPropagation()}>
                <DateTimePicker
                  value={pending}
                  mode="date"
                  display="spinner"
                  maximumDate={new Date()}
                  onChange={(_e, d) => d && setPending(d)}
                  themeVariant="dark"
                />
                <AuthButton label="CONFIRMAR" onPress={() => confirm(pending)} style={formStyles.cta} />
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
            <Pressable style={formStyles.modalBackdrop} onPress={() => setOpen(false)}>
              <Pressable style={formStyles.modalSheet} onPress={(e) => e.stopPropagation()}>
                <AppText variant="caps12" color={authColors.textTertiary} style={formStyles.modalTitle}>
                  FECHA DE NACIMIENTO
                </AppText>
                <View style={formStyles.birthDateRow}>
                  <Pressable style={formStyles.birthDateChip} onPress={() => setOpenColumn('day')}>
                    <AppText variant="body16" color={authColors.textPrimary}>{pad2(pending.getDate())}</AppText>
                  </Pressable>
                  <Pressable style={formStyles.birthDateChip} onPress={() => setOpenColumn('month')}>
                    <AppText variant="body16" color={authColors.textPrimary}>{MONTH_NAMES[pending.getMonth()]}</AppText>
                  </Pressable>
                  <Pressable style={formStyles.birthDateChip} onPress={() => setOpenColumn('year')}>
                    <AppText variant="body16" color={authColors.textPrimary}>{pending.getFullYear()}</AppText>
                  </Pressable>
                </View>
                <AuthButton label="CONFIRMAR" onPress={() => confirm(pending)} style={formStyles.cta} />
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

// ── Estilos compartidos ───────────────────────────────────────────────────────

export const formStyles = StyleSheet.create({
  field:        { marginBottom: spacing.md },
  inputLabel:   { marginBottom: spacing.xs, letterSpacing: 0.4 },

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

  disabledField: { opacity: 0.4 },

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

  cta: { marginTop: spacing.xl },

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
  codeInputContainer: { width: 108 },
  phoneInput: { flex: 1 },
  countryBtn: { justifyContent: 'space-between' },
  countryBtnLabel: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },

  // Modales (código de país, fecha de nacimiento)
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

  // Country/city autocomplete
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
