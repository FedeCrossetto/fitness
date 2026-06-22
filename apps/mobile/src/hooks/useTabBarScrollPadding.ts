import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { layout, spacing } from '../theme';

/** Altura total de la tab bar flotante (fila + safe area inferior). */
export function useTabBarInset(): number {
  const insets = useSafeAreaInsets();
  return layout.tabBarHeight + Math.max(insets.bottom, spacing.xs);
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
