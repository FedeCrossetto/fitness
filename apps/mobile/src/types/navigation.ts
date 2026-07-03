import type { NavigatorScreenParams } from '@react-navigation/native';
import type { MealType, PhotoPosition } from './database';

export type AuthStackParamList = {
  EasyLogin: undefined;
  Login: { code?: string; prefillEmail?: string; prefillError?: string } | undefined;
  SignUp: { code?: string } | undefined;
  VerifyEmail: { email: string; password?: string };
  ForgotPassword: undefined;
  PasswordResetSent: { email: string };
  Onboarding: undefined;
};

export type HomeStackParamList = {
  HomeMain: undefined;
  Goals: undefined;
  Profile: { section?: 'health' } | undefined;
  Community: undefined;
  Messages: { focus?: 'groups' } | undefined;
  CommunityChat: { communityId: string; communityName?: string; communityAvatarUrl?: string | null };
  Subscription: undefined;
  MentoriaUpgrade: undefined;
  CoachChat: undefined;
  Achievements: undefined;
  Hydration: undefined;
  TrainerPanel: undefined;
  LegalPermissions: undefined;
  ImageConsentSettings: undefined;
};

/** Cliente nuevo que eligió Mentoría 1-1 y todavía no fue activado por el
 * entrenador — ver RootNavigator/services/evaluationGate.ts. */
export type MentoriaWaitStackParamList = {
  Waiting: undefined;
  Profile: undefined;
};

export type TrainingStackParamList = {
  Program: undefined;
  WorkoutDetail: { workoutId: string; dayTitle?: string };
  LiveSession: { workoutId: string; workoutTitle: string };
  SessionSummary: { logId: string; celebrate?: boolean };
  CardioLog: { activity?: string; durationMin?: number } | undefined;
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
  ProgressPhotoCompare: { position?: PhotoPosition };
  Measurements: undefined;
  Hydration: undefined;
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
