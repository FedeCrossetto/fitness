/**
 * Configuración white-label por cliente.
 * Todo branding, copy y módulos activos se resuelven acá: el core no se toca por cliente.
 */

import {
  DEFAULT_APP_NAME,
  DEFAULT_HYDRATION_GOAL_ML,
  DEFAULT_KCAL_GOAL,
  DEFAULT_MACRO_GOALS,
  DEFAULT_STEPS_GOAL,
} from '@reset-fitness/shared';

export interface ClientModules {
  training: boolean;
  nutrition: boolean;
  progress: boolean;
  goals: boolean;
  community: boolean;
  subscriptions: boolean;
  coachChat: boolean;
  achievements: boolean;
  healthKit: boolean;
}

export interface ClientConfig {
  /** Nombre comercial de la app */
  appName: string;
  /** Clave de programa de entrenamiento (training_phases.program_key) */
  programKey: string;
  /** Locale por defecto */
  defaultLocale: string;
  /** Objetivo de hidratación por defecto (ml) */
  defaultHydrationGoalMl: number;
  /** Objetivo de kcal diarias por defecto */
  defaultKcalGoal: number;
  /** Macros objetivo por defecto (gramos) */
  defaultMacroGoals: { protein: number; carbs: number; fat: number };
  /** Objetivo de pasos diarios por defecto */
  defaultStepsGoal: number;
  /** Módulos activos para este cliente */
  modules: ClientModules;
  /** Copy configurable */
  copy: {
    welcomeTitle: string;
    welcomeSubtitle: string;
    onboardingCta: string;
  };
}

export const defaultClientConfig: ClientConfig = {
  appName: DEFAULT_APP_NAME,
  programKey: 'default',
  defaultLocale: 'es',
  defaultHydrationGoalMl: DEFAULT_HYDRATION_GOAL_ML,
  defaultKcalGoal: DEFAULT_KCAL_GOAL,
  defaultMacroGoals: { ...DEFAULT_MACRO_GOALS },
  defaultStepsGoal: DEFAULT_STEPS_GOAL,
  modules: {
    training: true,
    nutrition: true,
    progress: true,
    goals: true,
    community: true,
    subscriptions: true,
    coachChat: true,
    achievements: true,
    healthKit: true,
  },
  copy: {
    welcomeTitle: 'BIENVENIDO A RESET FIT',
    welcomeSubtitle: 'Entrená, comé mejor y medí tu progreso. Todo en un solo lugar.',
    onboardingCta: 'Empezar ahora',
  },
};

/**
 * Config estática por defecto. Sigue disponible para defaults no-branding
 * (kcal, macros, etc.). El branding por entrenador se resuelve en runtime con
 * `useClientConfig()`.
 */
export const clientConfig = defaultClientConfig;
