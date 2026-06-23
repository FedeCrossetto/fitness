import { DEFAULT_FOOD_ICON_KEY, isFoodIconKey, type FoodIconKey } from './foodIcons';

/** PNG embebidos desde packages/shared/assets/food-icons (Metro require estático). */
const FOOD_ICON_SOURCES: Record<FoodIconKey, number> = {
  avocado: require('../../assets/food-icons/avocado-icon.png'),
  banana: require('../../assets/food-icons/banana-icon.png'),
  bread: require('../../assets/food-icons/bread-icon.png'),
  cake: require('../../assets/food-icons/cake-icon.png'),
  cheese: require('../../assets/food-icons/cheese-icon.png'),
  chicken: require('../../assets/food-icons/chicken-icon.png'),
  chocolate: require('../../assets/food-icons/chocolate-icon.png'),
  coffee: require('../../assets/food-icons/coffe-icon.png'),
  cookie: require('../../assets/food-icons/cookie-icon.png'),
  'dulce-de-leche': require('../../assets/food-icons/ddl-icon.png'),
  dressing: require('../../assets/food-icons/dressing-icon.png'),
  egg: require('../../assets/food-icons/egg-icon.png'),
  fish: require('../../assets/food-icons/fish-icon.png'),
  fruit: require('../../assets/food-icons/fruit-generic.png'),
  hamburger: require('../../assets/food-icons/hamburger-icon.png'),
  meat: require('../../assets/food-icons/meat-icon.png'),
  milanesa: require('../../assets/food-icons/mila-icon.png'),
  milk: require('../../assets/food-icons/milk-icon.png'),
  oil: require('../../assets/food-icons/oil-icon.png'),
  omelette: require('../../assets/food-icons/omelette-icon.png'),
  pasta: require('../../assets/food-icons/paste-icon.png'),
  pizza: require('../../assets/food-icons/pizza-icon.png'),
  potato: require('../../assets/food-icons/potato-icon.png'),
  protein: require('../../assets/food-icons/protein-icon.png'),
  rice: require('../../assets/food-icons/rice-icon.png'),
  salad: require('../../assets/food-icons/salad-icon.png'),
  soda: require('../../assets/food-icons/soda-icon.png'),
  sugar: require('../../assets/food-icons/sugar-icon.png'),
  taco: require('../../assets/food-icons/wad-icon.png'),
  toast: require('../../assets/food-icons/toasted-icon.png'),
  vegetable: require('../../assets/food-icons/vegetable-icon.png'),
  walnuts: require('../../assets/food-icons/walnuts-icon.png'),
  water: require('../../assets/food-icons/water-icon.png'),
  wheat: require('../../assets/food-icons/wheat-icon.png'),
};

export function getFoodIconSource(iconKey: string | null | undefined): number {
  if (isFoodIconKey(iconKey)) return FOOD_ICON_SOURCES[iconKey];
  return FOOD_ICON_SOURCES[DEFAULT_FOOD_ICON_KEY];
}

export function getFoodIconUrl(iconKey: string | null | undefined): string {
  const source = getFoodIconSource(iconKey);
  return typeof source === 'string' ? source : String(source);
}
