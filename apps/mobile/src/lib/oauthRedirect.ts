import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as AuthSession from 'expo-auth-session';
import { supabase } from './supabase';

const AUTH_CALLBACK_PATH = 'auth/callback';
const DEFAULT_HTTPS_REDIRECT = 'https://reset-fitness.vercel.app/auth/mobile-callback';

function getAppScheme(): string {
  const fromConfig = Constants.expoConfig?.scheme;
  if (typeof fromConfig === 'string' && fromConfig.length > 0) return fromConfig;
  return 'reset-fitness';
}

/**
 * URL HTTPS que Supabase usa como redirect_to (debe estar en Redirect URLs).
 * Evita depender de custom schemes en el dashboard de Supabase.
 */
export function getOAuthRedirectUri(): string {
  if (Platform.OS === 'web') {
    return AuthSession.makeRedirectUri({ path: AUTH_CALLBACK_PATH });
  }
  const fromEnv = process.env.EXPO_PUBLIC_OAUTH_REDIRECT_URL?.trim();
  return fromEnv || DEFAULT_HTTPS_REDIRECT;
}

/** Deep link que la app escucha al volver del browser (ASWebAuthenticationSession). */
export function getOAuthReturnUri(): string {
  if (Platform.OS === 'web') {
    return getOAuthRedirectUri();
  }
  return `${getAppScheme()}://${AUTH_CALLBACK_PATH}`;
}

type OAuthProvider = 'apple' | 'google';

/** Completa la sesión OAuth desde la URL de retorno (PKCE o tokens en hash). */
export async function completeOAuthFromUrl(url: string, provider: OAuthProvider = 'google'): Promise<void> {
  const parsed = new URL(url);
  const authCode = parsed.searchParams.get('code');

  if (authCode) {
    const { error } = await supabase.auth.exchangeCodeForSession(authCode);
    if (error) throw error;
    return;
  }

  const hash = new URLSearchParams(parsed.hash.replace(/^#/, ''));
  const accessToken = hash.get('access_token');
  const refreshToken = hash.get('refresh_token');
  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    if (error) throw error;
    return;
  }

  const oauthError = parsed.searchParams.get('error_description') ?? hash.get('error_description');
  if (oauthError) throw new Error(decodeURIComponent(oauthError.replace(/\+/g, ' ')));

  const label = provider === 'apple' ? 'Apple' : 'Google';
  throw new Error(`No se recibió la confirmación de ${label}.`);
}
