import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

type NavFn = (name: string, params?: object) => void;

function retryNavigate(fn: () => void, attempt = 0): void {
  if (navigationRef.isReady()) {
    fn();
  } else if (attempt < 10) {
    setTimeout(() => retryNavigate(fn, attempt + 1), 300);
  }
}

export function navigateToCoachChat(): void {
  retryNavigate(() =>
    (navigationRef.navigate as NavFn)('HomeTab', { screen: 'CoachChat' }),
  );
}

export function navigateToTraining(): void {
  retryNavigate(() =>
    (navigationRef.navigate as NavFn)('TrainingTab', { screen: 'Program' }),
  );
}

export function navigateToSubscription(): void {
  retryNavigate(() =>
    (navigationRef.navigate as NavFn)('HomeTab', { screen: 'Subscription' }),
  );
}

export function navigateToAchievements(): void {
  retryNavigate(() =>
    (navigationRef.navigate as NavFn)('HomeTab', { screen: 'Achievements' }),
  );
}

export function navigateToProgress(): void {
  retryNavigate(() =>
    (navigationRef.navigate as NavFn)('ProgressTab', { screen: 'Dashboard' }),
  );
}
