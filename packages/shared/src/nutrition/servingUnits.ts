export type ServingUnit = 'g' | 'ml' | 'unit';

export const SERVING_UNITS = [
  { value: 'g' as const, label: 'Gramos', short: 'g' },
  { value: 'ml' as const, label: 'Mililitros', short: 'ml' },
  { value: 'unit' as const, label: 'Unidades', short: 'ud.' },
];

export const DEFAULT_SERVING_UNIT: ServingUnit = 'g';

export function isServingUnit(value: string | null | undefined): value is ServingUnit {
  return value === 'g' || value === 'ml' || value === 'unit';
}

export function servingUnitShort(unit: ServingUnit | null | undefined): string {
  return SERVING_UNITS.find((item) => item.value === (unit ?? DEFAULT_SERVING_UNIT))?.short ?? 'g';
}

export function formatServingLabel(
  amount: number | null,
  unit: ServingUnit | null | undefined,
): string {
  if (amount == null || amount <= 0) return '—';
  const resolved = unit ?? DEFAULT_SERVING_UNIT;
  const rounded = Math.round(amount);
  if (resolved === 'unit') {
    return rounded === 1 ? '1 ud.' : `${rounded} ud.`;
  }
  return `${rounded} ${servingUnitShort(resolved)}`;
}

export const QUICK_PORTIONS_BY_UNIT: Record<ServingUnit, number[]> = {
  g: [50, 100, 150, 200],
  ml: [100, 200, 250, 500],
  unit: [1, 2, 3, 4],
};

export function quickPortionLabel(value: number, unit: ServingUnit): string {
  if (unit === 'unit') return String(value);
  return `${value}${servingUnitShort(unit)}`;
}
