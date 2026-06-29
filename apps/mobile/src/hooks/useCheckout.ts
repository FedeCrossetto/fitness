import { useCallback, useRef, useState } from 'react';
import { Linking } from 'react-native';
import * as AuthSession from 'expo-auth-session';
import { createCheckout, fetchActiveSubscription, clearSubscriptionAccessCache, resolveSubscriptionAccess } from '../services/payments';
import { useUiStore } from '../stores/uiStore';
import { useAppActive } from './useAppActive';
import type { SubscriptionRow } from '../types/database';

// Intervalos de polling: 2s → 4s → 8s → 15s → 30s (total ~59s max)
const POLL_INTERVALS = [2000, 4000, 8000, 15000, 30000];

export function useCheckout(
  userId: string | undefined,
  onActivated: (sub: SubscriptionRow) => void,
): { checkingOut: boolean; startCheckout: (planId: string) => Promise<void> } {
  const [checkingOut, setCheckingOut] = useState(false);
  const pollingRef = useRef(false);
  const waitingReturnRef = useRef(false);
  const onActivatedRef = useRef(onActivated);
  onActivatedRef.current = onActivated;

  const pollSubscription = useCallback(async (uid: string) => {
    if (pollingRef.current) return;
    pollingRef.current = true;

    let updated = await fetchActiveSubscription(uid);

    for (const delay of POLL_INTERVALS) {
      if (updated?.status === 'active') break;
      await new Promise((r) => setTimeout(r, delay));
      updated = await fetchActiveSubscription(uid);
    }

    pollingRef.current = false;
    setCheckingOut(false);

    if (updated?.status === 'active') {
      clearSubscriptionAccessCache();
      await resolveSubscriptionAccess(uid);
      useUiStore.getState().showToast('success', '¡Bienvenido! Tu suscripción ya está activa.');
      onActivatedRef.current(updated);
    } else {
      // Timeout agotado — el webhook puede haber tardado más de lo esperado
      useUiStore.getState().showToast(
        'info',
        'El pago puede demorar unos minutos en acreditarse. Volvé a abrir la app para verificar.',
      );
    }
  }, []);

  // Cuando la app vuelve al frente (AppState: background → active), el usuario
  // terminó con Safari y hay que detectar el resultado del pago.
  useAppActive(() => {
    if (waitingReturnRef.current && userId) {
      waitingReturnRef.current = false;
      void pollSubscription(userId);
    }
  });

  const startCheckout = useCallback(
    async (planId: string) => {
      if (!userId || checkingOut) return;
      setCheckingOut(true);
      try {
        // Abrimos el checkout en Safari del sistema (Linking.openURL) en lugar de
        // un modal in-app. Así cuando el usuario vuelve a la app no queda ningún
        // popup flotando, y AppState hace la transición background→active que
        // dispara useAppActive + polling.
        const returnUrl = AuthSession.makeRedirectUri({ path: 'pago' });
        const { checkoutUrl } = await createCheckout(planId, returnUrl);
        waitingReturnRef.current = true;
        await Linking.openURL(checkoutUrl);
        // Linking.openURL resuelve inmediatamente; el polling lo dispara useAppActive
        // cuando el usuario vuelve a la app tras completar (o cancelar) el pago.
      } catch (err) {
        waitingReturnRef.current = false;
        setCheckingOut(false);
        useUiStore.getState().showToast('error', err instanceof Error ? err.message : 'No pudimos iniciar el pago. Intentá de nuevo.');
      }
    },
    [userId, checkingOut, pollSubscription],
  );

  return { checkingOut, startCheckout };
}
