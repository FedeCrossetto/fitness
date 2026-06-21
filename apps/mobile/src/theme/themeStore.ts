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
  hydrated: boolean;
  setMode: (mode: ThemeMode) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: 'dark',
      hydrated: false,
      setMode: (mode) => set({ mode }),
    }),
    {
      name: 'reset-fitness-theme',
      storage: createJSONStorage(() => AsyncStorage),
      // No persistimos `hydrated`: es estado en memoria.
      partialize: (s) => ({ mode: s.mode }),
      // Se dispara cuando termina de leer AsyncStorage → recién ahí sabemos
      // el tema real del usuario y evitamos el flash de color del loader.
      onRehydrateStorage: () => () => {
        useThemeStore.setState({ hydrated: true });
      },
    },
  ),
);

/** True cuando el tema persistido ya se leyó de AsyncStorage. */
export function useThemeHydrated(): boolean {
  return useThemeStore((s) => s.hydrated);
}

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
