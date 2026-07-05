import { useCallback, useRef, useState } from 'react';
import { Linking } from 'react-native';
import * as AuthSession from 'expo-auth-session';
import {
  createCheckout,
  fetchActiveSubscription,
  syncSubscription,
  clearSubscriptionAccessCache,
  resolveSubscriptionAccess,
} from '../services/payments';
import { useUiStore } from '../stores/uiStore';
import { useAppActive } from './useAppActive';
import type { SubscriptionRow } from '../types/database';

// Intervalos de polling: arranca rápido (MP suele autorizar en pocos segundos)
// y se estira. ~50s máx.
const POLL_INTERVALS = [1500, 2500, 4000, 6000, 8000, 12000, 15000];

/**
 * Checkout in-app para "Mi plan" (usuario ya activo que renueva/cambia de plan).
 * A diferencia del flujo de onboarding (checkoutStore + CheckoutResultScreen),
 * este es autocontenido: abre MP, y al volver consulta activamente a MP
 * (`mp-sync-subscription`) hasta que la suscripción queda activa, sin depender
 * del webhook. No toma la pantalla completa — solo un spinner en el botón.
 */
export function useCheckout(
  userId: string | undefined,
  onActivated: (sub: SubscriptionRow) => void,
): { checkingOut: boolean; startCheckout: (planId: string) => Promise<void> } {
  const [checkingOut, setCheckingOut] = useState(false);
  const pollingRef = useRef(false);
  const waitingReturnRef = useRef(false);
  const lastSubscriptionIdRef = useRef<string | null>(null);
  const onActivatedRef = useRef(onActivated);
  onActivatedRef.current = onActivated;

  const pollSubscription = useCallback(async (uid: string) => {
    if (pollingRef.current) return;
    pollingRef.current = true;

    const syncNow = () => syncSubscription(lastSubscriptionIdRef.current ?? undefined);
    await syncNow();
    let updated = await fetchActiveSubscription(uid);

    for (const delay of POLL_INTERVALS) {
      if (updated?.status === 'active') break;
      await new Promise((r) => setTimeout(r, delay));
      await syncNow();
      updated = await fetchActiveSubscription(uid);
    }

    pollingRef.current = false;
    setCheckingOut(false);

    if (updated?.status === 'active') {
      clearSubscriptionAccessCache();
      await resolveSubscriptionAccess(uid);
      useUiStore.getState().showToast('success', '¡Listo! Tu suscripción ya está activa.');
      onActivatedRef.current(updated);
    } else {
      useUiStore.getState().showToast(
        'info',
        'El pago puede demorar unos minutos en acreditarse. Volvé a abrir la app para verificar.',
      );
    }
  }, []);

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
        const returnUrl = AuthSession.makeRedirectUri({ path: 'pago' });
        const { checkoutUrl, subscriptionId, alreadyActive } = await createCheckout(planId, returnUrl);
        lastSubscriptionIdRef.current = subscriptionId || null;

        if (alreadyActive) {
          clearSubscriptionAccessCache();
          await resolveSubscriptionAccess(userId);
          setCheckingOut(false);
          useUiStore.getState().showToast('success', 'Tu plan ya está activo.');
          const active = await fetchActiveSubscription(userId);
          if (active) onActivatedRef.current(active);
          return;
        }

        waitingReturnRef.current = true;
        await Linking.openURL(checkoutUrl);
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
