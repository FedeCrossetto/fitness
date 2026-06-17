import * as AuthSession from 'expo-auth-session';
import { supabase } from './supabase';

/** URI fija de retorno OAuth → debe estar en Supabase → Authentication → Redirect URLs */
export function getOAuthRedirectUri(): string {
  return AuthSession.makeRedirectUri({
    scheme: 'habito',
    path: 'auth/callback',
  });
}

/** Completa la sesión OAuth desde la URL de retorno (PKCE o tokens en hash). */
export async function completeOAuthFromUrl(url: string): Promise<void> {
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

  throw new Error('No se recibió la confirmación de Google.');
}
