import { create } from 'zustand';
import * as biometrics from '../services/biometrics';

/**
 * Estado del bloqueo biométrico, compartido entre App.tsx (dispara el lock al
 * volver del background), ProfileScreen (switch para prender/apagar) y
 * BiometricSetupScreen (pantalla de configuración post-activación). Antes era
 * un hook plano (`useBiometricLock`) instanciado por separado en cada lugar —
 * cada instancia tenía su PROPIO estado `enabled`, así que activar el toggle
 * en Profile no se enteraba la instancia de App.tsx (la que realmente decide
 * si bloquear) hasta el próximo remount. Con un store único, todos leen el
 * mismo valor.
 */
const GRACE_MS = 5 * 60_000; // 5 min en background antes de pedir auth de nuevo

interface BiometricState {
  userId: string | null;
  supported: boolean;
  enabled: boolean;
  locked: boolean;
  backgroundAt: number | null;

  /** Carga soporte + preferencia para el usuario actual (o los limpia si es null, ej. logout). */
  loadForUser: (userId: string | null) => Promise<void>;
  /** Prende/apaga desde Perfil — pide biometría antes de activar. */
  toggle: () => Promise<void>;
  /** Activa desde la pantalla de configuración post-onboarding. */
  enableFromSetup: (userId: string) => Promise<boolean>;
  authenticate: () => Promise<boolean>;
  markBackground: () => void;
  checkForegroundLock: (hasSession: boolean) => void;
}

export const useBiometricStore = create<BiometricState>((set, get) => ({
  userId: null,
  supported: false,
  enabled: false,
  locked: false,
  backgroundAt: null,

  loadForUser: async (userId) => {
    if (!userId) {
      set({ userId: null, supported: false, enabled: false, locked: false });
      return;
    }
    const [supported, enabled] = await Promise.all([
      biometrics.isHardwareSupported(),
      biometrics.getPreference(userId),
    ]);
    // Si cambió el usuario mientras esperábamos la respuesta, no pisamos el
    // estado del usuario nuevo con datos del anterior.
    if (get().userId !== userId && get().userId !== null) return;
    set({ userId, supported, enabled: supported && enabled, locked: false });
  },

  authenticate: async () => {
    const ok = await biometrics.authenticate();
    if (ok) set({ locked: false });
    return ok;
  },

  toggle: async () => {
    const { userId, enabled, supported } = get();
    if (!userId || !supported) return;
    const next = !enabled;
    if (next) {
      const ok = await get().authenticate();
      if (!ok) return;
    }
    await biometrics.setPreference(userId, next);
    set({ enabled: next, locked: false });
  },

  enableFromSetup: async (userId) => {
    const ok = await get().authenticate();
    if (!ok) return false;
    await biometrics.setPreference(userId, true);
    if (get().userId === userId) set({ enabled: true });
    return true;
  },

  markBackground: () => set({ backgroundAt: Date.now() }),

  checkForegroundLock: (hasSession) => {
    const { enabled, backgroundAt } = get();
    if (!enabled || !hasSession) {
      set({ backgroundAt: null });
      return;
    }
    if (backgroundAt !== null && Date.now() - backgroundAt >= GRACE_MS) {
      set({ locked: true });
    }
    set({ backgroundAt: null });
  },
}));
