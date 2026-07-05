import { create } from 'zustand';
import { Linking } from 'react-native';
import * as AuthSession from 'expo-auth-session';
import { createCheckout } from '../services/payments';
import { useUiStore } from './uiStore';

/**
 * Estado del flujo de checkout de suscripción, elevado a store para que el
 * RootNavigator pueda mostrar la pantalla de resultado (aprobado/pending/
 * rechazado) POR ENCIMA del gate normal. Es un flag del lado del cliente: el
 * backend ya puede haber activado la suscripción, pero la app retiene la
 * pantalla "aprobado + Comencemos" hasta que el usuario la confirma.
 *
 * En memoria a propósito: si la app se reinicia a mitad de flujo, se cae a
 * `idle` y el gate normal decide (si ya pagó, avanza; si no, muestra planes).
 */
export type CheckoutPhase = 'idle' | 'processing' | 'approved' | 'rejected';

interface CheckoutState {
  phase: CheckoutPhase;
  planId: string | null;
  subscriptionId: string | null;
  /** Inicia (o reintenta) el checkout de un plan: abre Mercado Pago en Safari. */
  start: (planId: string) => Promise<void>;
  setPhase: (phase: CheckoutPhase) => void;
  setSubscriptionId: (id: string | null) => void;
  reset: () => void;
}

export const useCheckoutStore = create<CheckoutState>((set) => ({
  phase: 'idle',
  planId: null,
  subscriptionId: null,

  start: async (planId) => {
    // Pasamos a 'processing' ANTES del await: el RootNavigator swapea de
    // inmediato a la pantalla de resultado (spinner) mientras se abre MP.
    set({ phase: 'processing', planId, subscriptionId: null });
    try {
      // `makeRedirectUri` → `exp://…/--/pago` (Expo Go) o `reset-fitness://pago`
      // (standalone). Es el deep link al que la web /pago ofrece "Volver a la app".
      const returnUrl = AuthSession.makeRedirectUri({ path: 'pago' });
      const { checkoutUrl, subscriptionId, alreadyActive } = await createCheckout(planId, returnUrl);
      set({ subscriptionId: subscriptionId || null });

      if (alreadyActive) {
        set({ phase: 'approved' });
        return;
      }
      await Linking.openURL(checkoutUrl);
    } catch (err) {
      if (__DEV__) console.warn('[checkout] start error:', err);
      useUiStore.getState().showToast(
        'error',
        err instanceof Error ? err.message : 'No pudimos iniciar el pago. Intentá de nuevo.',
      );
      set({ phase: 'idle' });
    }
  },

  setPhase: (phase) => set({ phase }),
  setSubscriptionId: (subscriptionId) => set({ subscriptionId }),
  reset: () => set({ phase: 'idle', planId: null, subscriptionId: null }),
}));
