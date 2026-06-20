import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { createCheckout, fetchActiveSubscription } from '../services/payments';
import { useUiStore } from '../stores/uiStore';
import type { SubscriptionRow } from '../types/database';

/**
 * Encapsula el flujo de pago con MercadoPago:
 *   1. Crea la preferencia (Edge Function) y abre el checkout en un in-app browser.
 *   2. Cuando la app vuelve al frente (AppState) o el browser se cierra, hace polling
 *      esperando que el webhook active la suscripción.
 *   3. Al activarse, llama onActivated y muestra el toast de bienvenida.
 *
 * Lo usan tanto SubscriptionScreen (alumno ya activo) como PendingActivationScreen
 * (alumno bloqueado que paga para desbloquearse).
 */
export function useCheckout(
  userId: string | undefined,
  onActivated: (sub: SubscriptionRow) => void,
): { checkingOut: boolean; startCheckout: (planId: string) => Promise<void> } {
  const [checkingOut, setCheckingOut] = useState(false);
  const pollingRef = useRef(false);
  const appStateRef = useRef(AppState.currentState);
  const waitingReturnRef = useRef(false);
  // Guardamos el callback en un ref para no recrear el listener en cada render.
  const onActivatedRef = useRef(onActivated);
  onActivatedRef.current = onActivated;

  const pollSubscription = useCallback(async (uid: string) => {
    if (pollingRef.current) return;
    pollingRef.current = true;
    const attempts = [2000, 3000, 5000];
    let updated = await fetchActiveSubscription(uid);
    for (const delay of attempts) {
      if (updated?.status === 'active') break;
      await new Promise((r) => setTimeout(r, delay));
      updated = await fetchActiveSubscription(uid);
    }
    pollingRef.current = false;
    setCheckingOut(false);
    if (updated?.status === 'active') {
      useUiStore.getState().showToast('success', '¡Bienvenido! Tu suscripción ya está activa.');
      onActivatedRef.current(updated);
    }
  }, []);

  // Cuando la app vuelve al frente después del checkout, arrancamos el polling.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (
        waitingReturnRef.current &&
        appStateRef.current.match(/inactive|background/) &&
        next === 'active' &&
        userId
      ) {
        waitingReturnRef.current = false;
        void pollSubscription(userId);
      }
      appStateRef.current = next;
    });
    return () => sub.remove();
  }, [userId, pollSubscription]);

  const startCheckout = useCallback(
    async (planId: string) => {
      if (!userId || checkingOut) return;
      setCheckingOut(true);
      try {
        const { checkoutUrl } = await createCheckout(planId);
        waitingReturnRef.current = true;
        await WebBrowser.openAuthSessionAsync(checkoutUrl, 'reset-fitness://pago');
        // Si openAuthSessionAsync resuelve por el deep link (sin pasar por background),
        // disparamos el polling acá.
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
