import { isServingUnit, type ServingUnit } from './servingUnits';

export type StoredMacros = {
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
};

export type MacroTotals = {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
};

/** Etiqueta de referencia para los campos de macros guardados en DB. */
export function macroReferenceLabel(unit: ServingUnit): string {
  switch (unit) {
    case 'ml':
      return 'Por 100 ml';
    case 'unit':
      return 'Por unidad';
    default:
      return 'Por 100 g';
  }
}

export function defaultPortionAmount(unit: ServingUnit): number {
  return unit === 'unit' ? 1 : 100;
}

export function macroScaleFactor(portionAmount: number, servingUnit: ServingUnit): number {
  if (portionAmount <= 0) return 0;
  if (servingUnit === 'unit') return portionAmount;
  return portionAmount / 100;
}

/** Convierte macros almacenados → totales para una porción concreta. */
export function macrosForServing(
  stored: StoredMacros,
  portionAmount: number,
  servingUnit: ServingUnit,
): MacroTotals {
  const factor = macroScaleFactor(portionAmount, servingUnit);
  const scale = (v: number | null) => (v == null ? 0 : roundMacro(v * factor));
  return {
    kcal: Math.round((stored.kcal ?? 0) * factor),
    protein: scale(stored.protein),
    carbs: scale(stored.carbs),
    fat: scale(stored.fat),
  };
}

/** Totales manuales → macros almacenados (inverso de macrosForServing). */
export function macrosToStored(
  totals: MacroTotals,
  portionAmount: number,
  servingUnit: ServingUnit,
): StoredMacros {
  if (portionAmount <= 0) {
    return {
      kcal: totals.kcal,
      protein: totals.protein,
      carbs: totals.carbs,
      fat: totals.fat,
    };
  }
  const factor = servingUnit === 'unit' ? portionAmount : portionAmount / 100;
  const inv = factor > 0 ? 1 / factor : 1;
  const scale = (v: number) => roundMacro(v * inv);
  return {
    kcal: Math.round(totals.kcal * inv),
    protein: scale(totals.protein),
    carbs: scale(totals.carbs),
    fat: scale(totals.fat),
  };
}

export function kcalForDefaultServing(
  kcalStored: number | null,
  defaultAmount: number | null | undefined,
  servingUnit: ServingUnit,
): number | null {
  if (kcalStored == null) return null;
  const amount = defaultAmount ?? defaultPortionAmount(servingUnit);
  return macrosForServing({ kcal: kcalStored, protein: null, carbs: null, fat: null }, amount, servingUnit).kcal;
}

export function macrosForDefaultServing(
  stored: StoredMacros,
  defaultAmount: number | null | undefined,
  servingUnit: ServingUnit,
): MacroTotals {
  const amount = defaultAmount ?? defaultPortionAmount(servingUnit);
  return macrosForServing(stored, amount, servingUnit);
}

export function hasStoredMacros(stored: StoredMacros): boolean {
  return stored.kcal != null || stored.protein != null || stored.carbs != null || stored.fat != null;
}

const MACRO_DECIMALS = 3;

export function roundMacro(value: number, decimals = MACRO_DECIMALS): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** Normaliza texto mientras el usuario escribe un macro (g, kcal, etc.). */
export function sanitizeMacroInput(raw: string): string {
  let value = raw.replace(/,/g, '.');
  value = value.replace(/[^\d.]/g, '');
  const dot = value.indexOf('.');
  if (dot !== -1) {
    value = value.slice(0, dot + 1) + value.slice(dot + 1).replace(/\./g, '');
    const [, decimals = ''] = value.split('.');
    if (decimals.length > MACRO_DECIMALS) {
      value = `${value.split('.')[0]}.${decimals.slice(0, MACRO_DECIMALS)}`;
    }
  }
  return value;
}

/** Parsea un macro ingresado (acepta `.` o `,`). */
export function parseMacroAmount(raw: string): number | null {
  const trimmed = raw.trim().replace(',', '.');
  if (!trimmed) return null;
  const n = parseFloat(trimmed);
  if (!Number.isFinite(n) || n < 0) return null;
  return roundMacro(n);
}

/** Formatea un macro para inputs o display (sin ceros de más: 0.5, 27). */
export function formatMacroAmount(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '';
  return String(parseFloat(roundMacro(value).toFixed(MACRO_DECIMALS)));
}

export function formatMacroDisplay(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return formatMacroAmount(value) || '0';
}

/** Unidad con la que interpretar kcal_100g / protein_g_100g / etc. en DB. */
export function resolveMacroBasisUnit(options: {
  offProduct?: boolean;
  foodServingUnit?: ServingUnit | string | null;
  portionUnit: ServingUnit;
}): ServingUnit {
  if (options.offProduct) return 'g';
  if (isServingUnit(options.foodServingUnit)) return options.foodServingUnit;
  return options.portionUnit;
}

/** Normaliza texto mientras el usuario escribe la porción. */
export function sanitizePortionInput(raw: string, unit: ServingUnit): string {
  if (unit === 'unit') {
    return raw.replace(/\D/g, '').slice(0, 3);
  }
  let value = raw.replace(/,/g, '.');
  value = value.replace(/[^\d.]/g, '');
  const dot = value.indexOf('.');
  if (dot !== -1) {
    value = value.slice(0, dot + 1) + value.slice(dot + 1).replace(/\./g, '');
    const [, decimals = ''] = value.split('.');
    if (decimals.length > 1) value = `${value.split('.')[0]}.${decimals.slice(0, 1)}`;
  }
  return value;
}

/** Parsea porción ingresada a número positivo. */
export function parsePortionAmount(raw: string, unit: ServingUnit): number {
  const trimmed = raw.trim();
  if (!trimmed) return 0;
  if (unit === 'unit') {
    const n = parseInt(trimmed.replace(/\D/g, ''), 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }
  const normalized = trimmed.replace(',', '.');
  const n = parseFloat(normalized);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 10) / 10;
}

export function formatPortionAmount(amount: number, unit: ServingUnit): string {
  if (amount <= 0) return unit === 'unit' ? '1' : '100';
  if (unit === 'unit') return String(Math.round(amount));
  const rounded = Math.round(amount * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}
