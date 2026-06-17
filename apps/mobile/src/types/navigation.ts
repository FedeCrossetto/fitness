import type { NavigatorScreenParams } from '@react-navigation/native';
import type { MealType, PhotoPosition } from './database';

export type AuthStackParamList = {
  Login: { code?: string } | undefined;
  SignUp: { code?: string } | undefined;
  Onboarding: undefined;
};

export type HomeStackParamList = {
  HomeMain: undefined;
  Goals: undefined;
  Profile: undefined;
  Community: undefined;
  Subscription: undefined;
  CoachChat: undefined;
  Achievements: undefined;
  Hydration: undefined;
  TrainerPanel: undefined;
};

export type TrainingStackParamList = {
  Program: undefined;
  WorkoutDetail: { workoutId: string; dayTitle?: string };
  LiveSession: { workoutId: string; workoutTitle: string };
  SessionSummary: { logId: string };
  CardioLog: undefined;
};

export type NutritionStackParamList = {
  MealsDay: undefined;
  FoodDetail: {
    mealType: MealType;
    foodId?: string;
    barcode?: string;
    mealLogId?: string;
  };
  BarcodeScanner: { mealType: MealType };
  VoiceLog: { mealType: MealType };
};

export type ProgressStackParamList = {
  Dashboard: undefined;
  WeightDetail: undefined;
  ProgressPhotos: undefined;
  Measurements: undefined;
  HydrationDetail: undefined;
};

export type MainTabsParamList = {
  HomeTab: NavigatorScreenParams<HomeStackParamList>;
  TrainingTab: NavigatorScreenParams<TrainingStackParamList>;
  AddTab: undefined;
  NutritionTab: NavigatorScreenParams<NutritionStackParamList>;
  ProgressTab: NavigatorScreenParams<ProgressStackParamList>;
};

export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<MainTabsParamList>;
};

export type AddMenuAction = 'meal' | 'water' | 'weight' | 'photo' | 'workout';

export type ProgressPhotoParams = { position: PhotoPosition };
