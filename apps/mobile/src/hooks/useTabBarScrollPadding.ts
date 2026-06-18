import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { layout, spacing } from '../theme';

/** Espacio inferior para ScrollView en pantallas con tab bar flotante + home indicator. */
export function useTabBarScrollPadding(extra = spacing.xxl): number {
  const insets = useSafeAreaInsets();
  return layout.tabBarHeight + Math.max(insets.bottom, spacing.xs) + extra;
}
