import { useCallback, useRef, useState } from 'react';
import { Linking } from 'react-native';
import * as AuthSession from 'expo-auth-session';
import { createCheckout, fetchActiveSubscription, clearSubscriptionAccessCache, resolveSubscriptionAccess } from '../services/payments';
import { useUiStore } from '../stores/uiStore';
import { useAppActive } from './useAppActive';
import type { SubscriptionRow } from '../types/database';

// Intervalos de polling: arranca rápido (el webhook suele acreditar en pocos
// segundos) y se estira. Total ~50s máx si nunca se activa.
const POLL_INTERVALS = [1500, 2500, 4000, 6000, 8000, 12000, 15000];

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

  // Al abrir el checkout en Safari (app externa), la nuestra pasa a background.
  // Cuando el usuario vuelve (AppState background→active) disparamos el polling.
  // El navegador in-app NO genera esa transición — por eso usamos Safari externo.
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
        // `makeRedirectUri` produce el deep link del entorno actual: `exp://…/--/pago`
        // en Expo Go, `reset-fitness://pago` en un build standalone. Se guarda en el
        // backend (client_return_url) y la página /pago/exito redirige exactamente a
        // ese deep link — que Safari sabe rutear de vuelta a la app.
        const returnUrl = AuthSession.makeRedirectUri({ path: 'pago' });
        const { checkoutUrl } = await createCheckout(planId, returnUrl);
        waitingReturnRef.current = true;
        // Safari del sistema (app externa), NO un navegador in-app: así la app pasa
        // a background y AppState dispara useAppActive + polling al volver. Con el
        // navegador in-app la transición no ocurría y el spinner quedaba colgado.
        await Linking.openURL(checkoutUrl);
        // Linking.openURL resuelve inmediatamente; el polling lo dispara useAppActive
        // cuando el usuario vuelve a la app tras completar (o cancelar) el pago.
      } catch (err) {
        waitingReturnRef.current = false;
        setCheckingOut(false);
        useUiStore.getState().showToast('error', err instanceof Error ? err.message : 'No pudimos iniciar el pago. Intentá de nuevo.');
      }
    },
    [userId, checkingOut],
  );

  return { checkingOut, startCheckout };
}
