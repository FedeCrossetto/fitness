import { useTrainerBranding } from '@/hooks/useTrainerBranding';

export function useAppBrandName(): string {
  return useTrainerBranding().appName;
}
