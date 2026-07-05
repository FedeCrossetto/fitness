import { useEffect } from 'react';
import { Linking } from 'react-native';
import { parseInviteCodeFromUrl, savePendingInviteCode } from '../services/invite';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';

/** Procesa un deep link de recuperación de contraseña (type=recovery o
 * type=custom_recovery — ver custom-request-password-reset). */
async function handleRecoveryUrl(url: string): Promise<boolean> {
  try {
    const parsed = new URL(url);
    const type = parsed.searchParams.get('type') ?? new URLSearchParams(parsed.hash.replace(/^#/, '')).get('type');

    // Flujo custom (Resend, sin sesión de Supabase): token+email de nuestra
    // propia tabla — ver custom-request-password-reset / custom-confirm-password-reset.
    if (type === 'custom_recovery') {
      const token = parsed.searchParams.get('token');
      const email = parsed.searchParams.get('email');
      if (token && email) {
        useAuthStore.getState().setPendingPasswordReset({ email, token });
        return true;
      }
      return false;
    }

    if (type !== 'recovery') return false;

    // PKCE: code en query string
    const code = parsed.searchParams.get('code');
    if (code) {
      await supabase.auth.exchangeCodeForSession(code);
      return true;
    }

    // Implicit: tokens en el hash
    const hash = new URLSearchParams(parsed.hash.replace(/^#/, ''));
    const accessToken  = hash.get('access_token');
    const refreshToken = hash.get('refresh_token');
    if (accessToken && refreshToken) {
      await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      return true;
    }
  } catch (err) {
    if (__DEV__) console.warn('[recovery deep link]', err);
  }
  return false;
}

/** Guarda el código de invitación si la app se abrió desde un link. También maneja recovery links. */
export function useInviteDeepLink(): void {
  useEffect(() => {
    const handle = async (url: string) => {
      const isRecovery = await handleRecoveryUrl(url);
      if (isRecovery) return;
      const code = parseInviteCodeFromUrl(url);
      if (code) void savePendingInviteCode(code);
    };

    void Linking.getInitialURL().then((url) => {
      if (url) void handle(url);
    });

    const sub = Linking.addEventListener('url', ({ url }) => void handle(url));
    return () => sub.remove();
  }, []);
}
