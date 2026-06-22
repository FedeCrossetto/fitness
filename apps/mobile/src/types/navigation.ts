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
  Profile: { section?: 'health' } | undefined;
  Community: undefined;
  Messages: undefined;
  CommunityChat: { communityId: string; communityName?: string; communityAvatarUrl?: string | null };
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
    trainerFoodId?: string;
    barcode?: string;
    mealLogId?: string;
    /** create = nuevo alimento en Creados; edit = editar alimento creado */
    entryMode?: 'create' | 'edit';
    initialName?: string;
    voiceTranscript?: string;
    scanPurpose?: 'create' | 'add';
  };
  BarcodeScanner: { mealType: MealType; purpose?: 'create' | 'add' };
  VoiceLog: { mealType: MealType; purpose?: 'create' | 'add' };
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
