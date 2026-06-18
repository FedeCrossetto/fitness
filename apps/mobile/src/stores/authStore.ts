import { create } from 'zustand';
import * as WebBrowser from 'expo-web-browser';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { clearCache } from '../lib/cache';
import { useBrandingStore } from './brandingStore';
import {
  applyPendingInviteLink,
  clearPendingInviteCode,
  linkClientByInviteCode,
  readPendingInviteCode,
  savePendingInviteCode,
} from '../services/invite';
import { INVITE_REQUIRED_MESSAGE } from '../services/clientAccess';
import { completeOAuthFromUrl, getOAuthRedirectUri } from '../lib/oauthRedirect';
import type { ProfileRow, UserProfileRow } from '../types/database';

WebBrowser.maybeCompleteAuthSession();

export type OAuthProvider = 'apple' | 'google';
export type AuthIntent = 'login' | 'signup';

interface AuthState {
  session: Session | null;
  profile: ProfileRow | null;
  userProfile: UserProfileRow | null;
  initializing: boolean;
  loading: boolean;
  error: string | null;
  needsOnboarding: boolean;

  checkSession: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<boolean>;
  signUp: (email: string, password: string, fullName: string, trainerCode?: string) => Promise<boolean>;
  signInWithOAuth: (provider: OAuthProvider, trainerCode?: string, intent?: AuthIntent) => Promise<boolean>;
  linkTrainer: (code: string) => Promise<boolean>;
  resetPassword: (email: string) => Promise<boolean>;
  completeOnboarding: (data: { goal: string; level: string }) => Promise<boolean>;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

function messageFor(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  if (raw.includes('código') || raw.includes('invitación') || raw.includes('entrenador')) return raw;
  if (raw.includes('Invalid login credentials')) {
    return 'Email o contraseña incorrectos. Si te registraste con Google, usá el botón Google.';
  }
  if (raw.includes('Email not confirmed')) {
    return 'Confirmá tu email desde el link que te enviamos antes de iniciar sesión.';
  }
  if (raw.includes('already registered')) return 'Ese email ya está registrado.';
  if (raw.includes('Password should be')) return 'La contraseña debe tener al menos 6 caracteres.';
  if (raw.toLowerCase().includes('network')) return 'Sin conexión. Revisá tu internet e intentá de nuevo.';
  return 'Algo salió mal. Intentá de nuevo.';
}

async function loadProfiles(userId: string): Promise<{ profile: ProfileRow | null; userProfile: UserProfileRow | null }> {
  const [profileRes, userProfileRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
    supabase.from('user_profiles').select('*').eq('user_id', userId).maybeSingle(),
  ]);
  return {
    profile: profileRes.data ?? null,
    userProfile: userProfileRes.data ?? null,
  };
}

async function finishAuthSession(session: Session): Promise<{ profile: ProfileRow | null; userProfile: UserProfileRow | null }> {
  await applyPendingInviteLink();
  return loadProfiles(session.user.id);
}

async function commitSession(
  session: Session,
  profile: ProfileRow | null,
  userProfile: UserProfileRow | null,
  needsOnboarding?: boolean,
): Promise<void> {
  setAuthState(session, profile, userProfile, needsOnboarding ?? !profile?.goal);
  await useBrandingStore.getState().load();
}

function setAuthState(
  session: Session,
  profile: ProfileRow | null,
  userProfile: UserProfileRow | null,
  needsOnboarding: boolean,
): void {
  useAuthStore.setState({
    session,
    profile,
    userProfile,
    needsOnboarding,
    loading: false,
    initializing: false,
  });
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  profile: null,
  userProfile: null,
  initializing: true,
  loading: false,
  error: null,
  needsOnboarding: false,

  checkSession: async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (session) {
        const { profile, userProfile } = await finishAuthSession(session);
        set({
          session,
          profile,
          userProfile,
          needsOnboarding: !profile?.goal,
          initializing: false,
        });
        await useBrandingStore.getState().load();
      } else {
        set({ session: null, profile: null, userProfile: null, initializing: false });
      }
    } catch {
      set({ initializing: false });
    }

    supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        set({ session: null, profile: null, userProfile: null, needsOnboarding: false, loading: false });
        useBrandingStore.getState().clear();
        return;
      }

      // signIn / signUp / OAuth ya resuelven perfil en commitSession
      if (get().loading) return;

      const currentId = get().session?.user.id;
      if (currentId === session.user.id) {
        set({ session });
        return;
      }

      set({ session, profile: null, userProfile: null, loading: true });
      void (async () => {
        try {
          const { profile, userProfile } = await finishAuthSession(session);
          set({
            profile,
            userProfile,
            needsOnboarding: !profile?.goal,
            loading: false,
          });
          await useBrandingStore.getState().load();
        } catch {
          set({ loading: false });
        }
      })();
    });
  },

  signIn: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      const { profile, userProfile } = await finishAuthSession(data.session!);
      await commitSession(data.session!, profile, userProfile);
      return true;
    } catch (error) {
      set({ loading: false, error: messageFor(error) });
      return false;
    }
  },

  signUp: async (email, password, fullName, trainerCode) => {
    set({ loading: true, error: null });
    try {
      const code = trainerCode?.trim();
      if (!code) {
        set({ loading: false, error: INVITE_REQUIRED_MESSAGE });
        return false;
      }
      await savePendingInviteCode(code);
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { full_name: fullName.trim(), trainer_code: code },
        },
      });
      if (error) throw error;
      if (!data.session) {
        set({ loading: false, error: 'Revisá tu email para confirmar la cuenta y luego iniciá sesión.' });
        return false;
      }
      const { profile, userProfile } = await finishAuthSession(data.session);
      await commitSession(data.session, profile, userProfile, true);
      return true;
    } catch (error) {
      set({ loading: false, error: messageFor(error) });
      return false;
    }
  },

  signInWithOAuth: async (provider, trainerCode, intent = 'login') => {
    set({ loading: true, error: null });
    try {
      const pending = trainerCode?.trim() || (await readPendingInviteCode());
      if (intent === 'signup' && !pending) {
        set({ loading: false, error: INVITE_REQUIRED_MESSAGE });
        return false;
      }
      if (pending) await savePendingInviteCode(pending);

      const redirectTo = getOAuthRedirectUri();
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error) throw error;

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type !== 'success') {
        set({ loading: false });
        return false;
      }

      await completeOAuthFromUrl(result.url);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No se pudo iniciar sesión.');

      const { profile, userProfile } = await finishAuthSession(session);
      const isNewSignup = intent === 'signup' || !profile?.goal;
      await commitSession(session, profile, userProfile, isNewSignup);
      return true;
    } catch (error) {
      set({ loading: false, error: messageFor(error) });
      return false;
    }
  },

  linkTrainer: async (code) => {
    set({ loading: true, error: null });
    try {
      const { session } = get();
      if (!session) throw new Error('Sesión expirada. Volvé a iniciar sesión.');

      const clean = code.trim();
      if (clean.length < 3) {
        set({ loading: false, error: INVITE_REQUIRED_MESSAGE });
        return false;
      }

      await savePendingInviteCode(clean);
      const link = await linkClientByInviteCode(clean);
      if (!link.ok) {
        set({ loading: false, error: link.message });
        return false;
      }

      await clearPendingInviteCode();
      const { profile, userProfile } = await loadProfiles(session.user.id);
      set({ profile, userProfile, loading: false, error: null });
      await useBrandingStore.getState().load();
      return true;
    } catch (error) {
      set({ loading: false, error: messageFor(error) });
      return false;
    }
  },

  resetPassword: async (email) => {
    set({ loading: true, error: null });
    try {
      const redirectTo = getOAuthRedirectUri();
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
      if (error) throw error;
      set({ loading: false });
      return true;
    } catch (error) {
      set({ loading: false, error: messageFor(error) });
      return false;
    }
  },

  completeOnboarding: async ({ goal, level }) => {
    const { session } = get();
    if (!session) return false;
    set({ loading: true, error: null });
    try {
      const userId = session.user.id;
      const [profileRes, userProfileRes] = await Promise.all([
        supabase.from('profiles').update({ goal }).eq('id', userId).select().single(),
        supabase.from('user_profiles').update({ level }).eq('user_id', userId).select().single(),
      ]);
      if (profileRes.error) throw profileRes.error;
      if (userProfileRes.error) throw userProfileRes.error;
      set({
        profile: profileRes.data,
        userProfile: userProfileRes.data,
        needsOnboarding: false,
        loading: false,
      });
      return true;
    } catch (error) {
      set({ loading: false, error: messageFor(error) });
      return false;
    }
  },

  refreshProfile: async () => {
    const { session } = get();
    if (!session) return;
    const { profile, userProfile } = await loadProfiles(session.user.id);
    set({ profile, userProfile });
    await useBrandingStore.getState().load();
  },

  signOut: async () => {
    set({ loading: true });
    try {
      await supabase.auth.signOut();
      await clearCache();
      await clearPendingInviteCode();
      useBrandingStore.getState().clear();
    } finally {
      set({
        session: null,
        profile: null,
        userProfile: null,
        needsOnboarding: false,
        loading: false,
        error: null,
      });
    }
  },

  clearError: () => set({ error: null }),
}));
