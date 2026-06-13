import React, { useMemo } from 'react';
import { StatusBar } from 'expo-status-bar';
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
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useTheme } from './src/theme';
import { RootNavigator } from './src/navigation/RootNavigator';
import { ToastHost } from './src/components/common';

export default function App(): React.JSX.Element {
  const { colors, isDark } = useTheme();

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

  if (!fontsLoaded) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary.default} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={[styles.root, { backgroundColor: colors.background }]}>
      <SafeAreaProvider>
        <NavigationContainer theme={navigationTheme}>
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
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
