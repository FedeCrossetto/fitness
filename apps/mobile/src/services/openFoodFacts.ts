/**
 * Integración con Open Food Facts (https://openfoodfacts.org).
 * Datos bajo licencia ODbL — la UI que muestre estos datos debe atribuir "Open Food Facts".
 */

export interface OffProduct {
  code: string;
  productName: string;
  brands: string | null;
  imageUrl: string | null;
  /** Valores por 100 g */
  kcal100g: number | null;
  protein100g: number | null;
  carbs100g: number | null;
  fat100g: number | null;
  servingGrams: number | null;
}

interface OffApiResponse {
  status: number;
  product?: {
    code?: string;
    product_name?: string;
    product_name_es?: string;
    brands?: string;
    image_front_url?: string;
    serving_quantity?: number | string;
    nutriments?: Record<string, number | string | undefined>;
  };
}

const BASE_URL = 'https://world.openfoodfacts.org/api/v2/product';

function num(value: number | string | undefined): number | null {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function fetchProductByBarcode(barcode: string): Promise<OffProduct | null> {
  const response = await fetch(
    `${BASE_URL}/${encodeURIComponent(barcode)}?fields=code,product_name,product_name_es,brands,image_front_url,serving_quantity,nutriments`,
    { headers: { 'User-Agent': 'Habito/1.0 (fitness app)' } }
  );
  if (!response.ok) {
    throw new Error(`Open Food Facts respondió ${response.status}`);
  }
  const data = (await response.json()) as OffApiResponse;
  if (data.status !== 1 || !data.product) return null;

  const p = data.product;
  const n = p.nutriments ?? {};
  const kcal = num(n['energy-kcal_100g']) ?? (num(n['energy_100g']) !== null ? Math.round((num(n['energy_100g']) as number) / 4.184) : null);

  return {
    code: p.code ?? barcode,
    productName: p.product_name_es || p.product_name || 'Producto sin nombre',
    brands: p.brands ?? null,
    imageUrl: p.image_front_url ?? null,
    kcal100g: kcal,
    protein100g: num(n['proteins_100g']),
    carbs100g: num(n['carbohydrates_100g']),
    fat100g: num(n['fat_100g']),
    servingGrams: num(p.serving_quantity),
  };
}

/** Recalcula macros totales para una porción dada (los valores base son por 100 g). */
export function macrosForPortion(
  per100: { kcal: number | null; protein: number | null; carbs: number | null; fat: number | null },
  portionGrams: number
): { kcal: number; protein: number; carbs: number; fat: number } {
  const factor = portionGrams / 100;
  const scale = (v: number | null) => (v === null ? 0 : Math.round(v * factor * 10) / 10);
  return {
    kcal: Math.round((per100.kcal ?? 0) * factor),
    protein: scale(per100.protein),
    carbs: scale(per100.carbs),
    fat: scale(per100.fat),
  };
}
