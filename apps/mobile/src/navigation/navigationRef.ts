import { createNavigationContainerRef } from '@react-navigation/native';

/** Ref global del NavigationContainer para navegar desde afuera de React (push taps). */
export const navigationRef = createNavigationContainerRef();

/** Abre el chat del coach. Reintenta si el navegador aún no está listo (cold start). */
export function navigateToCoachChat(attempt = 0): void {
  if (navigationRef.isReady()) {
    (navigationRef.navigate as (name: string, params?: object) => void)('HomeTab', { screen: 'CoachChat' });
  } else if (attempt < 10) {
    setTimeout(() => navigateToCoachChat(attempt + 1), 300);
  }
}
