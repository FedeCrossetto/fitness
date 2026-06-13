import { useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, darkColors, lightColors } from './colors';
import { applyBranding } from './applyBranding';
import { useBrandingStore } from '../stores/brandingStore';

export type ThemeMode = 'dark' | 'light' | 'system';

interface ThemeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: 'dark',
      setMode: (mode) => set({ mode }),
    }),
    {
      name: 'habito-theme',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

export interface Theme {
  colors: Colors;
  isDark: boolean;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

export function useTheme(): Theme {
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);
  const branding = useBrandingStore((s) => s.branding);
  const systemScheme = useColorScheme();
  const isDark = mode === 'system' ? systemScheme !== 'light' : mode === 'dark';
  return useMemo(
    () => ({ colors: applyBranding(isDark ? darkColors : lightColors, branding), isDark, mode, setMode }),
    [isDark, mode, setMode, branding],
  );
}

/**
 * Memoiza estilos derivados del tema. La factory debe ser una constante
 * de módulo para que el memo sea efectivo:
 *
 *   const createStyles = (colors: Colors) => StyleSheet.create({ ... });
 *   const styles = useThemedStyles(createStyles);
 */
export function useThemedStyles<T>(factory: (colors: Colors) => T): T {
  const { colors } = useTheme();
  return useMemo(() => factory(colors), [factory, colors]);
}
