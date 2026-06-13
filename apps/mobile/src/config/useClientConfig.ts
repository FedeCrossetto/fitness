import { useMemo } from 'react';
import { defaultClientConfig, type ClientConfig } from './clientConfig';
import { useBrandingStore } from '../stores/brandingStore';

/**
 * Config del cliente resuelta en runtime: parte de los defaults estáticos y
 * aplica encima el branding del entrenador actual (nombre, copy, módulos,
 * programa). Los defaults numéricos (kcal, macros, hidratación) no se brandean.
 */
export function useClientConfig(): ClientConfig {
  const branding = useBrandingStore((s) => s.branding);
  return useMemo(() => {
    if (!branding) return defaultClientConfig;
    return {
      ...defaultClientConfig,
      appName: branding.app_name || defaultClientConfig.appName,
      programKey: branding.default_program_key || defaultClientConfig.programKey,
      modules: { ...defaultClientConfig.modules, ...branding.modules },
      copy: {
        welcomeTitle: branding.welcome_title ?? defaultClientConfig.copy.welcomeTitle,
        welcomeSubtitle: branding.welcome_subtitle ?? defaultClientConfig.copy.welcomeSubtitle,
        onboardingCta: branding.onboarding_cta ?? defaultClientConfig.copy.onboardingCta,
      },
    };
  }, [branding]);
}
