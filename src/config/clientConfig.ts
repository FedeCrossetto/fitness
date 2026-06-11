/**
 * Configuración white-label por cliente.
 * Todo branding, copy y módulos activos se resuelven acá: el core no se toca por cliente.
 */

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

export const clientConfig: ClientConfig = {
  appName: 'Habito',
  programKey: 'default',
  defaultLocale: 'es',
  defaultHydrationGoalMl: 3000,
  defaultKcalGoal: 2200,
  defaultMacroGoals: { protein: 160, carbs: 220, fat: 70 },
  defaultStepsGoal: 10000,
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
    welcomeTitle: 'Bienvenido a Habito',
    welcomeSubtitle: 'Entrená, comé mejor y medí tu progreso. Todo en un solo lugar.',
    onboardingCta: 'Empezar ahora',
  },
};
