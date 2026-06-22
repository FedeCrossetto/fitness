import type { OffProduct } from './openFoodFacts';

let cached: { barcode: string; product: OffProduct } | null = null;

export function setScanProductCache(barcode: string, product: OffProduct): void {
  cached = { barcode, product };
}

/** Usa el producto precargado por el escáner (una sola vez por barcode). */
export function consumeScanProductCache(barcode: string): OffProduct | null {
  if (!cached || cached.barcode !== barcode) return null;
  const product = cached.product;
  cached = null;
  return product;
}
