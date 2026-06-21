import React, { useEffect, useMemo } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DarkTheme, DefaultTheme, type Theme } from '@react-navigation/native';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { StyleSheet } from 'react-native';
import { useTheme } from './src/theme';
import { RootNavigator } from './src/navigation/RootNavigator';
import { navigationRef, navigateToCoachChat } from './src/navigation/navigationRef';
import { listenToMessageTaps } from './src/services/notifications';
import { AuthLoadingOverlay, ToastHost } from './src/components/common';
import { useAuthStore } from './src/stores/authStore';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function App(): React.JSX.Element {
  const { colors, isDark } = useTheme();
  const authReady = useAuthStore((s) => !s.initializing);

  // Tap en una notificación de mensaje → abre el chat del coach.
  useEffect(() => listenToMessageTaps(() => navigateToCoachChat()), []);

  useEffect(() => {
    void useAuthStore.getState().checkSession();
  }, []);

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const navigationTheme: Theme = useMemo(() => {
    const base = isDark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        background: colors.background,
        card: colors.surface.base,
        primary: colors.primary.default,
        text: colors.text.primary,
        border: colors.border.default,
      },
    };
  }, [colors, isDark]);

  useEffect(() => {
    if (fontsLoaded && authReady) {
      void SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [fontsLoaded, authReady]);

  if (!fontsLoaded || !authReady) {
    return <AuthLoadingOverlay />;
  }

  return (
    <GestureHandlerRootView style={[styles.root, { backgroundColor: colors.background }]}>
      <SafeAreaProvider>
        <NavigationContainer ref={navigationRef} theme={navigationTheme}>
          <StatusBar style={isDark ? 'light' : 'dark'} />
          <RootNavigator />
          <ToastHost />
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
