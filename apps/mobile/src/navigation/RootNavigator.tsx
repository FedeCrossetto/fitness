import React, { useEffect } from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { illustrations, spacing, useTheme } from '../theme';
import { useAuthStore } from '../stores/authStore';
import { useTrainingStore } from '../stores/trainingStore';
import { AppText } from '../components/common';
import { useClientConfig } from '../config/useClientConfig';
import type { MainTabsParamList } from '../types/navigation';
import { TabBar } from './TabBar';
import { AddMenuOverlay } from './AddMenuOverlay';
import { AuthStack, HomeStack, NutritionStack, ProgressStack, TrainingStack } from './stacks';
import { OnboardingScreen } from '../screens/auth/OnboardingScreen';

const Tabs = createBottomTabNavigator<MainTabsParamList>();

function Placeholder(): null {
  return null;
}

function MainTabs(): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <>
      <Tabs.Navigator
        screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.background } }}
        tabBar={(props) => <TabBar {...props} />}
      >
        <Tabs.Screen name="HomeTab" component={HomeStack} />
        <Tabs.Screen name="TrainingTab" component={TrainingStack} />
        <Tabs.Screen name="AddTab" component={Placeholder} />
        <Tabs.Screen name="NutritionTab" component={NutritionStack} />
        <Tabs.Screen name="ProgressTab" component={ProgressStack} />
      </Tabs.Navigator>
      <AddMenuOverlay />
    </>
  );
}

function SplashGate(): React.JSX.Element {
  const { colors } = useTheme();
  const clientConfig = useClientConfig();
  return (
    <View style={[styles.splash, { backgroundColor: colors.background }]}>
      <Image source={illustrations.hero} style={styles.mascot} contentFit="contain" priority="high" />
      <AppText variant="h2" color={colors.text.primary} style={styles.brand}>
        {clientConfig.appName}
      </AppText>
      <ActivityIndicator color={colors.primary.default} style={styles.loader} />
    </View>
  );
}

/** Decide entre Auth, Onboarding y App según la sesión de Supabase. */
export function RootNavigator(): React.JSX.Element {
  const initializing = useAuthStore((s) => s.initializing);
  const session = useAuthStore((s) => s.session);
  const needsOnboarding = useAuthStore((s) => s.needsOnboarding);
  const checkSession = useAuthStore((s) => s.checkSession);
  const restoreActiveSession = useTrainingStore((s) => s.restoreActiveSession);

  useEffect(() => {
    void checkSession();
    void restoreActiveSession();
  }, [checkSession, restoreActiveSession]);

  if (initializing) return <SplashGate />;
  if (!session) return <AuthStack />;
  if (needsOnboarding) return <OnboardingScreen />;
  return <MainTabs />;
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mascot: { width: 200, height: 260 },
  brand: { marginTop: spacing.lg },
  loader: { marginTop: spacing.xl },
});
