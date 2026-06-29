import { useCallback, useRef, useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
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

  // Cuando la app vuelve al frente después del checkout, cerramos el browser
  // de MP que pudo haber quedado abierto (si el pago fue vía app de MP) y
  // disparamos polling para detectar la suscripción.
  useAppActive(() => {
    if (waitingReturnRef.current && userId) {
      waitingReturnRef.current = false;
      void WebBrowser.dismissBrowser();
      void pollSubscription(userId);
    }
  });

  const startCheckout = useCallback(
    async (planId: string) => {
      if (!userId || checkingOut) return;
      setCheckingOut(true);
      try {
        // returnUrl solo se usa en el ?return= de la página web intermedia para
        // el botón "Volver a la app". El browser se cierra con dismissBrowser()
        // desde useAppActive, por eso usamos openBrowserAsync (SFSafariViewController)
        // que sí responde a dismissBrowser, a diferencia de openAuthSessionAsync
        // (ASWebAuthenticationSession) que no puede cerrarse programáticamente.
        const returnUrl = AuthSession.makeRedirectUri({ path: 'pago' });
        const { checkoutUrl } = await createCheckout(planId, returnUrl);
        waitingReturnRef.current = true;
        await WebBrowser.openBrowserAsync(checkoutUrl, { dismissButtonStyle: 'close' });
        // openBrowserAsync resuelve cuando el usuario cierra manualmente el browser.
        if (waitingReturnRef.current) {
          waitingReturnRef.current = false;
          void pollSubscription(userId);
        }
      } catch (err) {
        waitingReturnRef.current = false;
        setCheckingOut(false);
        useUiStore
          .getState()
          .showToast('error', err instanceof Error ? err.message : 'No pudimos iniciar el pago. Intentá de nuevo.');
      }
    },
    [userId, checkingOut, pollSubscription],
  );

  return { checkingOut, startCheckout };
}
