import { useMemo } from 'react';
import { defaultClientConfig, type ClientConfig } from './clientConfig';
import { useAuthStore } from '../stores/authStore';
import { useBrandingStore } from '../stores/brandingStore';

/**
 * Config del cliente resuelta en runtime: parte de los defaults estáticos y
 * aplica encima el branding del entrenador actual (nombre, copy, módulos,
 * programa). Los defaults numéricos (kcal, macros, hidratación) no se brandean.
 */
export function useClientConfig(): ClientConfig {
  const branding = useBrandingStore((s) => s.branding);
  const assignedProgramKey = useAuthStore((s) => s.profile?.assigned_program_key);
  return useMemo(() => {
    const brandingProgramKey = branding?.default_program_key || defaultClientConfig.programKey;
    const programKey = assignedProgramKey || brandingProgramKey;
    if (!branding) {
      return { ...defaultClientConfig, programKey };
    }
    return {
      ...defaultClientConfig,
      appName: branding.app_name || defaultClientConfig.appName,
      programKey,
      modules: { ...defaultClientConfig.modules, ...branding.modules },
      copy: {
        welcomeTitle: branding.welcome_title ?? defaultClientConfig.copy.welcomeTitle,
        welcomeSubtitle: branding.welcome_subtitle ?? defaultClientConfig.copy.welcomeSubtitle,
        onboardingCta: branding.onboarding_cta ?? defaultClientConfig.copy.onboardingCta,
      },
    };
  }, [branding, assignedProgramKey]);
}
