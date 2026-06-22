import { DEFAULT_FOOD_ICON_KEY, isFoodIconKey, type FoodIconKey } from './foodIcons';
import avocadoIcon from '../../assets/food-icons/avocado-icon.png';
import bananaIcon from '../../assets/food-icons/banana-icon.png';
import breadIcon from '../../assets/food-icons/bread-icon.png';
import cakeIcon from '../../assets/food-icons/cake-icon.png';
import cheeseIcon from '../../assets/food-icons/cheese-icon.png';
import chickenIcon from '../../assets/food-icons/chicken-icon.png';
import chocolateIcon from '../../assets/food-icons/chocolate-icon.png';
import coffeeIcon from '../../assets/food-icons/coffe-icon.png';
import ddlIcon from '../../assets/food-icons/ddl-icon.png';
import dressingIcon from '../../assets/food-icons/dressing-icon.png';
import eggIcon from '../../assets/food-icons/egg-icon.png';
import fishIcon from '../../assets/food-icons/fish-icon.png';
import fruitIcon from '../../assets/food-icons/fruit-generic.png';
import meatIcon from '../../assets/food-icons/meat-icon.png';
import milaIcon from '../../assets/food-icons/mila-icon.png';
import milkIcon from '../../assets/food-icons/milk-icon.png';
import oilIcon from '../../assets/food-icons/oil-icon.png';
import pastaIcon from '../../assets/food-icons/paste-icon.png';
import potatoIcon from '../../assets/food-icons/potato-icon.png';
import riceIcon from '../../assets/food-icons/rice-icon.png';
import saladIcon from '../../assets/food-icons/salad-icon.png';
import sodaIcon from '../../assets/food-icons/soda-icon.png';
import vegetableIcon from '../../assets/food-icons/vegetable-icon.png';
import walnutsIcon from '../../assets/food-icons/walnuts-icon.png';
import waterIcon from '../../assets/food-icons/water-icon.png';
import wheatIcon from '../../assets/food-icons/wheat-icon.png';

const FOOD_ICON_URLS: Record<FoodIconKey, string> = {
  avocado: avocadoIcon,
  banana: bananaIcon,
  bread: breadIcon,
  cake: cakeIcon,
  cheese: cheeseIcon,
  chicken: chickenIcon,
  chocolate: chocolateIcon,
  coffee: coffeeIcon,
  'dulce-de-leche': ddlIcon,
  dressing: dressingIcon,
  egg: eggIcon,
  fish: fishIcon,
  fruit: fruitIcon,
  meat: meatIcon,
  milanesa: milaIcon,
  milk: milkIcon,
  oil: oilIcon,
  pasta: pastaIcon,
  potato: potatoIcon,
  rice: riceIcon,
  salad: saladIcon,
  soda: sodaIcon,
  vegetable: vegetableIcon,
  walnuts: walnutsIcon,
  water: waterIcon,
  wheat: wheatIcon,
};

export function getFoodIconUrl(iconKey: string | null | undefined): string {
  if (isFoodIconKey(iconKey)) return FOOD_ICON_URLS[iconKey];
  return FOOD_ICON_URLS[DEFAULT_FOOD_ICON_KEY];
}

/** Alias para compatibilidad con componentes que usan ImageSource en web. */
export function getFoodIconSource(iconKey: string | null | undefined): string {
  return getFoodIconUrl(iconKey);
}
