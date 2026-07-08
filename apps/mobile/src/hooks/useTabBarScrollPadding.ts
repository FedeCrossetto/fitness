import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { layout, spacing } from '../theme';

/** Distancia de la tab bar flotante al borde inferior (debe coincidir con TabBar.tsx). */
export function tabBarBottomOffset(insetBottom: number): number {
  return Math.max(insetBottom - spacing.sm, spacing.sm);
}

/** Altura total ocupada por la tab bar flotante desde el borde inferior (offset + alto). */
export function useTabBarInset(): number {
  const insets = useSafeAreaInsets();
  return layout.tabBarHeight + tabBarBottomOffset(insets.bottom);
}

/** Espacio inferior para ScrollView en pantallas con tab bar flotante + home indicator. */
export function useTabBarScrollPadding(extra: number = spacing.xxl): number {
  return useTabBarInset() + extra;
}

/** Offset para footers fijos (botón sobre la tab bar). */
export function useTabBarFooterBottom(gap: number = spacing.sm): number {
  return useTabBarInset() + gap;
}

/** Padding de scroll cuando hay un botón fijo encima de la tab bar. */
export function useTabBarFooterScrollPadding(
  buttonHeight: number = layout.minHitTarget,
  gap: number = spacing.lg,
): number {
  return useTabBarInset() + buttonHeight + gap;
}
