import { create } from 'zustand';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { clearCache } from '../lib/cache';
import { useBrandingStore } from './brandingStore';
import {
  applyPendingInviteLink,
  readPendingInviteCode,
  savePendingInviteCode,
} from '../services/invite';
import type { ProfileRow, UserProfileRow } from '../types/database';

WebBrowser.maybeCompleteAuthSession();

export type OAuthProvider = 'apple' | 'google';

interface AuthState {
  session: Session | null;
  profile: ProfileRow | null;
  userProfile: UserProfileRow | null;
  /** true mientras se restaura la sesión al iniciar la app */
  initializing: boolean;
  loading: boolean;
  error: string | null;
  /** true cuando el usuario se registró y todavía no completó el onboarding */
  needsOnboarding: boolean;

  checkSession: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<boolean>;
  signUp: (email: string, password: string, fullName: string, trainerCode?: string) => Promise<boolean>;
  signInWithOAuth: (provider: OAuthProvider, trainerCode?: string) => Promise<boolean>;
  resetPassword: (email: string) => Promise<boolean>;
  completeOnboarding: (data: { goal: string; level: string }) => Promise<boolean>;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

function messageFor(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  if (raw.includes('Invalid login credentials')) {
    return 'Email o contraseña incorrectos. Si te registraste con Google en la web, usá el botón Google acá (no email/contraseña).';
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
        void useBrandingStore.getState().load();
      } else {
        set({ session: null, profile: null, userProfile: null, initializing: false });
      }
    } catch {
      set({ initializing: false });
    }

    supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        set({ session: null, profile: null, userProfile: null, needsOnboarding: false });
        useBrandingStore.getState().clear();
      } else {
        set({ session });
        void useBrandingStore.getState().load();
      }
    });
  },

  signIn: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      const { profile, userProfile } = await finishAuthSession(data.session!);
      set({
        session: data.session,
        profile,
        userProfile,
        needsOnboarding: !profile?.goal,
        loading: false,
      });
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
      if (code) await savePendingInviteCode(code);
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { full_name: fullName.trim(), ...(code ? { trainer_code: code } : {}) },
        },
      });
      if (error) throw error;
      if (!data.session) {
        // Confirmación por email habilitada en el proyecto
        set({ loading: false, error: 'Revisá tu email para confirmar la cuenta y luego iniciá sesión.' });
        return false;
      }
      const { profile, userProfile } = await finishAuthSession(data.session!);
      set({ session: data.session, profile, userProfile, needsOnboarding: true, loading: false });
      return true;
    } catch (error) {
      set({ loading: false, error: messageFor(error) });
      return false;
    }
  },

  signInWithOAuth: async (provider, trainerCode) => {
    set({ loading: true, error: null });
    try {
      const pending = trainerCode?.trim() || (await readPendingInviteCode());
      if (pending) await savePendingInviteCode(pending);

      const redirectTo = AuthSession.makeRedirectUri({ scheme: 'habito' });
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

      const url = new URL(result.url);
      const code = url.searchParams.get('code');
      if (!code) throw new Error('No se recibió el código de autorización.');

      const { data: sessionData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) throw exchangeError;

      const { profile, userProfile } = await finishAuthSession(sessionData.session);
      set({
        session: sessionData.session,
        profile,
        userProfile,
        needsOnboarding: !profile?.goal,
        loading: false,
      });
      return true;
    } catch (error) {
      set({ loading: false, error: messageFor(error) });
      return false;
    }
  },

  resetPassword: async (email) => {
    set({ loading: true, error: null });
    try {
      const redirectTo = AuthSession.makeRedirectUri({ scheme: 'habito' });
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
  },

  signOut: async () => {
    set({ loading: true });
    try {
      await supabase.auth.signOut();
      await clearCache();
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
