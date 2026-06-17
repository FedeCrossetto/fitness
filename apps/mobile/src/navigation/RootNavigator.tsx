import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
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
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulse = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.delay(600),
        ])
      );
    const a1 = pulse(dot1, 0);
    const a2 = pulse(dot2, 200);
    const a3 = pulse(dot3, 400);
    a1.start(); a2.start(); a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, [dot1, dot2, dot3]);

  return (
    <View style={[styles.splash, { backgroundColor: colors.background }]}>
      <Image source={illustrations.login} style={styles.mascot} contentFit="contain" priority="high" />
      <AppText variant="h2" color={colors.text.primary} style={styles.brand}>
        {clientConfig.appName}
      </AppText>
      <View style={styles.loadingRow}>
        <AppText variant="body14" color={colors.text.tertiary}>
          Cargando
        </AppText>
        {([dot1, dot2, dot3] as Animated.Value[]).map((dot, i) => (
          <Animated.Text
            key={i}
            style={[styles.dot, { color: colors.primary.default, opacity: dot }]}
          >
            .
          </Animated.Text>
        ))}
      </View>
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
  mascot: { width: 220, height: 290 },
  brand: { marginTop: spacing.lg },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: spacing.xl,
    gap: 2,
  },
  dot: { fontSize: 22, lineHeight: 22, fontWeight: '700' },
});
