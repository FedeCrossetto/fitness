/** Catálogo de iconos de alimentos (keys compartidas web + app). */

export const FOOD_ICON_ITEMS = [
  { key: 'fruit', label: 'Fruta' },
  { key: 'avocado', label: 'Palta' },
  { key: 'banana', label: 'Banana' },
  { key: 'bread', label: 'Pan' },
  { key: 'cake', label: 'Pastel' },
  { key: 'cheese', label: 'Queso' },
  { key: 'chicken', label: 'Pollo' },
  { key: 'chocolate', label: 'Chocolate' },
  { key: 'coffee', label: 'Café' },
  { key: 'dulce-de-leche', label: 'Dulce de leche' },
  { key: 'dressing', label: 'Aderezo' },
  { key: 'egg', label: 'Huevo' },
  { key: 'fish', label: 'Pescado' },
  { key: 'meat', label: 'Carne' },
  { key: 'milanesa', label: 'Milanesa' },
  { key: 'milk', label: 'Leche' },
  { key: 'oil', label: 'Aceite' },
  { key: 'pasta', label: 'Pasta' },
  { key: 'potato', label: 'Papa' },
  { key: 'rice', label: 'Arroz' },
  { key: 'salad', label: 'Ensalada' },
  { key: 'soda', label: 'Gaseosa' },
  { key: 'vegetable', label: 'Verdura' },
  { key: 'walnuts', label: 'Frutos secos' },
  { key: 'water', label: 'Agua' },
  { key: 'wheat', label: 'Cereal' },
] as const;

export type FoodIconKey = (typeof FOOD_ICON_ITEMS)[number]['key'];

export const DEFAULT_FOOD_ICON_KEY: FoodIconKey = 'fruit';

/** Nombre de archivo PNG en packages/shared/assets/food-icons. */
export const FOOD_ICON_FILENAMES: Record<FoodIconKey, string> = {
  avocado: 'avocado-icon.png',
  banana: 'banana-icon.png',
  bread: 'bread-icon.png',
  cake: 'cake-icon.png',
  cheese: 'cheese-icon.png',
  chicken: 'chicken-icon.png',
  chocolate: 'chocolate-icon.png',
  coffee: 'coffe-icon.png',
  'dulce-de-leche': 'ddl-icon.png',
  dressing: 'dressing-icon.png',
  egg: 'egg-icon.png',
  fish: 'fish-icon.png',
  fruit: 'fruit-generic.png',
  meat: 'meat-icon.png',
  milanesa: 'mila-icon.png',
  milk: 'milk-icon.png',
  oil: 'oil-icon.png',
  pasta: 'paste-icon.png',
  potato: 'potato-icon.png',
  rice: 'rice-icon.png',
  salad: 'salad-icon.png',
  soda: 'soda-icon.png',
  vegetable: 'vegetable-icon.png',
  walnuts: 'walnuts-icon.png',
  water: 'water-icon.png',
  wheat: 'wheat-icon.png',
};

const FOOD_ICON_KEY_SET = new Set<string>(FOOD_ICON_ITEMS.map((item) => item.key));

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
  const item = FOOD_ICON_ITEMS.find((entry) => entry.key === iconKey);
  return item?.label ?? FOOD_ICON_ITEMS.find((entry) => entry.key === DEFAULT_FOOD_ICON_KEY)!.label;
}
