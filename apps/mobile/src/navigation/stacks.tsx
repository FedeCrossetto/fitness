import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import type {
  AuthStackParamList,
  HomeStackParamList,
  MentoriaWaitStackParamList,
  NutritionStackParamList,
  ProgressStackParamList,
  TrainingStackParamList,
} from '../types/navigation';
import { authColors } from '../screens/auth/authScreenTheme';
import { useTheme } from '../theme';
import { ErrorBoundary } from '../components/common';

import { LoginScreen } from '../screens/auth/LoginScreen';
import { SignUpScreen } from '../screens/auth/SignUpScreen';
import { VerifyEmailScreen } from '../screens/auth/VerifyEmailScreen';
import { ForgotPasswordScreen } from '../screens/auth/ForgotPasswordScreen';
import { PasswordResetSentScreen } from '../screens/auth/PasswordResetSentScreen';
import { EasyLoginScreen } from '../screens/auth/EasyLoginScreen';

import { HomeScreen } from '../screens/home/HomeScreen';
import { GoalsScreen } from '../screens/goals/GoalsScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { CommunityScreen } from '../screens/community/CommunityScreen';
import { CommunityChatScreen } from '../screens/community/CommunityChatScreen';
import { MessagesScreen } from '../screens/messages/MessagesScreen';
import { SubscriptionScreen } from '../screens/subscription/SubscriptionScreen';
import { MentoriaUpgradeScreen } from '../screens/subscription/MentoriaUpgradeScreen';
import { MentoriaWaitingScreen } from '../screens/evaluation/MentoriaWaitingScreen';
import { MentoriaWaitProfileScreen } from '../screens/evaluation/MentoriaWaitProfileScreen';
import { CoachChatScreen } from '../screens/coach/CoachChatScreen';
import { AchievementsScreen } from '../screens/achievements/AchievementsScreen';
import { HydrationScreen } from '../screens/progress/HydrationScreen';
import { TrainerPanelScreen } from '../screens/trainer/TrainerPanelScreen';
import { LegalPermissionsScreen } from '../screens/profile/LegalPermissionsScreen';
import { ImageConsentSettingsScreen } from '../screens/profile/ImageConsentSettingsScreen';

import { ProgramScreen } from '../screens/training/ProgramScreen';
import { WorkoutDetailScreen } from '../screens/training/WorkoutDetailScreen';
import { LiveSessionScreen } from '../screens/training/LiveSessionScreen';
import { IntervalSessionScreen } from '../screens/training/IntervalSessionScreen';
import { SessionSummaryScreen } from '../screens/training/SessionSummaryScreen';
import { CardioLogScreen } from '../screens/training/CardioLogScreen';

import { MealsDayScreen } from '../screens/nutrition/MealsDayScreen';
import { FoodDetailScreen } from '../screens/nutrition/FoodDetailScreen';
import { BarcodeScannerScreen } from '../screens/nutrition/BarcodeScannerScreen';
import { VoiceLogScreen } from '../screens/nutrition/VoiceLogScreen';

import { ProgressDashboardScreen } from '../screens/progress/ProgressDashboardScreen';
import { WeightDetailScreen } from '../screens/progress/WeightDetailScreen';
import { ProgressPhotosScreen } from '../screens/progress/ProgressPhotosScreen';
import { ProgressPhotoCompareScreen } from '../screens/progress/ProgressPhotoCompareScreen';
import { MeasurementsScreen } from '../screens/progress/MeasurementsScreen';

function useStackOptions(): NativeStackNavigationOptions {
  const { colors } = useTheme();
  return {
    headerShown: false,
    gestureEnabled: true,
    contentStyle: { backgroundColor: colors.background },
  };
}

const Auth = createNativeStackNavigator<AuthStackParamList>();
export function AuthStack({ hasStoredProfile = false }: { hasStoredProfile?: boolean }): React.JSX.Element {
  return (
    <Auth.Navigator
      initialRouteName={hasStoredProfile ? 'EasyLogin' : 'Login'}
      screenOptions={{
        headerShown: false,
        gestureEnabled: true,
        contentStyle: { backgroundColor: authColors.background },
      }}
    >
      <Auth.Screen name="EasyLogin" component={EasyLoginScreen} />
      <Auth.Screen name="Login" component={LoginScreen} />
      <Auth.Screen name="SignUp" component={SignUpScreen} />
      <Auth.Screen name="VerifyEmail" component={VerifyEmailScreen} />
      <Auth.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Auth.Screen name="PasswordResetSent" component={PasswordResetSentScreen} />
    </Auth.Navigator>
  );
}

const Home = createNativeStackNavigator<HomeStackParamList>();
export function HomeStack(): React.JSX.Element {
  const defaultOptions = useStackOptions();
  return (
    <ErrorBoundary>
    <Home.Navigator screenOptions={defaultOptions}>
      <Home.Screen name="HomeMain" component={HomeScreen} />
      <Home.Screen name="Goals" component={GoalsScreen} />
      <Home.Screen name="Profile" component={ProfileScreen} />
      <Home.Screen name="Community" component={CommunityScreen} />
      <Home.Screen name="Messages" component={MessagesScreen} />
      <Home.Screen name="CommunityChat" component={CommunityChatScreen} />
      <Home.Screen name="Subscription" component={SubscriptionScreen} options={{ gestureEnabled: false }} />
      <Home.Screen name="MentoriaUpgrade" component={MentoriaUpgradeScreen} options={{ gestureEnabled: false }} />
      <Home.Screen name="CoachChat" component={CoachChatScreen} />
      <Home.Screen name="Achievements" component={AchievementsScreen} />
      <Home.Screen name="Hydration" component={HydrationScreen} />
      <Home.Screen name="TrainerPanel" component={TrainerPanelScreen} />
      <Home.Screen name="LegalPermissions" component={LegalPermissionsScreen} />
      <Home.Screen name="ImageConsentSettings" component={ImageConsentSettingsScreen} />
    </Home.Navigator>
    </ErrorBoundary>
  );
}

const Training = createNativeStackNavigator<TrainingStackParamList>();
export function TrainingStack(): React.JSX.Element {
  const defaultOptions = useStackOptions();
  return (
    <ErrorBoundary>
    <Training.Navigator screenOptions={defaultOptions}>
      <Training.Screen name="Program" component={ProgramScreen} />
      <Training.Screen name="WorkoutDetail" component={WorkoutDetailScreen} />
      <Training.Screen name="LiveSession" component={LiveSessionScreen} />
      <Training.Screen name="IntervalSession" component={IntervalSessionScreen} />
      <Training.Screen name="SessionSummary" component={SessionSummaryScreen} />
      <Training.Screen name="CardioLog" component={CardioLogScreen} />
    </Training.Navigator>
    </ErrorBoundary>
  );
}

const Nutrition = createNativeStackNavigator<NutritionStackParamList>();
export function NutritionStack(): React.JSX.Element {
  const defaultOptions = useStackOptions();
  return (
    <ErrorBoundary>
    <Nutrition.Navigator screenOptions={defaultOptions}>
      <Nutrition.Screen name="MealsDay" component={MealsDayScreen} />
      <Nutrition.Screen name="FoodDetail" component={FoodDetailScreen} options={{ presentation: 'modal' }} />
      <Nutrition.Screen name="BarcodeScanner" component={BarcodeScannerScreen} options={{ presentation: 'fullScreenModal' }} />
      <Nutrition.Screen name="VoiceLog" component={VoiceLogScreen} options={{ presentation: 'modal' }} />
    </Nutrition.Navigator>
    </ErrorBoundary>
  );
}

const Progress = createNativeStackNavigator<ProgressStackParamList>();
export function ProgressStack(): React.JSX.Element {
  const defaultOptions = useStackOptions();
  return (
    <ErrorBoundary>
    <Progress.Navigator screenOptions={defaultOptions}>
      <Progress.Screen name="Dashboard" component={ProgressDashboardScreen} />
      <Progress.Screen name="WeightDetail" component={WeightDetailScreen} />
      <Progress.Screen name="ProgressPhotos" component={ProgressPhotosScreen} />
      <Progress.Screen name="ProgressPhotoCompare" component={ProgressPhotoCompareScreen} />
      <Progress.Screen name="Measurements" component={MeasurementsScreen} />
      <Progress.Screen name="Hydration" component={HydrationScreen} />
    </Progress.Navigator>
    </ErrorBoundary>
  );
}

const MentoriaWait = createNativeStackNavigator<MentoriaWaitStackParamList>();
export function MentoriaWaitStack(): React.JSX.Element {
  const defaultOptions = useStackOptions();
  return (
    <ErrorBoundary>
    <MentoriaWait.Navigator screenOptions={defaultOptions}>
      <MentoriaWait.Screen name="Waiting" component={MentoriaWaitingScreen} />
      <MentoriaWait.Screen name="Profile" component={MentoriaWaitProfileScreen} />
    </MentoriaWait.Navigator>
    </ErrorBoundary>
  );
}
