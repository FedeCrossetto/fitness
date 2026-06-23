/** Catálogo de iconos de alimentos (keys compartidas web + app). */

import catalog from './foodIconCatalog.json';

export type FoodIconCatalogEntry = (typeof catalog)[number];
export type FoodIconKey = FoodIconCatalogEntry['key'];

export const FOOD_ICON_CATALOG = catalog as readonly FoodIconCatalogEntry[];

export const FOOD_ICON_ITEMS = FOOD_ICON_CATALOG.map(({ key, label }) => ({ key, label })) as ReadonlyArray<{
  key: FoodIconKey;
  label: string;
}>;

export const DEFAULT_FOOD_ICON_KEY: FoodIconKey = 'fruit';

/** Nombre de archivo PNG en packages/shared/assets/food-icons. */
export const FOOD_ICON_FILENAMES = Object.fromEntries(
  FOOD_ICON_CATALOG.map(({ key, file }) => [key, file]),
) as Record<FoodIconKey, string>;

const FOOD_ICON_KEY_SET = new Set<string>(FOOD_ICON_CATALOG.map((item) => item.key));

export function isFoodIconKey(value: string | null | undefined): value is FoodIconKey {
  return value != null && FOOD_ICON_KEY_SET.has(value);
}

export function foodIconFilename(iconKey: string | null | undefined): string {
  if (isFoodIconKey(iconKey)) return FOOD_ICON_FILENAMES[iconKey];
  return FOOD_ICON_FILENAMES[DEFAULT_FOOD_ICON_KEY];
}

export function foodIconPublicUrl(iconKey: string | null | undefined, basePath = '/food-icons'): string {
  /** @deprecated Preferí getFoodIconUrl desde @reset-fitness/shared/nutrition/foodIconAssets */
  return `${basePath}/${foodIconFilename(iconKey)}`;
}

export function foodIconLabel(iconKey: string | null | undefined): string {
  const item = FOOD_ICON_CATALOG.find((entry) => entry.key === iconKey);
  return item?.label ?? FOOD_ICON_CATALOG.find((entry) => entry.key === DEFAULT_FOOD_ICON_KEY)!.label;
}
